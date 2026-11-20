"""Account types, usernames, auth-provider identity mapping and access rules.

Identity model
--------------
* ``users.id`` is the internal application key. Financial records never use the
  username or email as a key.
* ``auth_identities(provider, subject)`` maps an authentication provider's stable
  user ID to ``users.id``. The built-in password provider is ``local`` and its
  subject is the user ID. An OpenID Connect provider (for example Auth0, Microsoft
  Entra External ID or Google) would add rows with provider=<issuer> and
  subject=<the ID token ``sub`` claim>, without changing financial tables.
* ``users.username`` is a unique, case-insensitive profile field.
* ``account_access`` lists the account types a user may open. The login dropdown
  only *requests* one of these; the server checks it on login and on every
  authenticated request.
"""
import hashlib
import json
import os
import re
import secrets
import smtplib
import sqlite3
import ssl
import threading
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

LOCAL_PROVIDER = 'local'
ACCOUNT_TYPES = {
    'personal_household': ('Personal', 'Household'),
    'business': ('Business',),
}
LABELS = {'personal_household': 'Personal / Household', 'business': 'Business'}
USERNAME_RULE = re.compile(r'[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]')
RESERVED = {'admin', 'administrator', 'root', 'support', 'opsmind', 'opsmindai', 'system', 'demo', 'help', 'api', 'login', 'logout', 'me'}


def account_type_for_kind(kind):
    return next(account for account, kinds in ACCOUNT_TYPES.items() if kind in kinds)


def normalize_account_type(data):
    """Accept the account type, or a legacy ``workspace_kind`` from older clients."""
    value = data.get('account_type')
    if value is None and data.get('workspace_kind') in ('Personal', 'Household', 'Business'):
        value = account_type_for_kind(data['workspace_kind'])
    return value if value in ACCOUNT_TYPES else None


def clean_username(core, value):
    if not isinstance(value, str):
        raise core.APIError('Choose a username.')
    username = value.strip().lstrip('@').lower()
    if not USERNAME_RULE.fullmatch(username):
        raise core.APIError('Usernames use 3-30 lowercase letters, numbers, dots, dashes or underscores, and start and end with a letter or number.')
    if username in RESERVED or username.startswith('demo-'):
        raise core.APIError('That username is reserved. Choose another.')
    return username


def username_taken(db, username):
    return db.execute('SELECT 1 FROM users WHERE username=?', (username,)).fetchone() is not None


def allowed_kinds(account_type):
    return ACCOUNT_TYPES.get(account_type, ())


def access_types(db, user):
    return [r['account_type'] for r in db.execute('SELECT account_type FROM account_access WHERE user_id=? ORDER BY account_type', (user,))]


def grant(db, user, account_type, source):
    db.execute('INSERT OR IGNORE INTO account_access(user_id,account_type,granted_at,source) VALUES(?,?,?,?)', (user, account_type, _now(), source))


def link_identity(db, provider, subject, user, email):
    db.execute('INSERT INTO auth_identities(provider,subject,user_id,email,created_at) VALUES(?,?,?,?,?)', (provider, subject, user, email, _now()))


def contact_email(core, value):
    """Optional contact email: '' when blank, otherwise a validated lowercase address."""
    if value in (None, ''):
        return ''
    if not isinstance(value, str) or len(value.strip()) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value.strip()):
        raise core.APIError('Enter a valid email address, or leave it blank.')
    return value.strip().lower()


def contact_phone(core, value):
    """Optional phone: '' when blank, otherwise digits with an optional leading + (7-15 digits)."""
    if value in (None, ''):
        return ''
    if not isinstance(value, str) or not re.fullmatch(r'\+?[\d\s().-]{7,25}', value.strip()):
        raise core.APIError('Enter a valid phone number (7-15 digits, optional +country code), or leave it blank.')
    digits = re.sub(r'\D', '', value)
    if not 7 <= len(digits) <= 15:
        raise core.APIError('Enter a valid phone number (7-15 digits, optional +country code), or leave it blank.')
    return ('+' if value.strip().startswith('+') else '') + digits


def public_email(email):
    return None if not email or email.endswith('@demo.invalid') else email


def _now():
    return datetime.now(timezone.utc).isoformat()


def _columns(db, table):
    return {r[1] for r in db.execute(f'PRAGMA table_info({table})')}


def needs_migration(db):
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if 'users' not in tables:
        return False  # brand-new database; nothing to preserve
    return 'username' not in _columns(db, 'users') or 'account_access' not in tables or 'auth_identities' not in tables


def backup(db_path, label):
    """Copy the live database with SQLite's online backup API before a schema change."""
    source = Path(db_path)
    if not source.exists() or source.stat().st_size == 0:
        return None
    target_dir = source.parent / 'backups'
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f'{source.stem}-before-{label}-{datetime.now().strftime("%Y%m%d-%H%M%S")}.db'
    src = sqlite3.connect(source)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    return target


def migrate(db):
    """Additive, idempotent migration. Never deletes users, workspaces or financial records."""
    users = _columns(db, 'users')
    if 'username' not in users:
        db.execute('ALTER TABLE users ADD COLUMN username TEXT')
    if 'created_at' not in users:
        db.execute("ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
    db.executescript('''
        CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users(username) WHERE username IS NOT NULL;
        CREATE TABLE IF NOT EXISTS auth_identities(
            provider TEXT NOT NULL,
            subject TEXT NOT NULL,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            email TEXT,
            created_at TEXT NOT NULL,
            PRIMARY KEY(provider, subject)
        );
        CREATE INDEX IF NOT EXISTS identity_user ON auth_identities(user_id);
        CREATE TABLE IF NOT EXISTS account_access(
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            account_type TEXT NOT NULL CHECK(account_type IN ('personal_household','business')),
            granted_at TEXT NOT NULL,
            source TEXT NOT NULL,
            PRIMARY KEY(user_id, account_type)
        );
    ''')
    if 'account_type' not in _columns(db, 'sessions'):
        db.execute('ALTER TABLE sessions ADD COLUMN account_type TEXT')
    # Every existing password account gets a local identity mapped to its existing ID.
    db.execute('INSERT OR IGNORE INTO auth_identities(provider,subject,user_id,email,created_at) SELECT ?,id,id,email,? FROM users WHERE id NOT IN (SELECT user_id FROM auth_identities)', (LOCAL_PROVIDER, _now()))
    # Legacy accounts keep exactly the access they already had through workspace membership.
    legacy = db.execute('SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM account_access)').fetchall()
    for row in legacy:
        kinds = {r[0] for r in db.execute('SELECT DISTINCT workspaces.kind FROM members JOIN workspaces ON workspaces.id=members.workspace_id WHERE members.user_id=?', (row[0],))}
        types = {account_type_for_kind(k) for k in kinds if k in ('Personal', 'Household', 'Business')} or {'personal_household'}
        for account_type in types:
            grant(db, row[0], account_type, 'legacy-migration')
    # Synthetic demo users get a generated username; real legacy users choose one at next sign-in.
    db.execute("UPDATE users SET username='demo-' || substr(id,1,12) WHERE username IS NULL AND email LIKE '%@demo.invalid'")
    # Password reset tokens: only a SHA-256 of the token is stored; each is single-use and short-lived.
    db.execute('''CREATE TABLE IF NOT EXISTS password_resets(
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires TEXT NOT NULL,
        created_at TEXT NOT NULL
    )''')
    # Workspace invitations: access is granted only when the invited email address accepts.
    if 'email_verified_at' not in _columns(db, 'users'):
        db.execute("ALTER TABLE users ADD COLUMN email_verified_at TEXT NOT NULL DEFAULT ''")
    db.executescript('''
        CREATE TABLE IF NOT EXISTS workspace_invites(
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('member','viewer')),
            token_hash TEXT UNIQUE,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
            invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            expires TEXT NOT NULL,
            sent_at TEXT NOT NULL DEFAULT '',
            last_error TEXT NOT NULL DEFAULT '',
            accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
            accepted_at TEXT NOT NULL DEFAULT ''
        );
        CREATE UNIQUE INDEX IF NOT EXISTS invite_one_pending ON workspace_invites(workspace_id, email) WHERE status='pending';
    ''')


# ---- Email-based password reset -----------------------------------------------------------
# Enabled only when SMTP is configured, so the login page never shows a dead "Forgot password?" link.
# GoDaddy email: SMTP_HOST=smtpout.secureserver.net SMTP_PORT=587 SMTP_USER=admin@trikosh.com SMTP_PASS=<mailbox password>
RESET_MINUTES = 30
RESET_REQUESTS_PER_HOUR = 5


def _mail_settings():
    host, user, password = (os.environ.get(k, '').strip() for k in ('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'))
    domain = os.environ.get('DOMAIN', '').split(',')[0].strip()
    base = os.environ.get('PUBLIC_URL', '').strip().rstrip('/') or (f'https://{domain}' if domain else '')
    return host, user, password, base


def mail_config():
    """SMTP settings shared by password reset and workspace invitations; None when incomplete."""
    host, user, password, base = _mail_settings()
    outbox = os.environ.get('MAIL_OUTBOX_FILE', '').strip()
    if outbox and base:
        # Local development and automated tests only: write emails to a file instead of sending them.
        return {'outbox': outbox, 'sender': 'admin@trikosh.com', 'base': base}
    if not (host and user and password and base):
        return None
    return {'host': host, 'port': int(os.environ.get('SMTP_PORT', '587') or 587), 'user': user, 'password': password,
            'sender': os.environ.get('SMTP_FROM', '').strip() or user, 'base': base}


reset_config = mail_config


def mail_setup_help():
    """The exact settings an operator must add when email delivery is not configured."""
    host, user, password, base = _mail_settings()
    missing = [name for name, value in (('SMTP_HOST', host), ('SMTP_USER', user), ('SMTP_PASS', password), ('DOMAIN or PUBLIC_URL', base)) if not value]
    return ('Email delivery is not configured' + (f' (missing: {", ".join(missing)})' if missing else '') + '. '
            'In the .env file next to compose.yaml on the server, set SMTP_HOST=smtpout.secureserver.net, SMTP_PORT=587, '
            'SMTP_USER=admin@trikosh.com, SMTP_PASS=<mailbox password>, SMTP_FROM=admin@trikosh.com and DOMAIN=trikosh.com, '
            'then run: sudo docker compose up -d')


def send_email(config, to_address, subject, text):
    """Send one plain-text email. Raises on failure so callers decide what the user sees."""
    if config.get('outbox'):
        with open(config['outbox'], 'a', encoding='utf-8') as handle:
            handle.write(json.dumps({'to': to_address, 'subject': subject, 'text': text}) + '\n')
        return
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = f'Trikosh <{config["sender"]}>'
    message['To'] = to_address
    message.set_content(text)
    context = ssl.create_default_context()
    if config['port'] == 465:
        with smtplib.SMTP_SSL(config['host'], config['port'], context=context, timeout=20) as smtp:
            smtp.login(config['user'], config['password'])
            smtp.send_message(message)
    else:
        with smtplib.SMTP(config['host'], config['port'], timeout=20) as smtp:
            smtp.starttls(context=context)
            smtp.login(config['user'], config['password'])
            smtp.send_message(message)


def _send_reset_email(config, to_address, name, link):
    try:
        send_email(config, to_address, 'Reset your Trikosh password',
                   f'Hi {name},\n\nSomeone asked to reset the password for your Trikosh account. '
                   f'To choose a new password, open this link within {RESET_MINUTES} minutes:\n\n{link}\n\n'
                   'If you did not ask for this, ignore this email. Your password will not change.\n\n— Trikosh')
    except Exception as error:  # Never reveal delivery problems to the requester; log for the operator.
        print(f'Password reset email to {to_address} failed: {type(error).__name__}: {error}', flush=True)


def request_reset(core, db, identifier, client_ip):
    """Always returns the same response, whether or not the account exists."""
    config = mail_config()
    if not config:
        raise core.APIError('Password reset is not available yet. Contact admin@trikosh.com for help.', 503)
    if not isinstance(identifier, str) or not identifier.strip() or len(identifier) > 254:
        raise core.APIError('Enter your email or username.')
    identifier = identifier.strip().lower().lstrip('@')
    key = 'reset:' + hashlib.sha256((client_ip + identifier).encode()).hexdigest()
    attempt = db.execute('SELECT * FROM login_attempts WHERE key=? AND expires>?', (key, _now())).fetchone()
    if attempt and attempt['attempts'] >= RESET_REQUESTS_PER_HOUR:
        raise core.APIError('Too many reset requests. Please try again in an hour.', 429)
    db.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)', (key, (attempt['attempts'] if attempt else 0) + 1, (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()))
    column = 'email' if '@' in identifier else 'username'
    user = db.execute(f"SELECT id,name,email FROM users WHERE {column}=? AND email NOT LIKE '%@demo.invalid'", (identifier,)).fetchone()
    if user:
        token = secrets.token_urlsafe(32)
        db.execute('DELETE FROM password_resets WHERE user_id=? OR expires<?', (user['id'], _now()))
        db.execute('INSERT INTO password_resets(token_hash,user_id,expires,created_at) VALUES(?,?,?,?)',
                   (hashlib.sha256(token.encode()).hexdigest(), user['id'], (datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES)).isoformat(), _now()))
        link = f'{config["base"]}/reset?token={token}'
        # Send after the response path continues, so response time does not reveal whether the account exists.
        threading.Thread(target=_send_reset_email, args=(config, user['email'], user['name'], link), daemon=True).start()
    return {'ok': True, 'message': 'If an account matches, we have emailed a reset link. It expires in 30 minutes.'}


def complete_reset(core, db, token, password):
    if not isinstance(token, str) or not token or len(token) > 200:
        raise core.APIError('This reset link is invalid or has expired. Request a new one.')
    if not isinstance(password, str) or len(password) < 10 or len(password) > 256:
        raise core.APIError('Use a password with at least 10 characters.')
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = db.execute('SELECT user_id FROM password_resets WHERE token_hash=? AND expires>?', (token_hash, _now())).fetchone()
    if not row:
        raise core.APIError('This reset link is invalid or has expired. Request a new one.')
    db.execute('UPDATE users SET password=? WHERE id=?', (core.password_hash(password), row['user_id']))
    # Single use, and every existing session for this account is signed out.
    db.execute('DELETE FROM password_resets WHERE user_id=?', (row['user_id'],))
    db.execute('DELETE FROM sessions WHERE user_id=?', (row['user_id'],))
    core.audit(db, None, row['user_id'], 'account.password_reset', row['user_id'])
    return {'ok': True}


# ---- Workspace invitations (Household and Business) ----------------------------------------
# The owner enters the invitee's email. Trikosh emails a single-use, expiring link. Access is
# granted only when a signed-in user whose account email matches the invitation accepts it;
# receiving the link at that address is what verifies the email.
INVITE_DAYS = 7
INVITE_ROLES = ('member', 'viewer')


def _expire_invites(db, wid=None):
    sql = "UPDATE workspace_invites SET status='expired', token_hash=NULL WHERE status='pending' AND expires<?"
    if wid:
        db.execute(sql + ' AND workspace_id=?', (_now(), wid))
    else:
        db.execute(sql, (_now(),))


def _send_invite(core, db, invite, workspace, inviter_name):
    """Issue a fresh token and email it. Returns (ok, error message). Older links stop working."""
    config = mail_config()
    if not config:
        db.execute('UPDATE workspace_invites SET last_error=? WHERE id=?', ('Email delivery is not configured.', invite['id']))
        return False, mail_setup_help()
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=INVITE_DAYS)).isoformat()
    db.execute('UPDATE workspace_invites SET token_hash=?, expires=? WHERE id=?', (hashlib.sha256(token.encode()).hexdigest(), expires, invite['id']))
    link = f'{config["base"]}/invite?token={token}'
    text = (f'{inviter_name} has invited you to join {workspace["name"]} on Trikosh. Log in to see more.\n\n'
            f'Accept invitation: {link}\n\n'
            f'Sign in, or create an account, with this email address ({invite["email"]}) to accept. '
            f'The link works once and expires in {INVITE_DAYS} days. If you were not expecting this, you can ignore this email.\n\n- Trikosh')
    try:
        send_email(config, invite['email'], f'{inviter_name} invited you to {workspace["name"]} on Trikosh', text)
    except Exception as error:
        reason = f'{type(error).__name__}: {error}'[:300]
        print(f'Invitation email to {invite["email"]} failed: {reason}', flush=True)
        db.execute('UPDATE workspace_invites SET last_error=? WHERE id=?', (reason, invite['id']))
        return False, f'The invitation to {invite["email"]} was saved, but the email could not be sent ({reason}). Use Resend to try again.'
    db.execute("UPDATE workspace_invites SET sent_at=?, last_error='' WHERE id=?", (_now(), invite['id']))
    return True, ''


def create_invite(core, db, workspace, inviter, data):
    email = data.get('email')
    if not isinstance(email, str) or not email.strip():
        raise core.APIError("Enter the email address of the person you're inviting.")
    email = contact_email(core, email)
    role = data.get('role', 'member')
    if role not in INVITE_ROLES:
        raise core.APIError('Choose Member or Viewer.')
    existing = db.execute('SELECT members.user_id, members.role FROM members JOIN users ON users.id=members.user_id WHERE members.workspace_id=? AND users.email=?', (workspace['id'], email)).fetchone()
    if existing:
        # Already accepted: the owner can change their role without a new invitation.
        if existing['role'] == 'owner':
            raise core.APIError('You cannot change the owner role.')
        db.execute('UPDATE members SET role=? WHERE workspace_id=? AND user_id=?', (role, workspace['id'], existing['user_id']))
        core.audit(db, workspace['id'], inviter['user_id'], 'member.updated', existing['user_id'])
        return {'ok': True, 'access_granted': True, 'role_updated': True, 'role': role}, 200
    if not mail_config():
        raise core.APIError(mail_setup_help(), 503)
    _expire_invites(db, workspace['id'])
    if db.execute("SELECT 1 FROM workspace_invites WHERE workspace_id=? AND email=? AND status='pending'", (workspace['id'], email)).fetchone():
        raise core.APIError(f'An invitation to {email} is already pending. Use Resend in the list below to send it again.', 409)
    invite = {'id': core.uid(), 'email': email}
    db.execute('INSERT INTO workspace_invites(id,workspace_id,email,role,invited_by,created_at,expires) VALUES(?,?,?,?,?,?,?)',
               (invite['id'], workspace['id'], email, role, inviter['user_id'], _now(), _now()))
    core.audit(db, workspace['id'], inviter['user_id'], 'member.invited', invite['id'])
    sent, error = _send_invite(core, db, invite, workspace, inviter['name'])
    if not sent:
        db.commit()  # keep the pending invitation so the owner can retry
        raise core.APIError(error, 502)
    return {'ok': True, 'access_granted': False, 'invite': {'id': invite['id'], 'email': email, 'role': role, 'sent': True}}, 201


def resend_invite(core, db, workspace, inviter, invite_id):
    _expire_invites(db, workspace['id'])
    invite = db.execute("SELECT * FROM workspace_invites WHERE id=? AND workspace_id=? AND status IN ('pending','expired')", (invite_id, workspace['id'])).fetchone()
    if not invite:
        raise core.APIError('Invitation not found.', 404)
    if invite['status'] == 'expired':
        if db.execute("SELECT 1 FROM workspace_invites WHERE workspace_id=? AND email=? AND status='pending'", (workspace['id'], invite['email'])).fetchone():
            raise core.APIError(f'An invitation to {invite["email"]} is already pending.', 409)
        db.execute("UPDATE workspace_invites SET status='pending' WHERE id=?", (invite_id,))
    sent, error = _send_invite(core, db, invite, workspace, inviter['name'])
    if not sent:
        db.commit()
        raise core.APIError(error, 502 if mail_config() else 503)
    core.audit(db, workspace['id'], inviter['user_id'], 'member.invite_resent', invite_id)
    return {'ok': True, 'invite': {'id': invite_id, 'email': invite['email'], 'sent': True}}


def revoke_invite(db, wid, invite_id):
    return db.execute("UPDATE workspace_invites SET status='revoked', token_hash=NULL WHERE id=? AND workspace_id=? AND status IN ('pending','expired')", (invite_id, wid)).rowcount


def list_invites(db, wid):
    _expire_invites(db, wid)
    return [{'id': r['id'], 'email': r['email'], 'role': r['role'], 'pending': True, 'invite': True, 'status': r['status'],
             'expires': r['expires'], 'sent': bool(r['sent_at']), 'last_error': r['last_error']}
            for r in db.execute("SELECT * FROM workspace_invites WHERE workspace_id=? AND status IN ('pending','expired') ORDER BY created_at", (wid,))]


def _invite_by_token(db, token):
    if not isinstance(token, str) or not token or len(token) > 200:
        return None
    _expire_invites(db)
    return db.execute(
        'SELECT workspace_invites.*, workspaces.name AS workspace_name, workspaces.kind, users.name AS inviter_name '
        'FROM workspace_invites JOIN workspaces ON workspaces.id=workspace_invites.workspace_id '
        'JOIN users ON users.id=workspace_invites.invited_by '
        "WHERE token_hash=? AND status='pending'", (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()


INVALID_INVITE = 'This invitation link is invalid, already used or expired. Ask the workspace owner to resend it.'


def preview_invite(core, db, token):
    """What the recipient sees before signing in: enough to choose the right account, nothing more."""
    invite = _invite_by_token(db, token)
    if not invite:
        raise core.APIError(INVALID_INVITE, 404)
    return {'workspace_name': invite['workspace_name'], 'kind': invite['kind'], 'inviter': invite['inviter_name'],
            'email': invite['email'], 'account_type': account_type_for_kind(invite['kind']), 'role': invite['role']}


def accept_invite(core, db, session, token):
    invite = _invite_by_token(db, token)
    if not invite:
        raise core.APIError(INVALID_INVITE, 404)
    if (session['email'] or '').lower() != invite['email']:
        raise core.APIError(f'This invitation was sent to {invite["email"]}. Sign in with the account that uses that email address.', 403)
    user = session['user_id']
    needed = account_type_for_kind(invite['kind'])
    # Shared login: accepting grants the account type the workspace needs, so one login works for both.
    grant(db, user, needed, 'invite')
    db.execute("INSERT INTO members VALUES(?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=CASE WHEN members.role='owner' THEN 'owner' ELSE excluded.role END",
               (invite['workspace_id'], user, invite['role']))
    db.execute("UPDATE workspace_invites SET status='accepted', token_hash=NULL, accepted_by=?, accepted_at=? WHERE id=?", (user, _now(), invite['id']))
    db.execute("UPDATE users SET email_verified_at=? WHERE id=? AND email_verified_at=''", (_now(), user))
    core.audit(db, invite['workspace_id'], user, 'member.invite_accepted', invite['id'])
    return {'ok': True, 'workspace_id': invite['workspace_id'], 'workspace_name': invite['workspace_name'], 'kind': invite['kind'],
            'account_type': needed, 'switch_account_type': session['account_type'] != needed}
