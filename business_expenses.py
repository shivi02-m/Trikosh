"""Business expense categories and validated tracking metadata.

Sources and design decisions: BUSINESS_EXPENSE_RESEARCH.md.
Amounts are recorded for tracking, not automatic tax-deductibility decisions.
"""
import json

CATEGORY_GROUPS = {
    'People & professional services': ['Payroll', 'Employee benefits', 'Contractors', 'Recruitment', 'Training & development', 'Professional services', 'Legal & accounting'],
    'Premises & administration': ['Rent & lease', 'Office', 'Office supplies', 'Utilities', 'Internet & phone', 'Repairs & maintenance', 'Cleaning & security', 'Insurance'],
    'Technology & equipment': ['Software', 'Cloud hosting', 'IT support', 'Equipment & hardware'],
    'Sales & customer delivery': ['Marketing', 'Sales commissions', 'Travel', 'Accommodation', 'Business meals', 'Vehicle & fuel', 'Shipping & delivery'],
    'Production & finance': ['Inventory & materials', 'Packaging', 'Bank & payment fees', 'Interest & finance charges', 'Licenses & permits', 'Taxes & statutory fees', 'Other'],
}
CATEGORIES = [c for group in CATEGORY_GROUPS.values() for c in group] + ['Revenue']
TEXT_FIELDS = ('invoice_reference', 'business_purpose', 'cost_center', 'employee', 'billable_client')


def migrate(db, core):
    columns = {r['name'] for r in db.execute('PRAGMA table_info(transactions)')}
    if 'business' not in columns:
        db.execute("ALTER TABLE transactions ADD COLUMN business TEXT NOT NULL DEFAULT '{}'")
    db.execute('CREATE TABLE IF NOT EXISTS business_catalog_versions(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE, version INTEGER NOT NULL)')
    for row in db.execute("SELECT id FROM workspaces WHERE kind='Business'").fetchall():
        ensure_catalog(db, core, row['id'])


def ensure_catalog(db, core, wid):
    if db.execute('SELECT 1 FROM business_catalog_versions WHERE workspace_id=?',(wid,)).fetchone():
        return
    for category in CATEGORIES:
        db.execute('INSERT OR IGNORE INTO categories VALUES(?,?,?)',(core.uid(),wid,category))
    db.execute('INSERT INTO business_catalog_versions VALUES(?,1)',(wid,))


def defaults():
    return {'invoice_reference':'','business_purpose':'','cost_center':'','employee':'','billable_client':'','tax_amount':0,'paid_by':'company','reimbursement':'none','billable':False,'accounting_type':'operating'}


def decode(value):
    return {**defaults(), **(json.loads(value) if isinstance(value,str) else value)}


def validate(core, data, amount, kind):
    if not isinstance(data,dict):
        raise core.APIError('Business details must be an object.')
    output = defaults()
    if kind != 'expense':
        if any(v not in ('',0,False,None,'none','company','operating') for v in data.values()):
            raise core.APIError('Business expense details apply to expense transactions only.')
        return json.dumps(output)
    for key in TEXT_FIELDS:
        value = data.get(key,'')
        if not isinstance(value,str) or len(value.strip()) > (500 if key=='business_purpose' else 160):
            raise core.APIError('Invalid '+key.replace('_',' ')+'.')
        output[key] = value.strip()
    output['tax_amount'] = core.money(data.get('tax_amount',0),True)
    if output['tax_amount']>amount:
        raise core.APIError('Included tax cannot exceed the total transaction amount.')
    output['paid_by'] = core.choice(data,'paid_by',('company','employee'),'company')
    output['reimbursement'] = core.choice(data,'reimbursement',('none','pending','reimbursed'),'none')
    output['accounting_type'] = core.choice(data,'accounting_type',('operating','direct_cost','capital'),'operating')
    if not isinstance(data.get('billable',False),bool):
        raise core.APIError('Client billable must be true or false.')
    output['billable'] = data.get('billable',False)
    if output['paid_by']=='employee' and not output['employee']:
        raise core.APIError('Enter the employee who paid for the expense.')
    if output['paid_by']=='company' and output['reimbursement']!='none':
        raise core.APIError('Company-paid expenses cannot require employee reimbursement.')
    if output['billable'] and not output['billable_client']:
        raise core.APIError('Enter the client to bill for this expense.')
    if not output['billable']:
        output['billable_client']=''
    return json.dumps(output)


def summary(expenses):
    rows=[{**r,'business':decode(r['business'])} for r in expenses]
    buckets={k:sum(r['amount'] for r in rows if r['business']['accounting_type']==k) for k in ('operating','direct_cost','capital')}
    groups=[]
    assigned=set()
    for group,categories in CATEGORY_GROUPS.items():
        values=[r for r in rows if r['category'] in categories]
        assigned.update(r['id'] for r in values)
        groups.append({'name':group,'amount':sum(r['amount'] for r in values),'categories':categories})
    custom=[r for r in rows if r['id'] not in assigned]
    if custom:
        groups.append({'name':'Custom categories','amount':sum(r['amount'] for r in custom),'categories':sorted({r['category'] for r in custom})})
    return {'buckets':buckets,'total':sum(r['amount'] for r in rows),'included_tax':sum(r['business']['tax_amount'] for r in rows),'reimbursements_pending':sum(r['amount'] for r in rows if r['business']['reimbursement']=='pending'),'billable':sum(r['amount'] for r in rows if r['business']['billable']),'groups':groups,'catalog':CATEGORY_GROUPS,'reimbursement_records':[r['id'] for r in rows if r['business']['reimbursement']=='pending'],'billable_records':[r['id'] for r in rows if r['business']['billable']]}
