"""Workspace-specific planning, reporting, and household visibility."""
import calendar
import json
import business_expenses
from datetime import date, timedelta

ITEM_TYPES = {
    'Personal': ('bill', 'contribution', 'dependent', 'event'),
    'Household': ('bill', 'contribution', 'dependent', 'event'),
    'Business': ('bill', 'department-budget', 'approval', 'policy', 'project', 'opportunity', 'vendor'),
}


def migrate(db):
    columns = {r['name'] for r in db.execute('PRAGMA table_info(transactions)')}
    for name, definition in {
        'cost_type': "TEXT NOT NULL DEFAULT 'variable'",
        'visibility': "TEXT NOT NULL DEFAULT 'shared'",
        'created_by': "TEXT NOT NULL DEFAULT ''",
        'event_id': "TEXT NOT NULL DEFAULT ''",
        'project_id': "TEXT NOT NULL DEFAULT ''",
        # Links an expense to the bill or subscription occurrence that produced it.
        'source_ref': "TEXT NOT NULL DEFAULT ''",
        # Explicit link to a Children/dependent cost item (workspace_items.id).
        'dependent_id': "TEXT NOT NULL DEFAULT ''",
        # Household member (user ID) who spent the money; '' = unassigned. Separate from created_by.
        'spent_by': "TEXT NOT NULL DEFAULT ''",
        # Business: stable vendor (workspace_items.id) and SaaS subscription (subscriptions.id) links.
        'vendor_id': "TEXT NOT NULL DEFAULT ''",
        'subscription_id': "TEXT NOT NULL DEFAULT ''",
        # Business: approval request (workspace_items.id, type approval) this expense was submitted with.
        'approval_id': "TEXT NOT NULL DEFAULT ''",
    }.items():
        if name not in columns:
            db.execute(f'ALTER TABLE transactions ADD COLUMN {name} {definition}')
    if 'goal_type' not in {r['name'] for r in db.execute('PRAGMA table_info(goals)')}:
        db.execute("ALTER TABLE goals ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'savings'")
    # Optional Household member contact details. No email/SMS service exists, so invitations are never sent.
    db.execute('''CREATE TABLE IF NOT EXISTS member_contacts(
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
        invitation_status TEXT NOT NULL DEFAULT 'not_sent',
        created_by TEXT NOT NULL, created_at TEXT NOT NULL)''')
    db.execute("UPDATE transactions SET subscription_id=substr(source_ref, 14, instr(substr(source_ref, 14), ':') - 1) WHERE subscription_id='' AND source_ref LIKE 'subscription:%:%'")
    # One expense per bill payment / subscription occurrence, even under retries or races.
    db.execute("CREATE UNIQUE INDEX IF NOT EXISTS transaction_source ON transactions(workspace_id, source_ref) WHERE source_ref <> ''")
    db.executescript('''
        CREATE TABLE IF NOT EXISTS workspace_items(
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            type TEXT NOT NULL, name TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
            date TEXT NOT NULL, owner TEXT NOT NULL DEFAULT 'Shared',
            category TEXT NOT NULL DEFAULT 'Other', status TEXT NOT NULL DEFAULT 'active',
            extra TEXT NOT NULL DEFAULT '{}', created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS item_scope ON workspace_items(workspace_id,type,date);
        CREATE TABLE IF NOT EXISTS dashboard_versions(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE, version INTEGER NOT NULL);
    ''')
    db.execute("UPDATE transactions SET created_by=COALESCE((SELECT user_id FROM members WHERE members.workspace_id=transactions.workspace_id AND role='owner' LIMIT 1),'') WHERE created_by=''")


def seed(db, core, wid, kind):
    if db.execute('SELECT 1 FROM dashboard_versions WHERE workspace_id=?', (wid,)).fetchone():
        return
    user = db.execute("SELECT user_id FROM members WHERE workspace_id=? AND role='owner'", (wid,)).fetchone()['user_id']
    today = date.today()
    month = today.strftime('%Y-%m')
    def add(type_, name, amount, day=0, owner='Shared', category='Other', status='active', **extra):
        item_id = core.uid()
        db.execute('INSERT INTO workspace_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', (item_id, wid, type_, name, amount*100, (today+timedelta(days=day)).isoformat(), owner, category, status, json.dumps(extra), user, core.now()))
        return item_id
    db.execute("UPDATE transactions SET created_by=? WHERE workspace_id=? AND created_by=''", (user, wid))
    db.execute("UPDATE transactions SET cost_type='fixed' WHERE workspace_id=? AND category IN ('Housing','Utilities','Payroll','Software','Office')", (wid,))
    if kind == 'Personal':
        add('bill', 'Electricity bill', 1800, 2, 'Me', 'Utilities')
        add('bill', 'Home insurance', 3200, 12, 'Me', 'Housing')
    if kind in ('Personal', 'Household'):
        add('bill', 'School term fees', 18000, 8, 'Ishaan', 'Education')
        add('bill', 'Family health insurance', 12500, 15, 'Shared', 'Health')
        add('contribution', 'Aarav · shared pool', 55000, owner='Aarav')
        add('contribution', 'Priya · shared pool', 45000, owner='Priya')
        for child in ('Ishaan', 'Anya'):
            child_id = add('dependent', child, 0, owner=child)
            db.execute("UPDATE transactions SET dependent_id=? WHERE workspace_id=? AND owner=?", (child_id, wid, child))
        db.execute("UPDATE transactions SET spent_by=? WHERE workspace_id=? AND spent_by=''", (user, wid))
        event_id = add('event', 'Family celebration', 25000, 0, category='Travel')
        add('event', 'Festival celebrations', 30000, 30, category='Shopping')
        db.execute("UPDATE transactions SET event_id=? WHERE workspace_id=? AND classification='event'", (event_id, wid))
        db.execute("UPDATE transactions SET owner='Shared' WHERE workspace_id=? AND category IN ('Housing','Groceries','Utilities')", (wid,))
    else:
        add('bill', 'Cloud infrastructure renewal', 22000, 4, 'Engineering', 'Software')
        add('bill', 'Agency retainer', 35000, 10, 'Marketing', 'Marketing')
        for department, amount in [('Engineering', 180000), ('Marketing', 150000), ('Operations', 220000)]:
            add('department-budget', department, amount, owner=department)
        add('approval', 'Client workshop travel', 12500, owner='Operations', category='Travel', status='pending')
        add('approval', 'Campaign creative package', 24000, owner='Marketing', category='Marketing', status='pending')
        add('policy', 'Travel receipt review limit', 10000, category='Travel')
        project = add('project', 'Website redesign · Acme', 150000, client='Acme')
        db.execute("UPDATE transactions SET project_id=? WHERE workspace_id=? AND substr(date,1,7)=? AND category IN ('Software','Professional services')", (project, wid, month))
        add('project', 'Brand launch · Northstar', 90000, client='Northstar')
        add('opportunity', 'Northstar expansion', 400000, 25, status='open', probability=60, client='Northstar')
        add('opportunity', 'Acme support contract', 180000, 15, status='open', probability=80, client='Acme')
    db.execute('INSERT INTO dashboard_versions VALUES(?,1)', (wid,))


def settings(core, incoming, previous=None):
    result = dict(previous or {})
    for key, default in [('members', 'Me'), ('departments', 'Operations'), ('industry', 'Other')]:
        result[key] = core.string(incoming, key, result.get(key, default), 500)
    try:
        salary_day = int(incoming.get('salary_day', result.get('salary_day', 1)))
        if not 1 <= salary_day <= 31:
            raise ValueError
    except (ValueError, TypeError):
        raise core.APIError('Salary day must be a whole day from 1 to 31.')
    result['salary_day'] = salary_day
    # Settings use major units; transaction and item APIs use integer minor units.
    for key in ('opening_balance', 'savings_reserve'):
        if key in incoming:
            result[key] = core.money(incoming[key] or 0, True) / 100
        else:
            result.setdefault(key, 0)
    if 'tracking_balance' in incoming:
        result['tracking_balance'] = core.money(incoming['tracking_balance'], True) / 100
    if 'tracking_start' in incoming:
        try:
            tracking_start = date.fromisoformat(incoming['tracking_start'])
            if tracking_start > date.today():
                raise ValueError
        except (ValueError, TypeError):
            raise core.APIError('Choose a tracking start date today or earlier.')
        result['tracking_start'] = tracking_start.isoformat()
    result['pipeline_enabled'] = incoming.get('pipeline_enabled', result.get('pipeline_enabled', False)) in (True, 'on', 'true', 1)
    return result


def visible_rows(rows, user):
    output = []
    for raw in rows:
        row = dict(raw)
        own = row['created_by'] == user
        if row['visibility'] == 'private' and not own:
            continue
        if row['visibility'] == 'amount-only' and not own:
            row.update(merchant='Private transaction', category='Private expenses', payment='Private', classification='private', essential=None, owner='Private member', notes='', cost_type='private', event_id='', project_id='', dependent_id='', spent_by='', created_by='', created_at='', business='{}', redacted=True)
        output.append(row)
    return output


def items(db, wid):
    rows = [dict(r) for r in db.execute('SELECT * FROM workspace_items WHERE workspace_id=? ORDER BY date,id', (wid,))]
    for row in rows:
        row['extra'] = json.loads(row['extra'])
    return rows


def payment_date(core, data):
    paid_on = core.valid_date(data.get('paid_on') or date.today().isoformat())
    if paid_on > date.today().isoformat():
        raise core.APIError('Payment date cannot be in the future.')
    return paid_on


def linked_expense(db, core, wid, user, source_ref, name, amount, category, owner, paid_on, notes):
    """Insert the expense for a payment at most once. Returns (transaction_id, created)."""
    if not db.execute('SELECT 1 FROM categories WHERE workspace_id=? AND name=?', (wid, category)).fetchone():
        raise core.APIError('Choose a category from this workspace before recording the payment.')
    cursor = db.execute(
        'INSERT OR IGNORE INTO transactions(id,workspace_id,date,amount,kind,merchant,category,payment,classification,essential,owner,notes,created_at,created_by,cost_type,visibility,source_ref,spent_by) '
        "VALUES(?,?,?,?,'expense',?,?,'Other','regular',1,?,?,?,?,'fixed','shared',?,?)",
        (core.uid(), wid, paid_on, amount, name, category, owner, notes, core.now(), user, source_ref, user))
    row = db.execute('SELECT id FROM transactions WHERE workspace_id=? AND source_ref=?', (wid, source_ref)).fetchone()
    return row['id'], cursor.rowcount == 1


def sync_bill_payment(db, core, wid, user, bill_id, values, previous_status, data):
    ref = 'bill:' + bill_id
    if values['status'] == 'paid':
        paid_on = payment_date(core, data)
        tx_id, created = linked_expense(db, core, wid, user, ref, values['name'], values['amount'], values['category'], values['owner'], paid_on, 'Bill payment')
        if created:
            core.audit(db, wid, user, 'bill.paid', bill_id)
        else:
            # Already paid: keep the single linked expense in step with the bill.
            db.execute('UPDATE transactions SET amount=?,merchant=?,category=?,owner=?' + (',date=?' if data.get('paid_on') else '') + ' WHERE workspace_id=? AND source_ref=?',
                       [values['amount'], values['name'], values['category'], values['owner'], *([paid_on] if data.get('paid_on') else []), wid, ref])
        return tx_id
    if previous_status == 'paid':
        # Undoing a payment removes its linked expense.
        db.execute('DELETE FROM transactions WHERE workspace_id=? AND source_ref=?', (wid, ref))
        core.audit(db, wid, user, 'bill.payment_undone', bill_id)
    return None


def add_months(day, months):
    year, month = divmod(day.year * 12 + day.month - 1 + months, 12)
    return date(year, month + 1, min(day.day, calendar.monthrange(year, month + 1)[1]))


def record_subscription_payment(db, core, workspace, user, data):
    """Record one renewal as an expense and advance the subscription to its next renewal."""
    wid = workspace['id']
    sub_id = data.get('subscription_id')
    sub = db.execute('SELECT * FROM subscriptions WHERE id=? AND workspace_id=?', (sub_id if isinstance(sub_id, str) else '', wid)).fetchone()
    if not sub:
        raise core.APIError('Subscription not found.', 404)
    occurrence = core.valid_date(data.get('occurrence') or sub['renewal'])
    ref = f'subscription:{sub["id"]}:{occurrence}'
    existing = db.execute('SELECT id FROM transactions WHERE workspace_id=? AND source_ref=?', (wid, ref)).fetchone()
    if existing:
        return {'id': existing['id'], 'created': False, 'renewal': sub['renewal']}
    if sub['status'] != 'active':
        raise core.APIError('Only active subscriptions can record a payment.')
    if occurrence != sub['renewal']:
        raise core.APIError('This renewal has changed or was already recorded. Refresh and try again.', 409)
    paid_on = payment_date(core, data)
    tx_id, created = linked_expense(db, core, wid, user, ref, sub['name'], sub['amount'], sub['category'], sub['owner'], paid_on, f'Subscription payment for {occurrence}')
    renewal = sub['renewal']
    if created:
        renewal = add_months(date.fromisoformat(occurrence), {'monthly': 1, 'quarterly': 3, 'yearly': 12}[sub['cadence']]).isoformat()
        db.execute('UPDATE subscriptions SET renewal=? WHERE id=? AND workspace_id=? AND renewal=?', (renewal, sub['id'], wid, occurrence))
        db.execute('UPDATE transactions SET subscription_id=? WHERE id=? AND workspace_id=?', (sub['id'], tx_id, wid))
        core.audit(db, wid, user, 'subscription.paid', sub['id'])
    return {'id': tx_id, 'created': created, 'renewal': renewal}


def submit_for_approval(db, core, workspace, user, data):
    """Submit an existing Business expense to the owner's approval queue (reuses approval records)."""
    if workspace['kind'] != 'Business':
        raise core.APIError('Approvals are available in Business workspaces.')
    wid, tx_id = workspace['id'], data.get('transaction_id')
    tx = db.execute('SELECT * FROM transactions WHERE id=? AND workspace_id=?', (tx_id if isinstance(tx_id, str) else '', wid)).fetchone()
    if not tx:
        raise core.APIError('Expense not found.', 404)
    if tx['kind'] != 'expense':
        raise core.APIError('Only expenses can be submitted for approval.')
    current = db.execute('SELECT status FROM workspace_items WHERE id=? AND workspace_id=?', (tx['approval_id'], wid)).fetchone() if tx['approval_id'] else None
    if current and current['status'] in ('pending', 'approved'):
        raise core.APIError(f'This expense is already {current["status"]}.', 409)
    approval_id = core.uid()
    db.execute('INSERT INTO workspace_items VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', (approval_id, wid, 'approval', tx['merchant'], tx['amount'], tx['date'], tx['owner'], tx['category'], 'pending', json.dumps({'transaction_id': tx['id'], 'submitted_by': user}), user, core.now()))
    # Conditional update: a concurrent duplicate submission changes no row and is rolled back.
    if not db.execute('UPDATE transactions SET approval_id=? WHERE id=? AND workspace_id=? AND approval_id=?', (approval_id, tx['id'], wid, tx['approval_id'])).rowcount:
        raise core.APIError('This expense was just submitted. Refresh to see its status.', 409)
    core.audit(db, wid, user, 'approval.submitted', tx['id'])
    return {'id': approval_id, 'status': 'pending'}


def planning_api(db, core, workspace, user, method, record_id, data):
    wid = workspace['id']
    record = db.execute('SELECT * FROM workspace_items WHERE workspace_id=? AND id=?', (wid, record_id)).fetchone() if record_id else None
    if record_id and not record:
        raise core.APIError('Record not found.', 404)
    if method == 'GET':
        return items(db, wid)
    if workspace['role'] == 'viewer':
        raise core.APIError('Viewers cannot change planning records.', 403)
    if method == 'DELETE':
        if not record:
            raise core.APIError('Record not found.', 404)
        if record['type'] in ('policy', 'department-budget', 'approval') and workspace['role'] != 'owner':
            raise core.APIError('Only the workspace owner can remove this record.', 403)
        db.execute('DELETE FROM workspace_items WHERE workspace_id=? AND id=?', (wid, record_id))
        if record['type'] == 'bill':
            # The money was spent; keep the expense but drop the link to the removed bill.
            db.execute("UPDATE transactions SET source_ref='' WHERE workspace_id=? AND source_ref=?", (wid, 'bill:' + record_id))
        if record['type'] in ('event', 'project', 'dependent', 'vendor', 'approval'):
            key = {'event': 'event_id', 'project': 'project_id', 'dependent': 'dependent_id', 'vendor': 'vendor_id', 'approval': 'approval_id'}[record['type']]
            db.execute(f"UPDATE transactions SET {key}='' WHERE workspace_id=? AND {key}=?", (wid, record_id))
        core.audit(db, wid, user, record['type']+'.deleted', record_id)
        return {'ok': True}
    if method not in ('POST', 'PUT') or (method == 'PUT' and not record_id):
        raise core.APIError('Method not allowed.', 405)
    type_ = core.choice(data, 'type', ITEM_TYPES[workspace['kind']])
    if record and type_ != record['type']:
        raise core.APIError('Record type cannot change.')
    if type_ in ('policy', 'department-budget') and workspace['role'] != 'owner':
        raise core.APIError('Only owners can configure policies or department budgets.', 403)
    allowed = ('pending', 'approved', 'rejected') if type_ == 'approval' else ('open', 'won', 'lost') if type_ == 'opportunity' else ('active', 'paid', 'cancelled') if type_ == 'bill' else ('active',)
    status = core.choice(data, 'status', allowed, allowed[0])
    if type_ == 'approval':
        if not record and status != 'pending':
            raise core.APIError('New requests must start as pending.')
        if record and (workspace['role'] != 'owner' or record['status'] != 'pending'):
            raise core.APIError('Only the owner can decide a pending request; decided requests are immutable.', 403)
    amount = core.money(data.get('amount', 0), type_ in ('dependent', 'vendor'))
    extra = data.get('extra', {})
    if not isinstance(extra, dict):
        raise core.APIError('Invalid additional fields.')
    clean_extra = {}
    if type_ in ('project', 'opportunity'):
        clean_extra['client'] = core.string(extra, 'client', 'Unassigned')
    if type_ == 'opportunity':
        try:
            probability = int(extra.get('probability', 0))
            if not 0 <= probability <= 100:
                raise ValueError
        except (TypeError, ValueError):
            raise core.APIError('Probability must be between 0 and 100.')
        clean_extra['probability'] = probability
    if type_ == 'approval' and record:
        # Decisions cannot silently rewrite submitted values.
        amount = record['amount']
        for key in ('name', 'date', 'owner', 'category'):
            data[key] = record[key]
        clean_extra = json.loads(record['extra'])
        if status != 'pending':
            clean_extra.update(decided_by=user, decided_at=core.now())
    values = {'type': type_, 'name': core.string(data, 'name'), 'amount': amount, 'date': core.valid_date(data.get('date')), 'owner': core.string(data, 'owner', 'Shared'), 'category': core.string(data, 'category', 'Other'), 'status': status, 'extra': json.dumps(clean_extra)}
    if type_ == 'department-budget' and db.execute("SELECT 1 FROM workspace_items WHERE workspace_id=? AND type='department-budget' AND owner=? AND substr(date,1,7)=? AND id<>?", (wid,values['owner'],values['date'][:7],record_id or '')).fetchone():
        raise core.APIError('This department already has a budget for that month. Edit the existing budget.',409)
    if type_ == 'policy' and not db.execute('SELECT 1 FROM categories WHERE workspace_id=? AND name=?', (wid, values['category'])).fetchone():
        raise core.APIError('Select a workspace category for this policy.')
    if record:
        db.execute('UPDATE workspace_items SET '+','.join(k+'=?' for k in values)+' WHERE id=? AND workspace_id=?', [*values.values(), record_id, wid])
    else:
        record_id = core.uid()
        values = {'id': record_id, 'workspace_id': wid, **values, 'created_by': user, 'created_at': core.now()}
        db.execute('INSERT INTO workspace_items ('+','.join(values)+') VALUES ('+','.join('?' for _ in values)+')', list(values.values()))
    core.audit(db, wid, user, type_+('.created' if not record else '.updated'), record_id)
    result = {'id': record_id}
    if type_ == 'bill':
        result['transaction_id'] = sync_bill_payment(db, core, wid, user, record_id, values, record['status'] if record else None, data)
    return result


def dashboard(db, core, workspace, user, query):
    wid = workspace['id']
    month = core.valid_month(query.get('month', date.today().strftime('%Y-%m')))
    summary = core.overview(db, wid, {'month': month}, user)
    transactions = summary['transactions']
    expense = [r for r in transactions if core.counted(r)]
    config = settings(core, {}, json.loads(workspace['settings']))
    records = items(db, wid)
    today = date.today()
    first = date.fromisoformat(month+'-01')
    last = date(first.year, first.month, calendar.monthrange(first.year, first.month)[1])
    scope = [r for r in records if first.isoformat() <= r['date'] <= last.isoformat()]
    upcoming = [dict(r, source='bill') for r in records if r['type'] == 'bill' and r['status'] == 'active']
    for sub in db.execute("SELECT * FROM subscriptions WHERE workspace_id=? AND status='active'", (wid,)):
        upcoming.append({'id': sub['id'], 'name': sub['name'], 'amount': sub['amount'], 'date': sub['renewal'], 'owner': sub['owner'], 'category': sub['category'], 'source': 'subscription'})
    upcoming.sort(key=lambda r:r['date'])
    output = {'kind': workspace['kind'], 'records': records, 'upcoming': upcoming, 'settings': config, 'period': month}
    if workspace['kind'] == 'Household':
        output['household_members'] = [dict(r) for r in db.execute("SELECT users.id,users.name,users.username FROM members JOIN users ON users.id=members.user_id WHERE members.workspace_id=? ORDER BY members.role='owner' DESC, users.name", (wid,))]
    if workspace['kind'] != 'Business':
        salary_day = config['salary_day']
        # Selected cycle starts on the configured salary day in the selected month.
        start = first.replace(day=min(salary_day, calendar.monthrange(first.year, first.month)[1]))
        next_month = (first.replace(day=28)+timedelta(days=4)).replace(day=1)
        end = next_month.replace(day=min(salary_day, calendar.monthrange(next_month.year, next_month.month)[1]))-timedelta(days=1)
        cycle = core.filtered_transactions(db, wid, {'from':start.isoformat(),'to':end.isoformat()}, user)
        cincome = sum(r['amount'] for r in cycle if r['kind']=='income')
        cspend = sum(r['amount'] for r in cycle if r['kind']=='expense')
        chosen = cycle if query.get('period') == 'salary' else transactions
        chosen_expense = [r for r in chosen if r['kind']=='expense']
        inc = sum(r['amount'] for r in chosen if r['kind']=='income')
        spent = sum(r['amount'] for r in chosen_expense)
        current_start = today.replace(day=min(salary_day, calendar.monthrange(today.year, today.month)[1]))
        if current_start > today:
            previous_month = today.replace(day=1)-timedelta(days=1)
            current_start = previous_month.replace(day=min(salary_day, previous_month.day))
        next_first = (current_start.replace(day=28)+timedelta(days=4)).replace(day=1)
        next_salary = next_first.replace(day=min(salary_day, calendar.monthrange(next_first.year, next_first.month)[1]))
        current = core.filtered_transactions(db, wid, {'from':current_start.isoformat(),'to':today.isoformat()}, user)
        cashflow = sum(r['amount'] if r['kind']=='income' else -r['amount'] for r in current)
        tracking_start = config.get('tracking_start')
        tracked = core.filtered_transactions(db, wid, {'from':tracking_start, 'to':today.isoformat()}, user) if tracking_start else []
        starting = core.money(config.get('tracking_balance', 0), True)
        available = starting + sum(r['amount'] if r['kind']=='income' else -r['amount'] for r in tracked)
        current_visible = [r for r in current if not tracking_start or r['date'] >= tracking_start]
        output['cash_tracker'] = {'configured':bool(tracking_start), 'available':available, 'starting_balance':starting,
            'start_date':tracking_start, 'cycle_start':current_start.isoformat(), 'cycle_end':(next_salary-timedelta(days=1)).isoformat(),
            'income':sum(r['amount'] for r in current_visible if r['kind']=='income'),
            'spent':sum(r['amount'] for r in current_visible if r['kind']=='expense'),
            'transactions':sorted(tracked, key=lambda r:(r['date'],r.get('created_at','')), reverse=True)[:10]}
        commitments = sum(r['amount'] for r in upcoming if r['date'] < next_salary.isoformat())
        opening = core.money(config['opening_balance'], True)
        reserve = core.money(config['savings_reserve'], True)
        output.update(income=inc,spend=spent,remaining=inc-spent,savings_rate=round((inc-spent)/inc*100,1) if inc else None,fixed=sum(r['amount'] for r in chosen_expense if r['cost_type']=='fixed'),variable=sum(r['amount'] for r in chosen_expense if r['cost_type']=='variable'),cycle_start=start.isoformat(),cycle_end=end.isoformat(),cycle_income=cincome,cycle_spend=cspend,period_mode=query.get('period','calendar'),safe_to_spend=opening+cashflow-commitments-reserve,safe_basis={'opening_balance':opening,'cycle_cashflow':cashflow,'commitments':commitments,'reserve':reserve,'next_salary':next_salary.isoformat(),'cycle_start':current_start.isoformat()},evidence=[r['id'] for r in chosen])
    if workspace['kind'] != 'Business':
        # Dependent costs: expenses explicitly linked by dependent_id, within the selected month.
        dependent_costs = []
        for item in records:
            if item['type']=='dependent':
                linked = [r for r in expense if r['dependent_id']==item['id']]
                dependent_costs.append({'id':item['id'],'name':item['name'],'amount':sum(r['amount'] for r in linked),'evidence':[r['id'] for r in linked]})
        # Events have their own budget, so count every visible expense linked to the event, whatever its date.
        all_expense = [r for r in core.filtered_transactions(db, wid, {'kind':'expense'}, user) if r['event_id']]
        events = []
        for item in records:
            if item['type']=='event':
                linked = [r for r in all_expense if r['event_id']==item['id']]
                event_spend = sum(r['amount'] for r in linked)
                events.append({**item,'spent':event_spend,'remaining':item['amount']-event_spend,'evidence':[r['id'] for r in linked]})
        output.update(shared=sum(r['amount'] for r in expense if r['owner']=='Shared'),individual=sum(r['amount'] for r in expense if r['owner']!='Shared' and not r.get('redacted')),redacted=sum(r['amount'] for r in expense if r.get('redacted')),baseline=summary['regular'],contributions=[r for r in scope if r['type']=='contribution'],dependent_costs=dependent_costs,events=events,privacy='Private records are visible only to their creator. Amount-only records expose amount, date and income/expense type; merchant, category, member and notes are hidden from everyone else, including workspace owners.')
    else:
        business_tracking=business_expenses.summary(expense)
        dept_budgets = [{**r,'spent':sum(t['amount'] for t in expense if t['owner']==r['owner'])} for r in scope if r['type']=='department-budget']
        policies = [r for r in records if r['type']=='policy']
        approvals = [r for r in records if r['type']=='approval']
        flags = []
        for policy in policies:
            for row in expense:
                if row['category']==policy['category'] and row['amount']>policy['amount']:
                    flags.append({'name':row['merchant'],'amount':row['amount'],'limit':policy['amount'],'policy':policy['name'],'id':row['id'],'source':'transaction'})
            for row in approvals:
                if row['status']=='pending' and row['category']==policy['category'] and row['amount']>policy['amount']:
                    flags.append({'name':row['name'],'amount':row['amount'],'limit':policy['amount'],'policy':policy['name'],'id':row['id'],'source':'approval'})
        linked = [r for r in expense if r['vendor_id'] or r['subscription_id']]
        vendor_items = [r for r in records if r['type']=='vendor']
        subs = [dict(r) for r in db.execute('SELECT id,name,amount,cadence,renewal,status FROM subscriptions WHERE workspace_id=? ORDER BY name', (wid,))]
        scheduled_rows = [s for s in subs if s['status']=='active' and first.isoformat()<=s['renewal']<=last.isoformat()]
        vendor_costs = {
            'actual': sum(r['amount'] for r in linked), 'count': len(linked),   # each expense counted once
            'vendors': [{'id':v['id'],'name':v['name'],'amount':sum(r['amount'] for r in expense if r['vendor_id']==v['id']),'count':sum(1 for r in expense if r['vendor_id']==v['id'])} for v in vendor_items],
            'subscriptions': [{'id':s['id'],'name':s['name'],'amount':sum(r['amount'] for r in expense if r['subscription_id']==s['id']),'count':sum(1 for r in expense if r['subscription_id']==s['id'])} for s in subs],
            'scheduled': sum(s['amount'] for s in scheduled_rows), 'scheduled_count': len(scheduled_rows),
            'unlinked_count': sum(1 for r in expense if not (r['vendor_id'] or r['subscription_id'])),
            'unlinked_amount': sum(r['amount'] for r in expense if not (r['vendor_id'] or r['subscription_id']))}
        projects = [{**r,'spent':sum(t['amount'] for t in expense if t['project_id']==r['id'])} for r in records if r['type']=='project']
        committed_rows = [r for r in upcoming if first.isoformat()<=r['date']<=last.isoformat()]
        committed = sum(r['amount'] for r in committed_rows)
        elapsed = min(max((min(today,last)-first).days+1,0),(last-first).days+1)
        variable_regular = sum(r['amount'] for r in expense if r['cost_type']=='variable' and r['classification'] in core.REGULAR_PATTERNS and r['business']['accounting_type']!='capital')
        projected_variable = round(variable_regular/elapsed*((last-first).days+1-elapsed)) if elapsed else 0
        opportunities = [r for r in scope if r['type']=='opportunity' and r['status']=='open']
        output.update(operating_spend=summary['spend'],department_budgets=dept_budgets,committed=committed,committed_records=committed_rows,forecast=summary['spend']+committed+projected_variable,forecast_basis='Posted expenses + active bills/subscription renewals due in this month + remaining regular variable-spend run rate. Mark paid commitments to avoid counting them again.',approvals=approvals,policy_flags=flags,vendor_costs=vendor_costs,saas=sum(r['amount'] for r in expense if r['subscription_id']),projects=projects,unallocated=sum(r['amount'] for r in expense if not r['project_id']),revenue=summary['income'],pipeline=sum(r['amount'] for r in opportunities),weighted_pipeline=sum(round(r['amount']*r['extra'].get('probability',0)/100) for r in opportunities),opportunities=opportunities)
        output['business_tracking']=business_tracking
        output['operating_spend']=business_tracking['buckets']['operating']
        output['forecast_basis']='All posted outflows (including capital purchases) + active bills/subscription renewals due this month + remaining regular non-capital variable-spend run rate. Mark paid commitments to avoid counting them again.'
    return output
