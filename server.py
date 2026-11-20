"""Trikosh expense workspace. Run: python server.py"""
import argparse
import calendar
import csv
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import sys
import workspace_features as features
import business_expenses as business_fields
import accounts
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
DB_PATH = Path(os.environ.get('OPSMIND_DB', ROOT / 'data' / 'opsmind.db'))
COOKIE_SECURE = os.environ.get('OPSMIND_SECURE_COOKIE') == '1'
# Only enable behind a reverse proxy you control (e.g. nginx) that sets X-Real-IP.
TRUST_PROXY = os.environ.get('OPSMIND_TRUST_PROXY') == '1'
SESSION_SECONDS = 7 * 24 * 3600
KINDS = ('Personal', 'Household', 'Business')
CATEGORIES = ['Housing', 'Groceries', 'Dining', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Subscriptions', 'Education', 'Travel', 'Utilities', 'Salary', 'Other']
BUSINESS_CATEGORIES = business_fields.CATEGORIES
# Personal/Household "Spending pattern" and Business "Transaction Pattern" values (stored lowercase).
SPENDING_PATTERNS = ('regular', 'one-time', 'event', 'emergency', 'gift', 'travel', 'major purchase')
BUSINESS_PATTERNS = ('one-time', 'recurring', 'event', 'travel', 'monthly', 'purchase', 'other')
# Patterns that count as the everyday/regular baseline in analytics and forecasts.
REGULAR_PATTERNS = ('regular', 'recurring', 'monthly')
# Older clients may still send Personal-style values to Business; map them so regular/exceptional totals are unchanged.
LEGACY_BUSINESS_PATTERNS = {'regular': 'recurring', 'major purchase': 'purchase', 'emergency': 'other', 'gift': 'other'}


def counted(row):
    """One policy everywhere: an expense counts in spending totals unless its approval is pending or rejected."""
    return row['kind'] == 'expense' and not row.get('excluded_from_totals')
GOAL_TYPES = ('savings', 'fd', 'rd')  # general savings, Fixed Deposit, Recurring Deposit


@contextmanager
def connect():
    db = sqlite3.connect(DB_PATH, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        pending = accounts.needs_migration(db)
    if pending:
        saved = accounts.backup(DB_PATH, 'accounts-migration')
        if saved:
            print(f'Database backed up to {saved} before the account migration.', flush=True)
    with connect() as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', demo INTEGER NOT NULL DEFAULT 0, settings TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE IF NOT EXISTS members(workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, PRIMARY KEY(workspace_id,user_id));
        CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(workspace_id,name));
        CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), kind TEXT NOT NULL, merchant TEXT NOT NULL, category TEXT NOT NULL, payment TEXT NOT NULL, classification TEXT NOT NULL, essential INTEGER NOT NULL DEFAULT 0, owner TEXT NOT NULL DEFAULT 'Shared', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS transaction_scope ON transactions(workspace_id,date);
        CREATE TABLE IF NOT EXISTS budgets(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, month TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), UNIQUE(workspace_id,month,category));
        CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), cadence TEXT NOT NULL, renewal TEXT NOT NULL, category TEXT NOT NULL, owner TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active');
        CREATE TABLE IF NOT EXISTS goals(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, target INTEGER NOT NULL CHECK(target > 0), saved INTEGER NOT NULL DEFAULT 0, due TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id), action TEXT NOT NULL, record_id TEXT, timestamp TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, category TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
        ''')
        features.migrate(db)
        business_fields.migrate(db, sys.modules[__name__])
        if 'workspace_kind' not in {row['name'] for row in db.execute('PRAGMA table_info(sessions)')}:
            db.execute('ALTER TABLE sessions ADD COLUMN workspace_kind TEXT')
        accounts.migrate(db)
        for workspace in db.execute('SELECT id,kind FROM workspaces WHERE demo=1').fetchall():
            features.seed(db, sys.modules[__name__], workspace['id'], workspace['kind'])


def uid():
    return secrets.token_hex(12)


def now():
    return datetime.now(timezone.utc).isoformat()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ':' + digest


class APIError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


def string(data, key, default=None, limit=160):
    value = data.get(key, default)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise APIError(f'{key.replace("_", " ").capitalize()} is required (maximum {limit} characters).')
    return value.strip()


def money(value, allow_zero=False):
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number < 0 or (number == 0 and not allow_zero) or number > 1000000000 or number != number.quantize(Decimal('.01')):
            raise InvalidOperation
        return int(number * 100)
    except (InvalidOperation, ValueError, TypeError):
        raise APIError('Enter a valid amount with at most two decimal places.')


def valid_date(value):
    try:
        if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError
        return date.fromisoformat(value).isoformat()
    except (ValueError, TypeError):
        raise APIError('Enter a valid date (YYYY-MM-DD).')


def valid_month(value):
    valid_date(value + '-01')
    return value


def choice(data, key, choices, default=None):
    value = data.get(key, default)
    if value not in choices:
        raise APIError(f'Invalid {key}.')
    return value


def audit(db, wid, user, action, record):
    db.execute('INSERT INTO audit_log VALUES(?,?,?,?,?,?)', (uid(), wid, user, action, record, now()))


def create_workspace(db, user, data, demo=False):
    name = string(data, 'name')
    kind = choice(data, 'kind', KINDS)
    currency = choice(data, 'currency', ('INR', 'USD', 'EUR', 'GBP'), 'INR')
    settings = data.get('settings', {})
    if not isinstance(settings, dict):
        raise APIError('Invalid workspace settings.')
    settings = features.settings(sys.modules[__name__], settings)
    wid = uid()
    db.execute('INSERT INTO workspaces VALUES(?,?,?,?,?,?)', (wid, name, kind, currency, int(demo), json.dumps(settings)))
    db.execute('INSERT INTO members VALUES(?,?,?)', (wid, user, 'owner'))
    for category in BUSINESS_CATEGORIES if kind == 'Business' else CATEGORIES:
        db.execute('INSERT INTO categories VALUES(?,?,?)', (uid(), wid, category))
    if kind == 'Business':
        business_fields.ensure_catalog(db, sys.modules[__name__], wid)
    if data.get('budget'):
        db.execute('INSERT INTO budgets VALUES(?,?,?,?,?)', (uid(), wid, date.today().strftime('%Y-%m'), 'Overall', money(data['budget'])))
    audit(db, wid, user, 'workspace.created', wid)
    return wid


def seed_workspace(db, wid, kind):
    """Reproducible, six-month synthetic records. No real client information."""
    today = date.today()
    for category in BUSINESS_CATEGORIES if kind == 'Business' else CATEGORIES:
        db.execute('INSERT OR IGNORE INTO categories VALUES(?,?,?)', (uid(), wid, category))
    multiplier = 1 if kind == 'Personal' else 2 if kind == 'Household' else 7
    templates = [('Rent / home', 'Housing', 15000, 2), ('Fresh basket', 'Groceries', 1850, 5), ('The Daily Brew', 'Dining', 420, 7), ('Metro & cab', 'Transport', 780, 9), ('Green Market', 'Groceries', 2300, 12), ('Weekend table', 'Dining', 1250, 15), ('City pharmacy', 'Health', 640, 18), ('Studio Store', 'Shopping', 2400, 21), ('Electricity bill', 'Utilities', 1600, 23), ('Fresh basket', 'Groceries', 1650, 25), ('The Daily Brew', 'Dining', 680, 26), ('Movie night', 'Entertainment', 900, 28)]
    if kind == 'Business':
        templates = [('Studio rent', 'Office', 15000, 2), ('Cloud infrastructure', 'Software', 2200, 5), ('Search campaign', 'Marketing', 3200, 7), ('Client visit', 'Travel', 1850, 9), ('Design partner', 'Professional services', 4200, 12), ('Team payroll', 'Payroll', 27000, 15), ('Workspace tools', 'Software', 950, 18), ('Office supplies', 'Office', 1400, 21), ('Internet & power', 'Utilities', 1600, 23), ('Social campaign', 'Marketing', 2400, 25), ('Client workshop', 'Travel', 1250, 26), ('Contractor payout', 'Professional services', 3400, 28)]
    for offset in range(5, -1, -1):
        serial = today.year * 12 + today.month - 1 - offset
        year, month = divmod(serial, 12)
        month += 1
        last = calendar.monthrange(year, month)[1]
        month_key = f'{year:04}-{month:02}'
        for index, (merchant, category, amount, day) in enumerate(templates):
            txdate = date(year, month, min(day, last))
            if txdate > today:
                continue
            cents = (amount + (index % 3) * (5 - offset) * 35) * multiplier * 100
            owner = ['Aarav', 'Priya', 'Ishaan', 'Anya'][index % 4] if kind == 'Household' else ['Engineering', 'Marketing', 'Operations'][index % 3] if kind == 'Business' else 'Me'
            db.execute('INSERT INTO transactions(id,workspace_id,date,amount,kind,merchant,category,payment,classification,essential,owner,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (uid(), wid, txdate.isoformat(), cents, 'expense', merchant, category, ['UPI', 'Credit card', 'Bank transfer'][index % 3], 'recurring' if kind == 'Business' else 'regular', int(index % 3 != 2), owner, 'Synthetic demo transaction', now()))
        income = (75000 if kind == 'Personal' else 140000 if kind == 'Household' else 950000) * 100
        db.execute('INSERT INTO transactions(id,workspace_id,date,amount,kind,merchant,category,payment,classification,essential,owner,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (uid(), wid, month_key + '-01', income, 'income', 'Client receipts' if kind == 'Business' else 'Monthly salary', 'Revenue' if kind == 'Business' else 'Salary', 'Bank transfer', 'recurring' if kind == 'Business' else 'regular', 1, 'Shared' if kind == 'Household' else 'Me', 'Synthetic demo income', now()))
        if offset == 0 and today.day >= 11:
            db.execute('INSERT INTO transactions(id,workspace_id,date,amount,kind,merchant,category,payment,classification,essential,owner,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', (uid(), wid, month_key + '-11', 850000 * multiplier, 'expense', 'Team offsite' if kind == 'Business' else 'Family celebration' if kind == 'Household' else 'Weekend getaway', 'Travel', 'Credit card', 'event', 0, 'Shared' if kind == 'Household' else 'Me', 'One-off demo expense, excluded from regular baseline', now()))
        budget = 50000 if kind == 'Personal' else 100000 if kind == 'Household' else 600000
        db.execute('INSERT INTO budgets VALUES(?,?,?,?,?)', (uid(), wid, month_key, 'Overall', budget * 100))
        for category, amount in ([('Software', 35000), ('Marketing', 40000), ('Travel', 25000), ('Office', 125000)] if kind == 'Business' else [('Groceries', 7000 * multiplier), ('Dining', 3000 * multiplier), ('Shopping', 4500 * multiplier), ('Travel', 7000 * multiplier)]):
            db.execute('INSERT INTO budgets VALUES(?,?,?,?,?)', (uid(), wid, month_key, category, amount * 100))
    subs = [('Figma', 2400, 'Software'), ('Cloud hosting', 5600, 'Software'), ('Notion', 1800, 'Software')] if kind == 'Business' else [('Netflix', 649, 'Subscriptions'), ('Spotify', 119, 'Subscriptions'), ('iCloud+', 75, 'Subscriptions')]
    for index, (name, amount, category) in enumerate(subs):
        db.execute('INSERT INTO subscriptions VALUES(?,?,?,?,?,?,?,?,?)', (uid(), wid, name, amount * 100, 'monthly', (today + timedelta(days=3 + index * 5)).isoformat(), category, 'Operations' if kind == 'Business' else 'Me', 'active'))
    if kind != 'Business':
        for name, target, saved, days in [('Emergency fund', 300000, 184000, 240), ('Japan getaway', 180000, 62500, 180), ('New home', 1000000, 320000, 720)]:
            db.execute('INSERT INTO goals(id,workspace_id,name,target,saved,due) VALUES(?,?,?,?,?,?)', (uid(), wid, name, target * 100, saved * 100, (today + timedelta(days=days)).isoformat()))
    features.seed(db, sys.modules[__name__], wid, kind)


def public_workspace(row):
    item = dict(row)
    item['settings'] = json.loads(item['settings'])
    return item


def filtered_transactions(db, wid, query, user=None):
    clauses, params = ['workspace_id=?'], [wid]
    if query.get('month'):
        clauses.append('substr(date,1,7)=?')
        params.append(valid_month(query['month']))
    for key, comparison in [('from', '>='), ('to', '<=')]:
        if query.get(key):
            clauses.append(f'date {comparison} ?')
            params.append(valid_date(query[key]))
    rows = features.visible_rows(db.execute('SELECT * FROM transactions WHERE ' + ' AND '.join(clauses) + ' ORDER BY date DESC, created_at DESC', params), user)
    # Apply detail filters after redaction to prevent private-value inference.
    approvals = {r[0]: r[1] for r in db.execute("SELECT id,status FROM workspace_items WHERE workspace_id=? AND type='approval'", (wid,))}
    for row in rows:
        row['approval_status'] = approvals.get(row.get('approval_id') or '', '')
        row['excluded_from_totals'] = row['approval_status'] in ('pending', 'rejected')
    for key in ('category', 'kind', 'classification', 'payment', 'owner', 'event_id', 'project_id', 'dependent_id', 'vendor_id', 'subscription_id', 'approval_status'):
        if query.get(key):
            rows = [r for r in rows if r[key] == query[key]]
    # Vendor/SaaS drill-downs list exactly the rows the Vendor & SaaS totals count.
    if query.get('vendor_link') in ('linked', 'none'):
        linked = query['vendor_link'] == 'linked'
        rows = [r for r in rows if counted(r) and bool(r['vendor_id'] or r['subscription_id']) == linked]
    if query.get('spent_by'):
        if query['spent_by'] == 'unassigned':
            current = {m[0] for m in db.execute('SELECT user_id FROM members WHERE workspace_id=?', (wid,))}
            rows = [r for r in rows if not r.get('redacted') and r['spent_by'] not in current]
        else:
            rows = [r for r in rows if r['spent_by'] == query['spent_by']]
    if query.get('q'):
        term = query['q'].lower()
        rows = [r for r in rows if any(term in r[key].lower() for key in ('merchant','notes','category')) or any(term in str(business_fields.decode(r['business']).get(key,'')).lower() for key in business_fields.TEXT_FIELDS)]
    for row in rows:
        row['business'] = business_fields.decode(row['business'])
    for key in ('reimbursement','accounting_type','paid_by'):
        if query.get(key):
            rows=[r for r in rows if r['business'][key]==query[key]]
    if query.get('billable') in ('true','false'):
        rows=[r for r in rows if r['business']['billable']==(query['billable']=='true')]
    return rows


def overview(db, wid, query, user=None):
    month = valid_month(query.get('month') or date.today().strftime('%Y-%m'))
    rows = filtered_transactions(db, wid, {**query, 'month': month}, user)
    expenses = [r for r in rows if counted(r)]
    spend = sum(r['amount'] for r in expenses)
    income = sum(r['amount'] for r in rows if r['kind'] == 'income')
    regular = sum(r['amount'] for r in expenses if r['classification'] in REGULAR_PATTERNS)
    cats, owners = {}, {}
    for row in expenses:
        cats[row['category']] = cats.get(row['category'], 0) + row['amount']
        owners[row['owner']] = owners.get(row['owner'], 0) + row['amount']
    budgets = [dict(r) for r in db.execute('SELECT * FROM budgets WHERE workspace_id=? AND month=? ORDER BY category', (wid, month))]
    for budget in budgets:
        budget['spent'] = spend if budget['category'] == 'Overall' else cats.get(budget['category'], 0)
    overall = next((b['amount'] for b in budgets if b['category'] == 'Overall'), 0)
    year, mon = map(int, month.split('-'))
    days = calendar.monthrange(year, mon)[1]
    elapsed = date.today().day if month == date.today().strftime('%Y-%m') else days if month < date.today().strftime('%Y-%m') else 0
    daily = [{'day': day, 'expense': sum(r['amount'] for r in expenses if int(r['date'][-2:]) == day), 'income': sum(r['amount'] for r in rows if r['kind'] == 'income' and int(r['date'][-2:]) == day)} for day in range(1, days + 1)]
    forecast = round(regular / elapsed * days + spend - regular) if elapsed else None
    previous = date(year, mon, 1) - timedelta(days=1)
    prevrows = filtered_transactions(db, wid, {**query, 'month': previous.strftime('%Y-%m')}, user)
    # Current month: same elapsed days. Completed month: the whole previous month (it may be longer).
    cutoff = elapsed if month == date.today().strftime('%Y-%m') else 31 if elapsed else 0
    previous_spend = sum(r['amount'] for r in prevrows if counted(r) and int(r['date'][-2:]) <= cutoff)
    # Member spending uses each expense's "Spent by" member ID (not who created the record).
    # Other members' private records are already excluded; amount-only records hide the member.
    # Expenses with no "Spent by", or one pointing at a former member, are "Unassigned" (never guessed).
    member_rows = db.execute("SELECT users.id,users.name,users.username FROM members JOIN users ON users.id=members.user_id WHERE members.workspace_id=? ORDER BY members.role='owner' DESC, users.name", (wid,)).fetchall()
    member_ids = {m['id'] for m in member_rows}
    unassigned = [r for r in expenses if not r.get('redacted') and r['spent_by'] not in member_ids]
    member_spending = {'members': [{'id': m['id'], 'name': m['name'], 'username': m['username'], 'amount': sum(r['amount'] for r in expenses if r['spent_by'] == m['id'])} for m in member_rows],
                       'private': sum(r['amount'] for r in expenses if r.get('redacted')),
                       'unattributed': sum(r['amount'] for r in unassigned), 'unassigned_count': len(unassigned)}
    return {'month': month, 'spend': spend, 'income': income, 'balance': income - spend, 'regular': regular, 'exceptional': sum(r['amount'] for r in expenses if r['classification'] != 'regular' and not r.get('redacted')), 'private_amount': sum(r['amount'] for r in expenses if r.get('redacted')), 'discretionary': sum(r['amount'] for r in expenses if r['essential'] == 0), 'essential': sum(r['amount'] for r in expenses if r['essential']), 'savings_rate': round((income - spend) / income * 100, 1) if income else None, 'budget': overall, 'remaining': overall - spend if overall else None, 'forecast': forecast, 'forecast_basis': f'Regular spend / {elapsed} elapsed days × {days} days, plus posted exceptional spend. Excludes future commitments; estimate, not a guarantee.' if elapsed else 'Forecast unavailable for a future period.', 'previous_spend': previous_spend, 'change': round((spend - previous_spend) / previous_spend * 100, 1) if previous_spend else None, 'categories': sorted([{'name': k, 'amount': v} for k, v in cats.items()], key=lambda x: -x['amount']), 'owners': [{'name': k, 'amount': v} for k, v in owners.items()], 'member_spending': member_spending, 'daily': daily, 'budgets': budgets, 'transactions': rows, 'count': len(rows)}


class Handler(BaseHTTPRequestHandler):
    server_version = 'Trikosh/1.0'

    def log_message(self, format, *args):
        # Deliberately avoid logging bodies, cookies, and query strings.
        pass

    def respond(self, data, status=200, content_type='application/json', headers=None):
        body = json.dumps(data).encode() if content_type == 'application/json' else data if isinstance(data, bytes) else data.encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 65536:
                raise APIError('Request is too large.', 413)
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                raise APIError('Expected JSON request.', 415)
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError
            return data
        except (ValueError, UnicodeDecodeError):
            raise APIError('Invalid JSON request.')

    def session_token(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get('Cookie', ''))
            token = cookie.get('opsmind_session')
            return token.value if token else ''
        except Exception:
            return ''

    def session(self, db):
        # A session is valid only while the user still holds the account type it was opened with.
        # Sessions created before account types existed (account_type NULL) must sign in again.
        token = self.session_token()
        session = db.execute('''SELECT sessions.*,users.name,users.email,users.username FROM sessions
            JOIN users ON users.id=sessions.user_id
            JOIN account_access ON account_access.user_id=sessions.user_id AND account_access.account_type=sessions.account_type
            WHERE token=? AND expires>?''', (hashlib.sha256(token.encode()).hexdigest(), now())).fetchone()
        if not session:
            raise APIError('Please sign in to continue.', 401)
        if self.command != 'GET' and not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), session['csrf']):
            raise APIError('Session verification failed. Reload and try again.', 403)
        return session

    def access(self, db, wid, session, write=False, owner=False):
        row = db.execute('SELECT workspaces.*,members.role FROM workspaces JOIN members ON members.workspace_id=workspaces.id WHERE workspaces.id=? AND members.user_id=?', (wid, session['user_id'])).fetchone()
        # Membership alone is not enough: the workspace must belong to the signed-in account type.
        if not row or row['kind'] not in accounts.allowed_kinds(session['account_type']):
            raise APIError('Workspace not found.', 404)
        # Personal records are private to their owner, regardless of any membership row.
        if row['kind'] == 'Personal' and row['role'] != 'owner':
            raise APIError('Workspace not found.', 404)
        if (write and row['role'] == 'viewer') or (owner and row['role'] != 'owner'):
            raise APIError('Your workspace role does not allow this action.', 403)
        return row

    def client_ip(self):
        if TRUST_PROXY and self.headers.get('X-Real-IP'):
            return self.headers['X-Real-IP'].strip()
        return self.client_address[0]

    def new_session(self, db, user, account_type):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        db.execute('DELETE FROM sessions WHERE expires < ?', (now(),))
        db.execute('INSERT INTO sessions(token,user_id,csrf,expires,account_type) VALUES(?,?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user, csrf, (datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)).isoformat(), account_type))
        return {'csrf': csrf, 'account_type': account_type}, {'Set-Cookie': f'opsmind_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_SECONDS}' + ('; Secure' if COOKIE_SECURE else '')}

    def clear_cookie(self):
        return {'Set-Cookie': 'opsmind_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' + ('; Secure' if COOKIE_SECURE else ''), 'Clear-Site-Data': '"cache"'}

    def handle_request(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            if not path.startswith('/api/'):
                if self.command != 'GET':
                    raise APIError('Method not allowed.', 405)
                assets = {'/': 'index.html', '/login': 'index.html', '/reset': 'index.html', '/invite': 'index.html', '/app.js': 'app.js', '/dashboards.js': 'dashboards.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg', '/Trikosh_logo.png': 'Trikosh_logo.png', '/Trikosh_mark.png': 'Trikosh_mark.png'}
                if path not in assets:
                    raise APIError('Page not found.', 404)
                asset = ROOT / 'static' / assets[path]
                mime = {'js': 'text/javascript', 'css': 'text/css', 'html': 'text/html', 'svg': 'image/svg+xml', 'png': 'image/png'}[asset.suffix[1:]]
                return self.respond(asset.read_bytes(), content_type=mime + '; charset=utf-8')
            with connect() as db:
                result, status, headers, mime = self.api(db, path, query)
            self.respond(result, status, mime, headers)
        except APIError as error:
            self.respond({'error': error.message}, error.status)
        except sqlite3.IntegrityError:
            self.respond({'error': 'This record already exists or conflicts with another record.'}, 409)
        except Exception as error:
            print(f'Server error: {type(error).__name__}: {error}', flush=True)
            self.respond({'error': 'Something went wrong. Please try again.'}, 500)

    do_GET = handle_request
    do_POST = handle_request
    do_PUT = handle_request
    do_DELETE = handle_request

    def api(self, db, path, query):
        method = self.command
        def result(data, status=200, headers=None, mime='application/json'):
            return data, status, headers, mime
        if path == '/api/health' and method == 'GET':
            # Proves the database file is reachable and the schema is readable (used by the container health check).
            db.execute('SELECT 1 FROM users LIMIT 1').fetchall()
            return result({'status': 'ok', 'database': 'ok'})
        if path in ('/api/auth/login', '/api/auth/signup', '/api/auth/demo') and method == 'POST':
            data = self.body()
            account_type = accounts.normalize_account_type(data)
            if path.endswith('/demo'):
                account_type = account_type or ('personal_household' if 'account_type' not in data and 'workspace_kind' not in data else None)
            if not account_type:
                raise APIError('Choose Personal / Household or Business.')
            if path.endswith('/demo'):
                user = uid()
                db.execute('INSERT INTO users(id,name,email,password,username,created_at) VALUES(?,?,?,?,?,?)', (user, 'Alex Morgan', f'{user}@demo.invalid', password_hash(secrets.token_urlsafe(32)), 'demo-' + user[:12], now()))
                accounts.link_identity(db, accounts.LOCAL_PROVIDER, user, user, None)
                accounts.grant(db, user, account_type, 'demo')
                for kind in accounts.allowed_kinds(account_type):
                    wid = create_workspace(db, user, {'name': kind, 'kind': kind, 'settings': {'members': 'Aarav, Priya, Ishaan, Anya', 'departments': 'Engineering, Marketing, Operations'}}, True)
                    seed_workspace(db, wid, kind)
            elif path.endswith('/signup'):
                email = string(data, 'email', limit=254).lower()
                if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                    raise APIError('Enter a valid email address.')
                name = string(data, 'name')
                username = accounts.clean_username(sys.modules[__name__], data.get('username'))
                string(data, 'password', limit=256)
                password = data['password']
                if len(password) < 10:
                    raise APIError('Use a password with at least 10 characters.')
                if accounts.username_taken(db, username):
                    raise APIError('That username is already taken. Choose another.', 409)
                if db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
                    raise APIError('An account with this email already exists. Sign in instead.', 409)
                user = uid()
                db.execute('INSERT INTO users(id,name,email,password,username,created_at) VALUES(?,?,?,?,?,?)', (user, name, email, password_hash(password), username, now()))
                # The local provider's stable subject is the internal user ID.
                accounts.link_identity(db, accounts.LOCAL_PROVIDER, user, user, email)
                accounts.grant(db, user, account_type, 'signup')
                audit(db, None, user, 'account.created:' + account_type, user)
            else:
                identifier = data.get('identifier', data.get('email'))
                if not isinstance(identifier, str) or not identifier.strip() or len(identifier) > 254:
                    raise APIError('Enter your email or username.')
                identifier = identifier.strip().lower().lstrip('@')
                if not isinstance(data.get('password'), str) or not data['password']:
                    raise APIError('Enter your password.')
                string(data, 'password', limit=256)
                password = data['password']
                key = hashlib.sha256((self.client_ip() + identifier).encode()).hexdigest()
                attempt = db.execute('SELECT * FROM login_attempts WHERE key=? AND expires>?', (key, now())).fetchone()
                if attempt and attempt['attempts'] >= 10:
                    raise APIError('Too many login attempts. Please try again in 15 minutes.', 429)
                column = 'email' if '@' in identifier else 'username'
                record = db.execute(f"SELECT * FROM users WHERE {column}=? AND email NOT LIKE '%@demo.invalid'", (identifier,)).fetchone()
                stored = record['password'] if record else '00' * 16 + ':' + '00' * 64
                if not hmac.compare_digest(password_hash(password, stored.split(':')[0]), stored):
                    db.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)', (key, (attempt['attempts'] if attempt else 0) + 1, (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()))
                    db.commit()
                    raise APIError('Email, username or password is incorrect.', 401)
                db.execute('DELETE FROM login_attempts WHERE key=?', (key,))
                user = record['id']
                granted = accounts.access_types(db, user)
                if account_type not in granted:
                    # Credentials are valid, but the dropdown cannot grant access. No session is created.
                    db.commit()
                    actual = ' or '.join(accounts.LABELS[t] for t in granted) or 'no account type'
                    raise APIError(f'This account does not have {accounts.LABELS[account_type]} access. It is registered as {actual}. Select {actual} and sign in again.', 403)
            session, headers = self.new_session(db, user, account_type)
            return result(session, 200, headers)
        if path == '/api/auth/config' and method == 'GET':
            # Lets the login page show "Forgot password?" only when reset emails can actually be sent.
            return result({'password_reset': accounts.mail_config() is not None})
        if path == '/api/auth/forgot' and method == 'POST':
            data = self.body()
            return result(accounts.request_reset(sys.modules[__name__], db, data.get('identifier'), self.client_ip()))
        if path == '/api/auth/reset' and method == 'POST':
            data = self.body()
            return result(accounts.complete_reset(sys.modules[__name__], db, data.get('token'), data.get('password')))
        if path == '/api/auth/logout' and method == 'POST':
            # Logout always clears the cookie, even if the session already expired.
            token = hashlib.sha256(self.session_token().encode()).hexdigest()
            existing = db.execute('SELECT csrf FROM sessions WHERE token=?', (token,)).fetchone()
            if existing:
                if not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), existing['csrf']):
                    raise APIError('Session verification failed. Reload and try again.', 403)
                db.execute('DELETE FROM sessions WHERE token=?', (token,))
            return result({'ok': True}, headers=self.clear_cookie())
        if path == '/api/invites/preview' and method == 'GET':
            return result(accounts.preview_invite(sys.modules[__name__], db, query.get('token')))
        session = self.session(db)
        if path == '/api/feedback' and method == 'POST':
            data = self.body()
            category = choice(data, 'category', ('suggestion', 'issue', 'other'))
            message = string(data, 'message', limit=2000)
            config = accounts.mail_config()
            if not config:
                raise APIError('Feedback email is unavailable. Please email admin@trikosh.com directly.', 503)
            try:
                accounts.send_email(config, 'admin@trikosh.com', f'Trikosh feedback: {category}',
                                    f"From: {session['name']} (@{session['username']})\nEmail: {accounts.public_email(session['email']) or 'Not available'}\n\n{message}")
            except Exception as error:
                print(f'Feedback email failed: {type(error).__name__}: {error}', flush=True)
                raise APIError('Could not send feedback. Please try again or email admin@trikosh.com directly.', 502)
            db.execute('INSERT INTO feedback VALUES(?,?,?,?,?)', (uid(), session['user_id'], category, message, now()))
            return result({'ok': True}, 201)
        user = session['user_id']
        if path == '/api/invites/accept' and method == 'POST':
            return result(accounts.accept_invite(sys.modules[__name__], db, session, self.body().get('token')))
        account_type = session['account_type']
        if path == '/api/auth/me' and method == 'GET':
            workspaces = [public_workspace(r) for r in db.execute('SELECT workspaces.*,members.role FROM workspaces JOIN members ON members.workspace_id=workspaces.id WHERE members.user_id=? ORDER BY workspaces.rowid', (user,))]
            workspaces = [w for w in workspaces if w['kind'] in accounts.allowed_kinds(account_type) and (w['kind'] != 'Personal' or w['role'] == 'owner')]
            demo = session['email'].endswith('@demo.invalid')
            return result({'user': {'id': user, 'name': session['name'], 'email': accounts.public_email(session['email']), 'username': session['username'], 'demo': demo},
                           'csrf': session['csrf'], 'account_type': account_type, 'account_type_label': accounts.LABELS[account_type],
                           'kinds': list(accounts.allowed_kinds(account_type)), 'needs_username': not session['username'], 'workspaces': workspaces})
        if path == '/api/auth/username' and method == 'POST':
            if session['username']:
                raise APIError('Your username is already set.', 409)
            username = accounts.clean_username(sys.modules[__name__], self.body().get('username'))
            if accounts.username_taken(db, username):
                raise APIError('That username is already taken. Choose another.', 409)
            db.execute('UPDATE users SET username=? WHERE id=? AND username IS NULL', (username, user))
            return result({'username': username})
        if path == '/api/workspaces' and method == 'POST':
            data = self.body()
            if data.get('kind') not in accounts.allowed_kinds(account_type):
                raise APIError(f'{accounts.LABELS[account_type]} accounts cannot create {data.get("kind", "that")} workspaces.', 403)
            return result({'id': create_workspace(db, user, data)}, 201)
        match = re.fullmatch(r'/api/workspaces/([a-f0-9]+)/([a-z-]+)(?:/([a-f0-9]+))?', path)
        if not match:
            raise APIError('Endpoint not found.', 404)
        wid, resource, record_id = match.groups()
        workspace = self.access(db, wid, session, method != 'GET', resource in ('reset', 'members', 'settings'))
        if resource == 'dashboard' and method == 'GET':
            return result(features.dashboard(db, sys.modules[__name__], workspace, user, query))
        if resource == 'planning':
            data = self.body() if method in ('POST','PUT') else {}
            return result(features.planning_api(db, sys.modules[__name__], workspace, user, method, record_id, data), 201 if method=='POST' else 200)
        if resource == 'approval-submissions' and method == 'POST' and not record_id:
            return result(features.submit_for_approval(db, sys.modules[__name__], workspace, user, self.body()), 201)
        if resource == 'subscription-payments' and method == 'POST' and not record_id:
            result_data = features.record_subscription_payment(db, sys.modules[__name__], workspace, user, self.body())
            return result(result_data, 201 if result_data['created'] else 200)
        if resource == 'overview' and method == 'GET':
            return result(overview(db, wid, query, user))
        if resource == 'export' and method == 'GET':
            rows = filtered_transactions(db, wid, query, user)
            output = io.StringIO(newline='')
            fields = ['id', 'date', 'kind', 'merchant', 'category', 'amount', 'currency', 'payment', 'classification', 'essential', 'owner', 'notes']
            if workspace['kind']=='Business':
                fields += ['invoice_reference','business_purpose','cost_center','employee','paid_by','reimbursement','billable','billable_client','accounting_type','tax_amount','net_amount','project_id','approval_status']
            writer = csv.DictWriter(output, fieldnames=fields, extrasaction='ignore')
            writer.writeheader()
            for row in rows:
                if workspace['kind']=='Business':
                    details=row['business']
                    row.update(details)
                    row['net_amount']=f'{Decimal(row["amount"]-details["tax_amount"])/100:.2f}'
                    row['tax_amount']=f'{Decimal(details["tax_amount"])/100:.2f}'
                row['amount'] = f'{Decimal(row["amount"]) / 100:.2f}'
                row['currency'] = workspace['currency']
                row = {k: "'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else v for k, v in row.items()}
                writer.writerow(row)
            return result('\ufeff' + output.getvalue(), headers={'Content-Disposition': 'attachment; filename="trikosh-transactions.csv"'}, mime='text/csv; charset=utf-8')
        if resource == 'insights' and method in ('GET', 'POST'):
            question = string(self.body(), 'question', limit=500) if method == 'POST' else ''
            summary = overview(db, wid, query, user)
            if workspace['kind'] == 'Business' and not any(query.get(k) for k in ('category','kind','classification','payment','owner','q','from','to','event_id','project_id','accounting_type','paid_by','reimbursement','billable')):
                business = features.dashboard(db, sys.modules[__name__], workspace, user, query)
                summary['forecast'] = business['forecast']
                summary['forecast_basis'] = business['forecast_basis']
            currency = workspace['currency']
            def fmt(amount):
                return f'{currency} {amount / 100:,.2f}'
            evidence = [r['id'] for r in summary['transactions'] if counted(r)]
            insights = []
            if summary['spend']:
                top = summary['categories'][0]
                insights.append({'title': f'{top["name"]} leads your spending', 'text': f'{fmt(top["amount"])} across {summary["month"]}, or {top["amount"] / summary["spend"] * 100:.0f}% of recorded expenses.', 'category': top['name'], 'tone': 'purple', 'evidence': [r['id'] for r in summary['transactions'] if r['kind'] == 'expense' and r['category'] == top['name']]})
                if summary['exceptional']:
                    insights.append({'title': 'Your everyday baseline, separated', 'text': f'{fmt(summary["exceptional"])} is exceptional spending. Your regular spend is {fmt(summary["regular"])}.', 'tone': 'blue', 'evidence': evidence})
                if summary['budget'] and summary['forecast'] is not None:
                    delta = summary['budget'] - summary['forecast']
                    insights.append({'title': 'Room in your monthly plan' if delta >= 0 else 'Your budget may need attention', 'text': f'Estimated month-end spend: {fmt(summary["forecast"])}. That is {fmt(abs(delta))} {"below" if delta >= 0 else "above"} your budget.', 'tone': 'green' if delta >= 0 else 'amber', 'evidence': evidence, 'basis': summary['forecast_basis']})
            answer = 'There are no matching transactions for this period. Add a transaction or choose another month.'
            if summary['count']:
                lower = question.lower()
                if any(word in lower for word in ('forecast', 'next', 'predict')):
                    answer = f'Estimated month-end spend is {fmt(summary["forecast"])}. {summary["forecast_basis"]}' if summary['forecast'] is not None else summary['forecast_basis']
                elif any(word in lower for word in ('save', 'saving', 'balance', 'income')):
                    answer = f'Recorded income is {fmt(summary["income"])} and expenses are {fmt(summary["spend"])}. The difference is {fmt(summary["balance"])}. This is a period cash-flow difference, not your bank balance.'
                elif any(word in lower for word in ('budget', 'remaining')):
                    answer = f'Your budget is {fmt(summary["budget"])}. Recorded expenses are {fmt(summary["spend"])}; remaining budget is {fmt(summary["remaining"])}.' if summary['budget'] else 'No overall budget is set for this month. Create one in Budgets.'
                elif not question or any(word in lower for word in ('spend', 'spent', 'expense', 'why', 'where', 'summary', 'exception', 'regular')):
                    answer = f'In {summary["month"]}, recorded expenses total {fmt(summary["spend"])} across {len(evidence)} transactions. Regular spend is {fmt(summary["regular"])} and exceptional spend is {fmt(summary["exceptional"])}. ' + (insights[0]['text'] if insights else '')
                else:
                    answer = 'This local assistant can explain spending, income, budgets and forecasts from this workspace. I do not have enough supported data to answer that question. Try “Where did I spend this month?”'
            return result({'insights': insights, 'answer': answer, 'evidence': [r['id'] for r in summary['transactions']], 'engine': 'Deterministic workspace analysis; no external AI model connected.', 'month': summary['month']})
        if resource == 'reset' and method == 'POST':
            if not workspace['demo']:
                raise APIError('Only synthetic demo workspaces can be reset.', 403)
            for table in ('transactions', 'budgets', 'subscriptions', 'goals', 'workspace_items', 'dashboard_versions'):
                db.execute(f'DELETE FROM {table} WHERE workspace_id=?', (wid,))
            seed_workspace(db, wid, workspace['kind'])
            audit(db, wid, user, 'demo.reset', wid)
            return result({'ok': True})
        if resource == 'settings' and method == 'PUT':
            data = self.body()
            settings = features.settings(sys.modules[__name__], data, json.loads(workspace['settings']))
            db.execute('UPDATE workspaces SET name=?,settings=? WHERE id=?', (string(data, 'name'), json.dumps(settings), wid))
            audit(db, wid, user, 'workspace.updated', wid)
            return result({'ok': True})
        if resource == 'members':
            contacts = {r['user_id']: dict(r) for r in db.execute('SELECT * FROM member_contacts WHERE workspace_id=? AND user_id IS NOT NULL', (wid,))}
            if method == 'GET':
                rows = [{**dict(r), 'email': accounts.public_email(r['email']), 'contact': {k: contacts.get(r['id'], {}).get(k, '') for k in ('email', 'phone')}} for r in db.execute('SELECT users.id,users.name,users.username,users.email,members.role FROM members JOIN users ON users.id=members.user_id WHERE workspace_id=? ORDER BY members.role=\'owner\' DESC, users.username', (wid,))]
                # People saved by contact details only: they have no access until they sign up and are added.
                pending = [{'id': r['id'], 'name': r['name'], 'contact': {'email': r['email'], 'phone': r['phone']}, 'role': 'not a member yet', 'pending': True, 'invitation_status': r['invitation_status']} for r in db.execute('SELECT * FROM member_contacts WHERE workspace_id=? AND user_id IS NULL ORDER BY created_at', (wid,))]
                return result(rows + accounts.list_invites(db, wid) + pending)
            if workspace['kind'] == 'Personal':
                raise APIError('Personal workspaces are private to you. Share records through a Household workspace instead.', 403)
            if workspace['demo']:
                raise APIError('Invitations are not available in demo workspaces.', 403)
            core = sys.modules[__name__]
            if method == 'POST' and not record_id:
                # Email invitation only: access is granted when the invitee accepts with the same email.
                return result(*accounts.create_invite(core, db, workspace, session, self.body()))
            if method == 'POST' and record_id:
                return result(accounts.resend_invite(core, db, workspace, session, record_id))
            if method == 'DELETE' and record_id:
                if record_id == user:
                    raise APIError('Owners cannot remove themselves.')
                if accounts.revoke_invite(db, wid, record_id):
                    audit(db, wid, user, 'member.invite_revoked', record_id)
                    return result({'ok': True})
                if db.execute('DELETE FROM member_contacts WHERE workspace_id=? AND id=? AND user_id IS NULL', (wid, record_id)).rowcount:
                    audit(db, wid, user, 'member.contact_removed', record_id)
                    return result({'ok': True})
                if not db.execute("DELETE FROM members WHERE workspace_id=? AND user_id=? AND role!='owner'", (wid, record_id)).rowcount:
                    raise APIError('Member not found.', 404)
                db.execute('DELETE FROM member_contacts WHERE workspace_id=? AND user_id=?', (wid, record_id))
                audit(db, wid, user, 'member.removed', record_id)
                return result({'ok': True})
            raise APIError('Method not allowed.', 405)
        if resource == 'audit' and method == 'GET':
            return result([dict(r) for r in db.execute('SELECT action,record_id,timestamp FROM audit_log WHERE workspace_id=? AND (user_id=? OR record_id IN (SELECT id FROM transactions WHERE workspace_id=? AND visibility=\'shared\')) ORDER BY timestamp DESC LIMIT 100', (wid, user, wid))])
        tables = ('transactions', 'budgets', 'subscriptions', 'goals', 'categories')
        if resource not in tables:
            raise APIError('Endpoint not found.', 404)
        if resource == 'goals' and workspace['kind'] == 'Business':
            raise APIError('Savings goals are available in Personal and Household workspaces.')
        if method == 'GET':
            if resource == 'transactions':
                return result(filtered_transactions(db, wid, query, user))
            return result([dict(r) for r in db.execute(f'SELECT * FROM {resource} WHERE workspace_id=? ORDER BY rowid', (wid,))])
        if record_id and not db.execute(f'SELECT id FROM {resource} WHERE id=? AND workspace_id=?', (record_id, wid)).fetchone():
            raise APIError('Record not found.', 404)
        if resource == 'transactions' and record_id:
            existing = db.execute('SELECT * FROM transactions WHERE id=? AND workspace_id=?', (record_id,wid)).fetchone()
            if existing['visibility'] != 'shared' and existing['created_by'] != user:
                raise APIError('Record not found.',404)
        if method == 'DELETE' and record_id:
            if resource == 'categories':
                raise APIError('Rename categories to preserve transaction history.')
            if resource == 'transactions' and existing['approval_id']:
                db.execute("DELETE FROM workspace_items WHERE workspace_id=? AND id=? AND type='approval' AND status='pending'", (wid, existing['approval_id']))
            if resource == 'transactions' and existing['source_ref'].startswith('bill:'):
                # Deleting a bill's payment expense means the bill is unpaid again.
                db.execute("UPDATE workspace_items SET status='active' WHERE workspace_id=? AND id=? AND type='bill' AND status='paid'", (wid, existing['source_ref'][5:]))
            db.execute(f'DELETE FROM {resource} WHERE id=? AND workspace_id=?', (record_id, wid))
            audit(db, wid, user, resource + '.deleted', record_id)
            return result({'ok': True})
        if method not in ('POST', 'PUT') or (method == 'PUT' and not record_id) or (method == 'POST' and record_id):
            raise APIError('Method not allowed.', 405)
        data = self.body()
        values = {}
        if resource == 'transactions':
            txdate = valid_date(data.get('date'))
            if txdate > date.today().isoformat():
                raise APIError('Posted transactions cannot be in the future.')
            values = {'date': txdate, 'amount': money(data.get('amount')), 'kind': choice(data, 'kind', ('expense', 'income'), 'expense'), 'merchant': string(data, 'merchant'), 'category': string(data, 'category'), 'payment': choice(data, 'payment', ('Cash', 'UPI', 'Debit card', 'Credit card', 'Bank transfer', 'Wallet', 'Other'), 'UPI'), 'essential': int(bool(data.get('essential', False))), 'owner': string(data, 'owner', 'Me'), 'notes': str(data.get('notes', ''))[:2000]}
            if not record_id:
                values['created_at'] = now()
                values['created_by'] = user
            patterns = BUSINESS_PATTERNS if workspace['kind'] == 'Business' else SPENDING_PATTERNS
            pattern = data.get('classification', patterns[0] if workspace['kind'] == 'Business' else 'regular')
            # Older records keep their stored value (shown as a legacy label) unless the user picks a new one.
            if workspace['kind'] == 'Business' and pattern in LEGACY_BUSINESS_PATTERNS and not (record_id and pattern == existing['classification']):
                pattern = LEGACY_BUSINESS_PATTERNS[pattern]
            if pattern not in patterns and not (record_id and pattern == existing['classification']):
                raise APIError('Choose a ' + ('Transaction Pattern' if workspace['kind'] == 'Business' else 'spending pattern') + ' from the list.')
            values['classification'] = pattern
            if workspace['kind'] == 'Business':
                for key in ('vendor_id', 'subscription_id'):
                    if record_id and key not in data:
                        continue
                    value = data.get(key, '') or ''
                    if not isinstance(value, str):
                        raise APIError('Invalid vendor or subscription.')
                    if key == 'vendor_id' and value and not db.execute("SELECT 1 FROM workspace_items WHERE id=? AND workspace_id=? AND type='vendor'", (value, wid)).fetchone():
                        raise APIError('Select a vendor from this workspace.')
                    if key == 'subscription_id' and value and not db.execute('SELECT 1 FROM subscriptions WHERE id=? AND workspace_id=?', (value, wid)).fetchone():
                        raise APIError('Select a subscription from this workspace.')
                    values[key] = value
                if record_id and existing['approval_id'] and values['amount'] != existing['amount']:
                    status = db.execute('SELECT status FROM workspace_items WHERE id=? AND workspace_id=?', (existing['approval_id'], wid)).fetchone()
                    if status and status['status'] in ('pending', 'approved'):
                        raise APIError(f'The amount is locked because this expense is {status["status"]} for approval. Ask the owner to reject it, then edit and resubmit.')
            values['cost_type'] = choice(data,'cost_type',('fixed','variable'),'variable')
            values['visibility'] = choice(data,'visibility',('shared','private','amount-only'),'shared') if workspace['kind']!='Business' else 'shared'
            if workspace['kind']=='Business':
                if 'business' in data:
                    values['business']=business_fields.validate(sys.modules[__name__],data['business'],values['amount'],values['kind'])
                elif record_id:
                    details=business_fields.decode(existing['business'])
                    details['tax_amount']=details['tax_amount']/100
                    values['business']=business_fields.validate(sys.modules[__name__],details,values['amount'],values['kind'])
            if record_id and existing['created_by'] != user and values['visibility'] != existing['visibility']:
                raise APIError('Only the creator can change transaction privacy.',403)
            # Explicit links by stable item ID, validated against this workspace. A field left out of an
            # edit keeps its current link instead of silently clearing it.
            for key, item_type in [('event_id','event'),('project_id','project'),('dependent_id','dependent')]:
                if record_id and key not in data:
                    continue
                value = data.get(key,'') or ''
                if not isinstance(value,str):
                    raise APIError('Invalid allocation.')
                if value and not db.execute('SELECT 1 FROM workspace_items WHERE id=? AND workspace_id=? AND type=?',(value,wid,item_type)).fetchone():
                    raise APIError(f'Select a {"child / dependent cost" if item_type == "dependent" else item_type} from this workspace.')
                values[key] = value
            # "Spent by" is a current member's user ID, separate from created_by. New expenses default to
            # the signed-in member; edits that omit it keep the stored value (old records are never guessed).
            if workspace['kind'] == 'Household':
                if 'spent_by' in data or not record_id:
                    spent_by = data.get('spent_by', user)
                    if not isinstance(spent_by, str) or not db.execute('SELECT 1 FROM members WHERE workspace_id=? AND user_id=?', (wid, spent_by)).fetchone():
                        raise APIError('Choose who spent this from the current household members.')
                    values['spent_by'] = spent_by
        elif resource == 'budgets':
            values = {'month': valid_month(string(data, 'month')), 'category': string(data, 'category', 'Overall'), 'amount': money(data.get('amount'))}
        elif resource == 'subscriptions':
            values = {'name': string(data, 'name'), 'amount': money(data.get('amount')), 'cadence': choice(data, 'cadence', ('monthly', 'quarterly', 'yearly'), 'monthly'), 'renewal': valid_date(data.get('renewal')), 'category': string(data, 'category'), 'owner': string(data, 'owner', 'Me'), 'status': choice(data, 'status', ('active', 'paused', 'cancelled'), 'active')}
        elif resource == 'goals':
            values = {'name': string(data, 'name'), 'target': money(data.get('target')), 'saved': money(data.get('saved', 0), True), 'due': valid_date(data.get('due')), 'goal_type': choice(data, 'goal_type', GOAL_TYPES, 'savings')}
        elif resource == 'categories':
            values = {'name': string(data, 'name', limit=60)}
            if values['name'].casefold() == 'overall':
                raise APIError('Overall is reserved for the workspace budget. Choose another category name.')
            if record_id:
                old = db.execute('SELECT name FROM categories WHERE id=? AND workspace_id=?', (record_id, wid)).fetchone()['name']
                for table in ('transactions', 'budgets', 'subscriptions'):
                    db.execute(f'UPDATE {table} SET category=? WHERE workspace_id=? AND category=?', (values['name'], wid, old))
        if 'category' in values and not (resource == 'budgets' and values['category'] == 'Overall'):
            if not db.execute('SELECT 1 FROM categories WHERE workspace_id=? AND name=?', (wid, values['category'])).fetchone():
                raise APIError('Select a category from this workspace.')
        if record_id:
            db.execute(f'UPDATE {resource} SET ' + ','.join(k + '=?' for k in values) + ' WHERE id=? AND workspace_id=?', [*values.values(), record_id, wid])
        else:
            record_id = uid()
            values = {'id': record_id, 'workspace_id': wid, **values}
            db.execute(f'INSERT INTO {resource} (' + ','.join(values) + ') VALUES(' + ','.join('?' for _ in values) + ')', list(values.values()))
        audit(db, wid, user, resource + ('.created' if method == 'POST' else '.updated'), record_id)
        return result({'id': record_id}, 201 if method == 'POST' else 200)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    initialize()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Trikosh is running at http://{args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == '__main__':
    main()
