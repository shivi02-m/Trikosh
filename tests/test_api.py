"""Integration tests against a real HTTP server and isolated temporary SQLite DB."""
import csv
import http.cookiejar
import io
import json
import re
import tempfile
import threading
import unittest
from datetime import date
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
import accounts

# Captured outgoing email (invitations, password resets); tests never contact a real mail server.
OUTBOX = []


class Client:
    def __init__(self, base):
        self.base = base
        self.opener = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = ''

    def call(self, path, method='GET', data=None, csrf=True):
        headers = {'Content-Type': 'application/json'}
        if csrf:
            headers['X-CSRF-Token'] = self.csrf
        request = Request(self.base + path, data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
        try:
            response = self.opener.open(request)
        except HTTPError as error:
            response = error
        body = response.read().decode('utf-8-sig')
        value = json.loads(body) if 'application/json' in response.headers.get('Content-Type', '') else body
        return response.status, value, response.headers

    def signup(self, email='owner@example.com', account_type='personal_household', username=None):
        self.username = username or 'u' + server.uid()[:14]
        status, body, _ = self.call('/api/auth/signup', 'POST', {'name': 'Test User', 'email': email, 'username': self.username, 'password': PASSWORD, 'account_type': account_type})
        assert status == 200, body
        self.csrf = body['csrf']
        self.email = email
        return self

    def invite(self, path, member, role='member'):
        """Owner invites member by email; member accepts via the emailed link. Returns (status, body)."""
        status, body, _ = self.call(path + 'members', 'POST', {'email': member.email, 'role': role})
        if status != 201:
            return status, body
        token = re.search(r'token=([\w-]+)', OUTBOX[-1]['text']).group(1)
        return member.call('/api/invites/accept', 'POST', {'token': token})[:2]

    def login(self, identifier, account_type, password=None):
        status, body, headers = self.call('/api/auth/login', 'POST', {'identifier': identifier, 'password': password or PASSWORD, 'account_type': account_type})
        if status == 200:
            self.csrf = body['csrf']
        return status, body, headers


PASSWORD = 'a strong test password'


class APITests(unittest.TestCase):
    def test_feedback_is_emailed_and_delivery_failures_are_reported(self):
        client = Client(self.base).signup(email='feedback@example.com')
        OUTBOX.clear()
        status, _, _ = client.call('/api/feedback', 'POST', {'category': 'suggestion', 'message': 'Make reports easier to find.'})
        self.assertEqual(status, 201)
        self.assertEqual(OUTBOX[-1]['to'], 'admin@trikosh.com')
        self.assertIn('Make reports easier to find.', OUTBOX[-1]['text'])
        self.assertIn('feedback@example.com', OUTBOX[-1]['text'])
        status, _, _ = client.call('/api/feedback', 'POST', {'category': 'suggestion', 'message': '  '})
        self.assertEqual(status, 400)
        self.assertEqual(len(OUTBOX), 1)
        old_send = accounts.send_email
        try:
            def fail(*args):
                raise OSError('SMTP unavailable')
            accounts.send_email = fail
            status, _, _ = client.call('/api/feedback', 'POST', {'category': 'issue', 'message': 'Something broke.'})
            self.assertEqual(status, 502)
        finally:
            accounts.send_email = old_send

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(cls.temp.name) / 'test.db'
        server.initialize()
        cls.real_mail = (accounts.mail_config, accounts.send_email)
        accounts.mail_config = lambda: {'host': 'smtp.test', 'port': 587, 'user': 'admin@trikosh.com', 'password': 'x', 'sender': 'admin@trikosh.com', 'base': 'https://trikosh.test'}
        accounts.send_email = lambda config, to, subject, text: OUTBOX.append({'to': to, 'subject': subject, 'text': text})
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        cls.temp.cleanup()
        accounts.mail_config, accounts.send_email = cls.real_mail

    def setUp(self):
        self.client = Client(self.base).signup(server.uid() + '@example.com')
        status, body, _ = self.client.call('/api/workspaces', 'POST', {'name': 'Test space', 'kind': 'Personal', 'budget': '1000'})
        self.assertEqual(status, 201)
        self.wid = body['id']
        self.path = '/api/workspaces/' + self.wid + '/'
        self.month = date.today().strftime('%Y-%m')

    def transaction(self, **overrides):
        return {'date': date.today().isoformat(), 'amount': '125.25', 'kind': 'expense', 'merchant': 'Test merchant', 'category': 'Groceries', 'payment': 'UPI', 'classification': 'regular', **overrides}

    def create_transaction(self, **overrides):
        status, body, _ = self.client.call(self.path + 'transactions', 'POST', self.transaction(**overrides))
        self.assertEqual(status, 201, body)
        return body['id']

    def test_auth_cookie_csrf_and_logout(self):
        guest = Client(self.base)
        self.assertEqual(guest.call(self.path + 'transactions')[0], 401)
        self.assertEqual(self.client.call(self.path + 'transactions', 'POST', self.transaction(), csrf=False)[0], 403)
        _, me, _ = self.client.call('/api/auth/me')
        self.assertEqual(len(me['workspaces']), 1)
        self.assertEqual(me['workspaces'][0]['role'], 'owner')
        self.assertNotIn('password', me['user'])
        self.assertEqual(self.client.call('/api/auth/logout', 'POST', {})[0], 200)
        self.assertEqual(self.client.call('/api/auth/me')[0], 401)

    def test_personal_household_signup_login_and_profile(self):
        email = server.uid() + '@Example.com'
        account = Client(self.base).signup(email.lower(), 'personal_household', 'Priya.' + server.uid()[:6])
        me = account.call('/api/auth/me')[1]
        self.assertEqual(me['account_type'], 'personal_household')
        self.assertEqual(me['account_type_label'], 'Personal / Household')
        self.assertEqual(me['kinds'], ['Personal', 'Household'])
        self.assertEqual(me['user']['username'], account.username.lower())
        self.assertEqual(me['user']['email'], email.lower())
        self.assertFalse(me['needs_username'])
        self.assertEqual(me['workspaces'], [])
        personal = account.call('/api/workspaces', 'POST', {'name': 'Mine', 'kind': 'Personal'})
        household = account.call('/api/workspaces', 'POST', {'name': 'Ours', 'kind': 'Household'})
        self.assertEqual((personal[0], household[0]), (201, 201))
        self.assertEqual(account.call('/api/workspaces', 'POST', {'name': 'No', 'kind': 'Business'})[0], 403)
        account.call('/api/auth/logout', 'POST', {})
        # Login by email and by username (case-insensitive, optional @ prefix).
        for identifier in (email, '@' + account.username.upper()):
            status, body, _ = account.login(identifier, 'personal_household')
            self.assertEqual(status, 200, body)
            me = account.call('/api/auth/me')[1]
            self.assertEqual({w['kind'] for w in me['workspaces']}, {'Personal', 'Household'})
        # Internal identity is the provider subject, not the username or email.
        with server.connect() as db:
            identity = db.execute('SELECT * FROM auth_identities WHERE user_id=?', (me['user']['id'],)).fetchone()
            self.assertEqual((identity['provider'], identity['subject']), ('local', me['user']['id']))

    def test_business_signup_login_and_isolation(self):
        email = server.uid() + '@example.com'
        account = Client(self.base).signup(email, 'business')
        me = account.call('/api/auth/me')[1]
        self.assertEqual((me['account_type'], me['kinds']), ('business', ['Business']))
        status, body, _ = account.call('/api/workspaces', 'POST', {'name': 'Co', 'kind': 'Business'})
        self.assertEqual(status, 201)
        for kind in ('Personal', 'Household'):
            self.assertEqual(account.call('/api/workspaces', 'POST', {'name': 'No', 'kind': kind})[0], 403)
        account.call('/api/auth/logout', 'POST', {})
        self.assertEqual(account.login(email, 'business')[0], 200)
        self.assertEqual([w['id'] for w in account.call('/api/auth/me')[1]['workspaces']], [body['id']])
        # A business account cannot read a personal workspace even if somehow added as member.
        with server.connect() as db:
            db.execute('INSERT INTO members VALUES(?,?,?)', (self.wid, me['user']['id'], 'member'))
        self.assertEqual(account.call(self.path + 'transactions')[0], 404)

    def test_wrong_account_type_at_login_is_rejected_without_session(self):
        email = server.uid() + '@example.com'
        business = Client(self.base).signup(email, 'business')
        business.call('/api/auth/logout', 'POST', {})
        status, body, headers = business.login(email, 'personal_household')
        self.assertEqual(status, 403)
        self.assertIn('registered as Business', body['error'])
        self.assertIsNone(headers.get('Set-Cookie'))
        self.assertEqual(business.call('/api/auth/me')[0], 401)
        # Wrong password still returns the generic error and never reveals the account type.
        status, body, _ = business.login(email, 'personal_household', 'wrong password!')
        self.assertEqual(status, 401)
        self.assertNotIn('Business', body['error'])
        self.assertEqual(business.login(email, 'nonsense')[0], 400)
        self.assertEqual(business.login(email, 'business')[0], 200)

    def test_signup_validation_and_unique_usernames(self):
        base = {'name': 'A', 'email': server.uid() + '@example.com', 'password': PASSWORD, 'account_type': 'personal_household'}
        guest = Client(self.base)
        for username in ['ab', 'has space', '-start', 'end-', 'x' * 31, 'admin', 'demo-abc', None]:
            self.assertEqual(guest.call('/api/auth/signup', 'POST', {**base, 'username': username})[0], 400, username)
        self.assertEqual(guest.call('/api/auth/signup', 'POST', {**base, 'username': 'valid.name', 'account_type': None})[0], 400)
        taken = Client(self.base).signup(server.uid() + '@example.com')
        status, body, _ = guest.call('/api/auth/signup', 'POST', {**base, 'username': taken.username.upper()})
        self.assertEqual(status, 409)
        self.assertIn('username', body['error'])
        status, body, _ = guest.call('/api/auth/signup', 'POST', {**base, 'email': taken.email, 'username': 'fresh' + server.uid()[:6]})
        self.assertEqual(status, 409)

    def test_personal_and_household_switch_and_isolation(self):
        household = self.client.call('/api/workspaces', 'POST', {'name': 'Home', 'kind': 'Household'})[1]['id']
        hpath = '/api/workspaces/' + household + '/'
        self.create_transaction(merchant='Personal only')
        self.client.call(hpath + 'transactions', 'POST', self.transaction(merchant='Household shared'))
        self.client.call(hpath + 'budgets', 'POST', {'month': self.month, 'category': 'Groceries', 'amount': '50'})
        self.assertEqual([r['merchant'] for r in self.client.call(self.path + 'transactions')[1]], ['Personal only'])
        self.assertEqual([r['merchant'] for r in self.client.call(hpath + 'transactions')[1]], ['Household shared'])
        self.assertEqual([b['category'] for b in self.client.call(self.path + 'budgets')[1]], ['Overall'])
        self.assertEqual([b['category'] for b in self.client.call(hpath + 'budgets')[1]], ['Groceries'])
        # A household member sees shared household records but never the owner's Personal workspace.
        member = Client(self.base).signup(server.uid() + '@example.com')
        self.assertEqual(self.client.invite(hpath, member)[0], 200)
        self.assertEqual([r['merchant'] for r in member.call(hpath + 'transactions')[1]], ['Household shared'])
        for resource in ('transactions', 'overview', 'budgets', 'goals', 'export'):
            self.assertEqual(member.call(self.path + resource)[0], 404, resource)
        self.assertEqual(self.client.call(self.path + 'members', 'POST', {'email': member.email, 'role': 'member'})[0], 403)
        # Shared login: a Business account that accepts a Household invitation gains Personal / Household access.
        business = Client(self.base).signup(server.uid() + '@example.com', 'business')
        status, body = self.client.invite(hpath, business)
        self.assertEqual((status, body['switch_account_type'], body['account_type']), (200, True, 'personal_household'))
        # Removing a member revokes access immediately.
        member_id = member.call('/api/auth/me')[1]['user']['id']
        self.assertEqual(self.client.call(hpath + 'members/' + member_id, 'DELETE')[0], 200)
        self.assertEqual(member.call(hpath + 'transactions')[0], 404)

    def test_unauthorized_workspace_requests_rejected(self):
        business = Client(self.base).signup(server.uid() + '@example.com', 'business')
        bid = business.call('/api/workspaces', 'POST', {'name': 'Co', 'kind': 'Business'})[1]['id']
        bpath = '/api/workspaces/' + bid + '/'
        txid = business.call(bpath + 'transactions', 'POST', self.transaction(category='Travel'))[1]['id']
        for resource in ('transactions', 'overview', 'dashboard', 'insights', 'export', 'budgets', 'planning', 'members', 'audit'):
            self.assertEqual(self.client.call(bpath + resource)[0], 404, resource)
            self.assertEqual(business.call(self.path + resource)[0], 404, resource)
        self.assertEqual(self.client.call(bpath + 'transactions/' + txid, 'PUT', self.transaction())[0], 404)
        self.assertEqual(self.client.call(bpath + 'transactions/' + txid, 'DELETE')[0], 404)
        self.assertEqual(Client(self.base).call(bpath + 'transactions')[0], 401)
        self.assertEqual(len(business.call(bpath + 'transactions')[1]), 1)

    def test_logout_invalidates_session_server_side(self):
        email = server.uid() + '@example.com'
        account = Client(self.base).signup(email)
        wid = account.call('/api/workspaces', 'POST', {'name': 'Mine', 'kind': 'Personal'})[1]['id']
        cookie = next(c for h in account.opener.handlers if hasattr(h, 'cookiejar') for c in h.cookiejar if c.name == 'opsmind_session')
        status, _, headers = account.call('/api/auth/logout', 'POST', {})
        self.assertEqual(status, 200)
        self.assertIn('Max-Age=0', headers['Set-Cookie'])
        self.assertIn('cache', headers['Clear-Site-Data'])
        # Replaying the old cookie (e.g. a saved URL or back button) must fail.
        replay = Client(self.base)
        request_headers = {'Cookie': 'opsmind_session=' + cookie.value}
        from urllib.request import Request as R
        for path in ('/api/auth/me', '/api/workspaces/' + wid + '/transactions', '/api/workspaces/' + wid + '/overview'):
            try:
                replay.opener.open(R(self.base + path, headers=request_headers))
                self.fail('old session still valid for ' + path)
            except HTTPError as error:
                self.assertEqual(error.code, 401)
                error.close()
        self.assertEqual(account.call('/api/auth/logout', 'POST', {})[0], 200)
        self.assertEqual(Client(self.base).call('/', 'GET')[0], 200)
        self.assertEqual(Client(self.base).call('/login', 'GET')[0], 200)

    def test_legacy_users_migrate_without_data_loss(self):
        with server.connect() as db:
            db.execute("INSERT INTO users(id,name,email,password) VALUES('aa11','Legacy','legacy@example.com',?)", (server.password_hash(PASSWORD),))
            db.execute("INSERT INTO users(id,name,email,password) VALUES('bb22','Both','both@example.com',?)", (server.password_hash(PASSWORD),))
            for wid, kind, user in [('cc33', 'Personal', 'aa11'), ('dd44', 'Business', 'bb22'), ('ee55', 'Household', 'bb22')]:
                db.execute('INSERT INTO workspaces(id,name,kind) VALUES(?,?,?)', (wid, kind, kind))
                db.execute('INSERT INTO members VALUES(?,?,?)', (wid, user, 'owner'))
            db.execute("INSERT INTO transactions(id,workspace_id,date,amount,kind,merchant,category,payment,classification,created_at) VALUES('ff66','cc33','2026-01-01',100,'expense','Old','Other','UPI','regular','x')")
            db.execute("INSERT INTO sessions(token,user_id,csrf,expires) VALUES('legacy','aa11','c','2999-01-01')")
            db.execute("DELETE FROM account_access WHERE user_id IN ('aa11','bb22')")
            db.execute("DELETE FROM auth_identities WHERE user_id IN ('aa11','bb22')")
        server.initialize()
        with server.connect() as db:
            self.assertEqual([r[0] for r in db.execute("SELECT account_type FROM account_access WHERE user_id='aa11'")], ['personal_household'])
            self.assertEqual(sorted(r[0] for r in db.execute("SELECT account_type FROM account_access WHERE user_id='bb22'")), ['business', 'personal_household'])
            self.assertIsNotNone(db.execute("SELECT 1 FROM transactions WHERE id='ff66'").fetchone())
            self.assertIsNotNone(db.execute("SELECT 1 FROM auth_identities WHERE provider='local' AND subject='aa11'").fetchone())
        legacy = Client(self.base)
        self.assertEqual(legacy.login('legacy@example.com', 'business')[0], 403)
        self.assertEqual(legacy.login('legacy@example.com', 'personal_household')[0], 200)
        me = legacy.call('/api/auth/me')[1]
        self.assertTrue(me['needs_username'])
        self.assertEqual([w['id'] for w in me['workspaces']], ['cc33'])
        self.assertEqual(len(legacy.call('/api/workspaces/cc33/transactions')[1]), 1)
        self.assertEqual(legacy.call('/api/auth/username', 'POST', {'username': 'legacy.user'})[0], 200)
        self.assertEqual(legacy.call('/api/auth/username', 'POST', {'username': 'again'})[0], 409)
        self.assertFalse(legacy.call('/api/auth/me')[1]['needs_username'])
        # Pre-migration sessions (no account type) are not accepted.
        stale = Client(self.base)
        from urllib.request import Request as R
        with self.assertRaises(HTTPError) as caught:
            stale.opener.open(R(self.base + '/api/auth/me', headers={'Cookie': 'opsmind_session=legacy'}))
        self.assertEqual(caught.exception.code, 401)
        caught.exception.close()

    def test_selected_demo_account_types(self):
        for account_type, kinds in (('personal_household', ['Personal', 'Household']), ('business', ['Business'])):
            demo = Client(self.base)
            status, body, _ = demo.call('/api/auth/demo', 'POST', {'account_type': account_type})
            self.assertEqual(status, 200)
            demo.csrf = body['csrf']
            me = demo.call('/api/auth/me')[1]
            self.assertEqual([w['kind'] for w in me['workspaces']], kinds)
            self.assertIsNone(me['user']['email'])
            self.assertTrue(me['user']['username'].startswith('demo-'))
        self.assertEqual(Client(self.base).call('/api/auth/demo', 'POST', {'account_type': 'Unknown'})[0], 400)

    def test_workspace_and_record_isolation(self):
        txid = self.create_transaction()
        outsider = Client(self.base).signup(server.uid() + '@example.com')
        for resource in ['transactions', 'overview', 'categories', 'budgets', 'subscriptions', 'goals', 'insights', 'export', 'audit']:
            self.assertEqual(outsider.call(self.path + resource)[0], 404, resource)
        self.assertEqual(outsider.call(self.path + 'transactions/' + txid, 'DELETE')[0], 404)
        status, body, _ = self.client.call('/api/workspaces', 'POST', {'name': 'Second', 'kind': 'Household'})
        otherpath = '/api/workspaces/' + body['id'] + '/transactions/' + txid
        self.assertEqual(self.client.call(otherpath, 'PUT', self.transaction())[0], 404)
        self.assertEqual(self.client.call(otherpath, 'DELETE')[0], 404)
        self.assertEqual(len(self.client.call(self.path + 'transactions')[1]), 1)

    def test_viewer_role_enforced_and_owner_membership(self):
        # Sharing happens in Household workspaces; Personal workspaces are owner-only.
        self.path = '/api/workspaces/' + self.client.call('/api/workspaces', 'POST', {'name': 'Home', 'kind': 'Household'})[1]['id'] + '/'
        email = server.uid() + '@example.com'
        viewer = Client(self.base).signup(email)
        self.assertEqual(self.client.invite(self.path, viewer, 'viewer')[0], 200)
        self.assertEqual(viewer.call(self.path + 'overview')[0], 200)
        self.assertEqual(viewer.call(self.path + 'transactions', 'POST', self.transaction())[0], 403)
        self.assertEqual(viewer.call(self.path + 'members')[0], 403)
        self.assertEqual(viewer.call(self.path + 'settings', 'PUT', {'name': 'Hijacked'})[0], 403)
        self.assertEqual(self.client.call(self.path + 'members', 'POST', {'email': email, 'role': 'member'})[0], 200)
        self.assertEqual(viewer.call(self.path + 'transactions', 'POST', self.transaction())[0], 201)
        self.assertEqual(viewer.call(self.path + 'reset', 'POST', {})[0], 403)

    def test_transaction_crud_and_reconciliation(self):
        txid = self.create_transaction()
        self.create_transaction(amount='24.75', classification='event', category='Travel')
        self.create_transaction(amount='1000', kind='income', category='Salary')
        _, overview, _ = self.client.call(self.path + 'overview?month=' + self.month)
        self.assertEqual(overview['spend'], 15000)
        self.assertEqual(overview['income'], 100000)
        self.assertEqual(overview['balance'], 85000)
        self.assertEqual(overview['regular'], 12525)
        self.assertEqual(overview['exceptional'], 2475)
        self.assertEqual(overview['remaining'], 85000)
        self.assertEqual(sum(c['amount'] for c in overview['categories']), overview['spend'])
        self.assertEqual(sum(d['expense'] for d in overview['daily']), overview['spend'])
        self.assertEqual(self.client.call(self.path + 'transactions/' + txid, 'PUT', self.transaction(amount='200.10'))[0], 200)
        self.assertEqual(self.client.call(self.path + 'overview')[1]['spend'], 22485)
        self.assertEqual(self.client.call(self.path + 'transactions/' + txid, 'DELETE')[0], 200)
        self.assertEqual(self.client.call(self.path + 'overview')[1]['spend'], 2475)
        actions = self.client.call(self.path + 'audit')[1]
        self.assertTrue(any(a['action'] == 'transactions.deleted' for a in actions))

    def test_filters_export_and_formula_injection(self):
        self.create_transaction(merchant='=HYPERLINK("bad")', notes='@formula')
        self.create_transaction(merchant='Excluded', category='Travel')
        query = '?month=' + self.month + '&category=Groceries&kind=expense'
        _, rows, _ = self.client.call(self.path + 'transactions' + query)
        _, exported, headers = self.client.call(self.path + 'export' + query)
        records = list(csv.DictReader(io.StringIO(exported)))
        self.assertEqual(len(rows), len(records))
        self.assertEqual(records[0]['amount'], '125.25')
        self.assertEqual(records[0]['currency'], 'INR')
        self.assertTrue(records[0]['merchant'].startswith("'="))
        self.assertTrue(records[0]['notes'].startswith("'@"))
        self.assertIn('attachment', headers['Content-Disposition'])
        overview = self.client.call(self.path + 'overview' + query)[1]
        self.assertEqual(overview['spend'], 12525)

    def test_invalid_money_dates_categories_and_payloads(self):
        for amount in ['-1', '0', 'NaN', 'Infinity', '0.001', '1000000001', 'hello']:
            self.assertEqual(self.client.call(self.path + 'transactions', 'POST', self.transaction(amount=amount))[0], 400, amount)
        for dt in ['2026-02-30', 'bad', '9999-12-31']:
            self.assertEqual(self.client.call(self.path + 'transactions', 'POST', self.transaction(date=dt))[0], 400)
        self.assertEqual(self.client.call(self.path + 'transactions', 'POST', self.transaction(category='Foreign category'))[0], 400)
        self.assertEqual(self.client.call(self.path + 'overview?month=bad')[0], 400)
        self.assertEqual(self.client.call(self.path + 'transactions', 'POST', [1, 2])[0], 400)

    def test_categories_rename_keeps_history(self):
        self.create_transaction()
        category = next(c for c in self.client.call(self.path + 'categories')[1] if c['name'] == 'Groceries')
        self.assertEqual(self.client.call(self.path + 'categories/' + category['id'], 'PUT', {'name': 'Food shopping'})[0], 200)
        self.assertEqual(self.client.call(self.path + 'transactions')[1][0]['category'], 'Food shopping')
        self.assertEqual(self.client.call(self.path + 'categories/' + category['id'], 'DELETE')[0], 400)

    def test_budgets_subscriptions_goals(self):
        status, budget, _ = self.client.call(self.path + 'budgets', 'POST', {'month': self.month, 'category': 'Groceries', 'amount': '200'})
        self.assertEqual(status, 201)
        self.create_transaction()
        b = next(b for b in self.client.call(self.path + 'overview')[1]['budgets'] if b['id'] == budget['id'])
        self.assertEqual(b['spent'], 12525)
        status, sub, _ = self.client.call(self.path + 'subscriptions', 'POST', {'name': 'Music', 'amount': '99', 'cadence': 'monthly', 'renewal': date.today().isoformat(), 'category': 'Subscriptions'})
        self.assertEqual(status, 201)
        self.assertEqual(self.client.call(self.path + 'subscriptions')[1][0]['amount'], 9900)
        status, goal, _ = self.client.call(self.path + 'goals', 'POST', {'name': 'Trip', 'target': '2000', 'saved': '250', 'due': '2028-01-01'})
        self.assertEqual(status, 201)
        self.assertEqual(self.client.call(self.path + 'goals')[1][0]['saved'], 25000)

    def test_insight_evidence_and_unsupported_question(self):
        txid = self.create_transaction()
        _, insight, _ = self.client.call(self.path + 'insights', 'POST', {'question': 'How much did I spend?'})
        self.assertIn(txid, insight['evidence'])
        self.assertIn('125.25', insight['answer'])
        answer = self.client.call(self.path + 'insights', 'POST', {'question': 'Tell me a secret password'})[1]['answer']
        self.assertIn('not have enough supported data', answer)
        future = self.client.call(self.path + 'insights?month=2099-01', 'POST', {'question': 'What is the forecast?'})[1]
        self.assertEqual(future['evidence'], [])

    def test_demo_seed_and_reset_safety(self):
        demo = Client(self.base)
        status, body, _ = demo.call('/api/auth/demo', 'POST', {})
        self.assertEqual(status, 200)
        demo.csrf = body['csrf']
        workspaces = demo.call('/api/auth/me')[1]['workspaces']
        self.assertEqual({w['kind'] for w in workspaces}, {'Personal', 'Household'})
        path = '/api/workspaces/' + workspaces[0]['id'] + '/'
        before = demo.call(path + 'transactions')[1]
        self.assertEqual(len({r['date'][:7] for r in before}), 6)
        demo.call(path + 'transactions', 'POST', self.transaction())
        self.assertEqual(demo.call(path + 'reset', 'POST', {})[0], 200)
        after = demo.call(path + 'transactions')[1]
        self.assertEqual(len(before), len(after))
        self.assertEqual(sum(r['amount'] for r in before), sum(r['amount'] for r in after))
        self.assertEqual(self.client.call(self.path + 'reset', 'POST', {})[0], 403)
        business_demo = Client(self.base)
        business_demo.csrf = business_demo.call('/api/auth/demo', 'POST', {'account_type': 'business'})[1]['csrf']
        business = business_demo.call('/api/auth/me')[1]['workspaces'][0]
        self.assertEqual(business_demo.call('/api/workspaces/' + business['id'] + '/goals')[0], 400)

    def test_login_roundtrip_and_bad_password(self):
        email = server.uid() + '@example.com'
        account = Client(self.base).signup(email)
        account.call('/api/auth/logout', 'POST', {})
        self.assertEqual(account.call('/api/auth/login', 'POST', {'email': email, 'password': 'wrong', 'account_type': 'personal_household'})[0], 401)
        self.assertEqual(account.call('/api/auth/login', 'POST', {'email': email, 'password': PASSWORD})[0], 400)
        status, body, headers = account.call('/api/auth/login', 'POST', {'email': email, 'password': PASSWORD, 'account_type': 'personal_household'})
        self.assertEqual(status, 200)
        self.assertIn('HttpOnly', headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', headers['Set-Cookie'])
        account.csrf = body['csrf']
        self.assertEqual(account.call('/api/auth/me')[0], 200)

    def test_health_checks_database(self):
        status, body, _ = Client(self.base).call('/api/health')
        self.assertEqual((status, body), (200, {'status': 'ok', 'database': 'ok'}))

    def test_static_security_headers_and_path_traversal(self):
        status, _, headers = self.client.call('/')
        self.assertEqual(status, 200)
        self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
        self.assertEqual(self.client.call('/../server.py')[0], 404)
        self.assertEqual(self.client.call('/data/opsmind.db')[0], 404)


if __name__ == '__main__':
    unittest.main()
