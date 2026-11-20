import json
import csv
import io
import sys
from pathlib import Path
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).parent))
import test_api as api_tests
from test_api import Client
import server


class WorkspaceDashboardTests(api_tests.APITests):
    # Use the shared HTTP fixture without duplicating the base class test cases.
    def new_workspace(self, kind, settings=None):
        # Business workspaces belong to Business accounts; switch this test's client once.
        if kind == 'Business' and getattr(self, 'client_type', 'personal_household') != 'business':
            self.client = Client(self.base).signup(server.uid() + '@example.com', 'business')
            self.client_type = 'business'
        status, body, _ = self.client.call('/api/workspaces','POST',{'name':kind+' test','kind':kind,'settings':settings or {}})
        self.assertEqual(status,201,body)
        return '/api/workspaces/'+body['id']+'/'

    def plan(self,path,type_,**kwargs):
        payload={'type':type_,'name':'Test '+type_,'amount':'100','date':date.today().isoformat(),'owner':'Shared',**kwargs}
        status,body,_=self.client.call(path+'planning','POST',payload)
        self.assertEqual(status,201,body)
        return body['id']

    def test_running_balance_carries_forward(self):
        path=self.new_workspace('Personal',{'salary_day':24,'tracking_start':'2026-01-24','tracking_balance':'20000'})
        status, salary, _=self.client.call(path+'transactions','POST',self.transaction(amount='75000',kind='income',category='Salary',date='2026-01-24'))
        self.assertEqual(status,201)
        _,d,_=self.client.call(path+'dashboard')
        self.assertEqual(d['cash_tracker']['available'],9500000)
        self.client.call(path+'transactions','POST',self.transaction(amount='6000',date='2026-02-02'))
        self.client.call(path+'transactions','POST',self.transaction(amount='999',date='2026-01-23'))
        _,d,_=self.client.call(path+'dashboard?month=2026-03')
        self.assertEqual(d['cash_tracker']['available'],8900000)
        self.client.call(path+'transactions/'+salary['id'],'DELETE')
        _,d,_=self.client.call(path+'dashboard')
        self.assertEqual(d['cash_tracker']['available'],1400000)

    def test_personal_cycle_fixed_costs_and_safe_estimate(self):
        salary_day=min(date.today().day,28)
        path=self.new_workspace('Personal',{'salary_day':salary_day,'opening_balance':'500','savings_reserve':'100'})
        self.client.call(path+'transactions','POST',self.transaction(amount='1000',kind='income',category='Salary'))
        self.client.call(path+'transactions','POST',self.transaction(amount='200',cost_type='fixed'))
        self.client.call(path+'transactions','POST',self.transaction(amount='50',cost_type='variable'))
        self.plan(path,'bill',amount='150',date=(date.today()-timedelta(days=1)).isoformat())
        status,d,_=self.client.call(path+'dashboard?period=salary')
        self.assertEqual(status,200,d)
        self.assertEqual(d['fixed'],20000)
        self.assertEqual(d['variable'],5000)
        self.assertEqual(d['income'],100000)
        self.assertEqual(d['remaining'],75000)
        self.assertEqual(d['savings_rate'],75)
        self.assertEqual(d['safe_to_spend'],100000)  # 500 + 750 - 150 - 100
        self.assertEqual(d['safe_basis']['commitments'],15000)
        self.assertEqual(d['cycle_start'][-2:],str(salary_day).zfill(2))

    def test_household_private_and_redacted_everywhere(self):
        path=self.new_workspace('Household')
        email=server.uid()+'@example.com'
        member=Client(self.base).signup(email)
        self.client.invite(path,member)
        _,private,_=member.call(path+'transactions','POST',self.transaction(merchant='Secret merchant',notes='Secret details',amount='100',visibility='private'))
        _,redacted,_=member.call(path+'transactions','POST',self.transaction(merchant='Hidden merchant',notes='Hidden notes',amount='200',visibility='amount-only'))
        member.call(path+'transactions','POST',self.transaction(merchant='Visible merchant',amount='300',visibility='shared',owner='Shared'))
        self.assertEqual(len(member.call(path+'transactions')[1]),3)
        for resource in ['transactions','overview','dashboard','insights','export','audit']:
            status,data,_=self.client.call(path+resource)
            self.assertEqual(status,200,resource)
            text=json.dumps(data)
            self.assertNotIn('Secret merchant',text,resource)
            self.assertNotIn('Hidden merchant',text,resource)
            self.assertNotIn('Hidden notes',text,resource)
            self.assertNotIn(private['id'],text,resource)
        rows=self.client.call(path+'transactions')[1]
        self.assertEqual(len(rows),2)
        masked=next(r for r in rows if r['id']==redacted['id'])
        self.assertTrue(masked['redacted'])
        self.assertEqual(masked['amount'],20000)
        self.assertEqual(self.client.call(path+'transactions?q=Hidden')[1],[])
        self.assertEqual(self.client.call(path+'transactions?category=Groceries')[1][0]['merchant'],'Visible merchant')
        self.assertEqual(self.client.call(path+'transactions/'+private['id'],'DELETE')[0],404)
        self.assertEqual(self.client.call(path+'transactions/'+redacted['id'],'PUT',self.transaction())[0],404)
        household=self.client.call(path+'dashboard')[1]
        self.assertEqual(household['shared'],30000)
        self.assertEqual(household['redacted'],20000)
        summary=self.client.call(path+'overview')[1]
        self.assertEqual(summary['private_amount'],20000)
        self.assertEqual(summary['exceptional'],0)
        self.assertEqual(summary['discretionary'],30000)

    def test_household_events_dependents_and_contributions(self):
        path=self.new_workspace('Household')
        event=self.plan(path,'event',name='Festival',amount='500')
        child=self.plan(path,'dependent',name='Child',owner='Child',amount=0)
        self.plan(path,'contribution',name='Shared funding',owner='Parent',amount='1000')
        self.client.call(path+'transactions','POST',self.transaction(amount='125',classification='event',event_id=event,dependent_id=child,owner='Child'))
        # A matching "Assigned to" name alone no longer links an expense to a dependent.
        self.client.call(path+'transactions','POST',self.transaction(amount='7',owner='Child',classification='one-time'))
        d=self.client.call(path+'dashboard')[1]
        self.assertEqual(d['events'][0]['spent'],12500)
        self.assertEqual(d['dependent_costs'][0]['amount'],12500)
        self.assertEqual(d['contributions'][0]['amount'],100000)
        self.assertEqual(d['baseline'],0)
        self.assertEqual(len(self.client.call(path+'transactions?event_id='+event)[1]),1)
        self.client.call(path+'planning/'+event,'DELETE')
        self.assertEqual(self.client.call(path+'transactions')[1][0]['event_id'],'')

    def test_spent_by_dependent_and_event_links_recalculate(self):
        path=self.new_workspace('Household')
        me=self.client.call('/api/auth/me')[1]['user']['id']
        partner=Client(self.base).signup(server.uid()+'@example.com')
        idle=Client(self.base).signup(server.uid()+'@example.com')
        for c,role in ((partner,'member'),(idle,'viewer')):
            self.client.invite(path,c,role)
        partner_id=partner.call('/api/auth/me')[1]['user']['id']
        idle_id=idle.call('/api/auth/me')[1]['user']['id']
        school=self.plan(path,'dependent',name='School Fees',owner='Shared',amount=0)
        event=self.plan(path,'event',name='Diwali',amount='30000',date=(date.today()+timedelta(days=40)).isoformat())
        # Spent by: defaults to the signed-in member; can be set to another member; must be a current member.
        status,mine,_=self.client.call(path+'transactions','POST',self.transaction(amount='14500',merchant='Festival shopping',event_id=event))
        self.assertEqual(status,201)
        status,fees,_=self.client.call(path+'transactions','POST',self.transaction(amount='8000',merchant='School fees',dependent_id=school,spent_by=partner_id))
        self.assertEqual(status,201)
        self.assertEqual(self.client.call(path+'transactions','POST',self.transaction(spent_by='not-a-member'))[0],400)
        # Created by stays the recorder even when Spent by is someone else.
        row=next(r for r in self.client.call(path+'transactions')[1] if r['id']==fees['id'])
        self.assertEqual((row['created_by'],row['spent_by']),(me,partner_id))
        ms={m['id']:m['amount'] for m in self.client.call(path+'overview')[1]['member_spending']['members']}
        self.assertEqual(ms,{me:1450000,partner_id:800000,idle_id:0})
        d=self.client.call(path+'dashboard')[1]
        ev=d['events'][0]; dep=d['dependent_costs'][0]
        self.assertEqual((ev['spent'],ev['remaining'],len(ev['evidence'])),(1450000,1550000,1))
        self.assertEqual((dep['name'],dep['amount'],len(dep['evidence'])),('School Fees',800000,1))
        self.assertEqual({m['id'] for m in d['household_members']},{me,partner_id,idle_id})
        # Linking reuses the original expense: no new transaction is created.
        count=len(self.client.call(path+'transactions')[1])
        self.assertEqual(self.client.call(path+'transactions/'+mine['id'],'PUT',self.transaction(amount='14500',merchant='Festival shopping',event_id=event,dependent_id=school))[0],200)
        self.assertEqual(len(self.client.call(path+'transactions')[1]),count)
        self.assertEqual(self.client.call(path+'dashboard')[1]['dependent_costs'][0]['amount'],2250000)
        # Relink and edit amount: totals follow. An edit that omits a link keeps it.
        self.client.call(path+'transactions/'+mine['id'],'PUT',self.transaction(amount='10000',merchant='Festival shopping',event_id=event,dependent_id=''))
        self.client.call(path+'transactions/'+fees['id'],'PUT',{**self.transaction(amount='9000',merchant='School fees'),'spent_by':partner_id})
        d=self.client.call(path+'dashboard')[1]
        self.assertEqual((d['events'][0]['spent'],d['events'][0]['remaining'],d['dependent_costs'][0]['amount']),(1000000,2000000,900000))
        self.assertEqual(len(self.client.call(path+'transactions?event_id='+event)[1]),1)
        self.assertEqual(len(self.client.call(path+'transactions?dependent_id='+school)[1]),1)
        # Deleting recalculates.
        self.client.call(path+'transactions/'+mine['id'],'DELETE')
        d=self.client.call(path+'dashboard')[1]
        self.assertEqual((d['events'][0]['spent'],d['events'][0]['evidence']),(0,[]))
        # Old records without Spent by are Unassigned (never guessed) and can be corrected.
        with server.connect() as db:
            db.execute("UPDATE transactions SET spent_by='' WHERE id=?",(fees['id'],))
        ms=self.client.call(path+'overview')[1]['member_spending']
        self.assertEqual((ms['unattributed'],ms['unassigned_count']),(900000,1))
        self.assertEqual([r['id'] for r in self.client.call(path+'transactions?spent_by=unassigned')[1]],[fees['id']])
        self.client.call(path+'transactions/'+fees['id'],'PUT',{**self.transaction(amount='9000',merchant='School fees'),'spent_by':idle_id})
        ms=self.client.call(path+'overview')[1]['member_spending']
        self.assertEqual((ms['unattributed'],{m['id']:m['amount'] for m in ms['members']}[idle_id]),(0,900000))
        # Links are validated against this workspace; other workspaces cannot see or use them.
        other=self.new_workspace('Household')
        self.assertEqual(self.client.call(other+'transactions','POST',self.transaction(dependent_id=school))[0],400)
        self.assertEqual(self.client.call(other+'transactions','POST',self.transaction(event_id=event))[0],400)
        outsider=Client(self.base).signup(server.uid()+'@example.com')
        self.assertEqual(outsider.call(path+'dashboard')[0],404)
        # Restart (migration re-run) keeps everything.
        server.initialize()
        self.assertEqual(self.client.call(path+'dashboard')[1]['dependent_costs'][0]['amount'],900000)

    def test_business_approval_policy_project_forecast_pipeline(self):
        path=self.new_workspace('Business',{'pipeline_enabled':True})
        project=self.plan(path,'project',name='Project A',amount='2000',extra={'client':'Client A'})
        self.plan(path,'policy',name='Travel limit',amount='100',category='Travel')
        self.plan(path,'department-budget',name='Engineering',owner='Engineering',amount='1000')
        request=self.plan(path,'approval',name='Trip',amount='200',category='Travel',status='pending')
        self.plan(path,'opportunity',amount='1000',extra={'probability':60,'client':'Client A'},status='open')
        self.plan(path,'bill',amount='300',category='Software')
        self.client.call(path+'transactions','POST',self.transaction(amount='150',category='Travel',owner='Engineering',project_id=project,cost_type='fixed'))
        self.client.call(path+'transactions','POST',self.transaction(amount='50',category='Software',cost_type='fixed'))
        d=self.client.call(path+'dashboard')[1]
        self.assertEqual(d['operating_spend'],20000)
        self.assertEqual(d['committed'],30000)
        self.assertEqual(d['forecast'],50000)
        self.assertEqual(d['department_budgets'][0]['spent'],15000)
        self.assertEqual(len(d['policy_flags']),2)
        self.assertEqual(d['projects'][0]['spent'],15000)
        # Vendor/SaaS spend now comes only from explicit links; category alone does not count.
        self.assertEqual((d['saas'],d['vendor_costs']['actual'],d['vendor_costs']['unlinked_count']),(0,0,2))
        self.assertEqual(d['weighted_pipeline'],60000)
        insight=self.client.call(path+'insights','POST',{'question':'What is my forecast?'})[1]
        self.assertIn('500.00',insight['answer'])
        approval=next(r for r in d['records'] if r['id']==request)
        status,body,_=self.client.call(path+'planning/'+request,'PUT',{**approval,'amount':'1','name':'Tampered','status':'approved'})
        self.assertEqual(status,200,body)
        updated=next(r for r in self.client.call(path+'planning')[1] if r['id']==request)
        self.assertEqual(updated['amount'],20000)
        self.assertEqual(updated['name'],'Trip')
        self.assertIn('decided_at',updated['extra'])
        self.assertEqual(self.client.call(path+'planning/'+request,'PUT',{**updated,'status':'rejected'})[0],403)
        self.assertEqual(self.client.call(path+'overview')[1]['spend'],20000)

    def test_business_patterns_approvals_income_and_vendor_saas(self):
        path=self.new_workspace('Business')
        # 1. Transaction Pattern: new values save; invalid rejected; legacy stored values are preserved on edit.
        status,tx,_=self.client.call(path+'transactions','POST',self.transaction(amount='100',category='Travel',classification='purchase'))
        self.assertEqual(status,201)
        self.assertEqual(next(r for r in self.client.call(path+'transactions')[1] if r['id']==tx['id'])['classification'],'purchase')
        self.assertEqual(self.client.call(path+'transactions','POST',self.transaction(category='Travel',classification='bogus'))[0],400)
        with server.connect() as db:
            db.execute("UPDATE transactions SET classification='emergency' WHERE id=?",(tx['id'],))
        self.assertEqual(self.client.call(path+'transactions/'+tx['id'],'PUT',self.transaction(amount='100',category='Travel',classification='emergency'))[0],200)
        self.assertEqual(next(r for r in self.client.call(path+'transactions')[1] if r['id']==tx['id'])['classification'],'emergency')
        # 2. Income = Revenue = all income transactions in the month; same number in Overview and Analytics.
        self.client.call(path+'transactions','POST',self.transaction(amount='5000',kind='income',category='Revenue',classification='recurring'))
        d=self.client.call(path+'dashboard')[1]; o=self.client.call(path+'overview')[1]
        self.assertEqual((d['revenue'],o['income']),(500000,500000))
        # 4. Approval: submit once; pending is excluded from totals; approval counts it without a new transaction.
        before=o['spend']
        status,sub,_=self.client.call(path+'approval-submissions','POST',{'transaction_id':tx['id']})
        self.assertEqual(status,201)
        self.assertEqual(self.client.call(path+'approval-submissions','POST',{'transaction_id':tx['id']})[0],409)
        row=next(r for r in self.client.call(path+'transactions')[1] if r['id']==tx['id'])
        self.assertEqual((row['approval_status'],row['excluded_from_totals']),('pending',True))
        self.assertEqual(self.client.call(path+'overview')[1]['spend'],before-10000)
        self.assertEqual(self.client.call(path+'transactions/'+tx['id'],'PUT',self.transaction(amount='999',category='Travel'))[0],400)  # amount locked
        member=Client(self.base).signup(server.uid()+'@example.com','business')
        self.client.invite(path,member)
        item=next(r for r in self.client.call(path+'planning')[1] if r['id']==sub['id'])
        self.assertEqual((item['status'],item['extra']['transaction_id']),('pending',tx['id']))
        self.assertEqual(member.call(path+'planning/'+sub['id'],'PUT',{**item,'amount':'100','status':'approved'})[0],403)  # only owners decide
        self.assertEqual(member.call(path+'transactions')[0],200)
        count=len(self.client.call(path+'transactions')[1])
        self.assertEqual(self.client.call(path+'planning/'+sub['id'],'PUT',{**item,'amount':'100','status':'approved'})[0],200)
        self.assertEqual(len(self.client.call(path+'transactions')[1]),count)
        self.assertEqual(self.client.call(path+'overview')[1]['spend'],before)
        self.assertEqual(self.client.call(path+'approval-submissions','POST',{'transaction_id':tx['id']})[0],409)
        # Rejected: excluded; can be resubmitted once.
        status,tx2,_=self.client.call(path+'transactions','POST',self.transaction(amount='40',category='Travel',classification='travel'))
        sub2=self.client.call(path+'approval-submissions','POST',{'transaction_id':tx2['id']})[1]
        item2=next(r for r in self.client.call(path+'planning')[1] if r['id']==sub2['id'])
        self.client.call(path+'planning/'+sub2['id'],'PUT',{**item2,'amount':'40','status':'rejected'})
        self.assertEqual(self.client.call(path+'overview')[1]['spend'],before)
        self.assertEqual(self.client.call(path+'approval-submissions','POST',{'transaction_id':tx2['id']})[0],201)
        # 5. Vendor/SaaS: stable links, each expense once, scheduled renewals separate, list agrees with total.
        vendor=self.plan(path,'vendor',name='Acme Hosting',amount=0)
        status,s,_=self.client.call(path+'subscriptions','POST',{'name':'Design tool','amount':'30','cadence':'monthly','renewal':date.today().isoformat(),'category':'Software'})
        self.assertEqual(self.client.call(path+'dashboard')[1]['vendor_costs']['actual'],0)    # creating a subscription is not spend
        both=self.client.call(path+'transactions','POST',self.transaction(amount='70',category='Cloud hosting',classification='monthly',vendor_id=vendor,subscription_id=s['id']))[1]
        self.client.call(path+'subscription-payments','POST',{'subscription_id':s['id'],'occurrence':date.today().isoformat()})
        vc=self.client.call(path+'dashboard')[1]['vendor_costs']
        self.assertEqual((vc['actual'],vc['count']),(7000+3000,2))                              # 70 counted once despite two links
        self.assertEqual(next(v for v in vc['vendors'] if v['id']==vendor)['amount'],7000)
        self.assertEqual(next(v for v in vc['subscriptions'] if v['id']==s['id'])['amount'],10000)
        listed=self.client.call(path+'transactions?vendor_link=linked&kind=expense&month='+date.today().strftime('%Y-%m'))[1]
        self.assertEqual(sum(r['amount'] for r in listed),vc['actual'])
        # Correcting a missing association by editing; link validation; isolation.
        self.assertEqual(self.client.call(path+'transactions/'+tx2['id'],'PUT',{**self.transaction(amount='40',category='Travel',classification='travel'),'vendor_id':vendor})[0],200)
        other=self.new_workspace('Business')
        self.assertEqual(self.client.call(other+'transactions','POST',self.transaction(category='Travel',vendor_id=vendor))[0],400)
        self.assertEqual(self.client.call(other+'transactions','POST',self.transaction(category='Travel',subscription_id=s['id']))[0],400)
        self.assertEqual(self.client.call(other+'approval-submissions','POST',{'transaction_id':tx['id']})[0],404)
        server.initialize()
        self.assertEqual(self.client.call(path+'dashboard')[1]['vendor_costs']['actual'],vc['actual'])

    def test_planning_roles_types_and_cross_workspace_allocations(self):
        path=self.new_workspace('Business')
        other=self.new_workspace('Business')
        project=self.plan(other,'project',extra={'client':'Other'})
        self.assertEqual(self.client.call(path+'transactions','POST',self.transaction(category='Travel',project_id=project))[0],400)
        self.assertEqual(self.client.call(path+'planning','POST',{'type':'dependent'})[0],400)
        email=server.uid()+'@example.com'
        member=Client(self.base).signup(email,'business')
        self.assertEqual(self.client.invite(path,member)[0],200)
        self.assertEqual(member.call(path+'planning','POST',{'type':'policy'})[0],403)
        payload={'type':'approval','name':'Request','amount':'100','date':date.today().isoformat(),'status':'pending'}
        status,body,_=member.call(path+'planning','POST',payload)
        self.assertEqual(status,201)
        self.assertEqual(member.call(path+'planning/'+body['id'],'PUT',{**payload,'status':'approved'})[0],403)
        self.assertEqual(member.call(other+'planning')[0],404)
        self.client.call(path+'members','POST',{'email':email,'role':'viewer'})
        self.assertEqual(member.call(path+'planning','POST',payload)[0],403)
        self.assertEqual(member.call(path+'dashboard')[0],200)

    def test_demo_dashboard_migration_idempotent(self):
        demo=Client(self.base)
        _,auth,_=demo.call('/api/auth/demo','POST',{})
        demo.csrf=auth['csrf']
        workspaces=demo.call('/api/auth/me')[1]['workspaces']
        before={w['id']:len(demo.call('/api/workspaces/'+w['id']+'/planning')[1]) for w in workspaces}
        server.initialize()
        for w in workspaces:
            path='/api/workspaces/'+w['id']+'/'
            self.assertEqual(len(demo.call(path+'planning')[1]),before[w['id']])
            self.assertGreater(before[w['id']],0)
            self.assertEqual(demo.call(path+'dashboard')[0],200)

    def test_personal_household_share_all_dashboard_capabilities(self):
        required={'income','spend','remaining','savings_rate','fixed','variable','safe_to_spend','cycle_start','shared','individual','dependent_costs','contributions','events','privacy'}
        for kind in ('Personal','Household'):
            path=self.new_workspace(kind)
            for type_ in ('bill','event','contribution','dependent'):
                self.plan(path,type_)
            self.assertTrue(required <= self.client.call(path+'dashboard')[1].keys())
            _,record,_=self.client.call(path+'transactions','POST',self.transaction(visibility='private'))
            email=server.uid()+'@example.com'
            member=Client(self.base).signup(email)
            status=self.client.invite(path,member,'viewer')[0]
            if kind=='Personal':
                # Personal workspaces cannot be shared at all.
                self.assertEqual(status,403)
                self.assertEqual(member.call(path+'transactions')[0],404)
                continue
            self.assertEqual(status,200)
            self.assertEqual(member.call(path+'transactions')[1],[])
            self.assertNotIn(record['id'],json.dumps(member.call(path+'dashboard')[1]))

    def test_business_details_export_filters_and_no_double_counting(self):
        path=self.new_workspace('Business')
        category_names={r['name'] for r in self.client.call(path+'categories')[1]}
        self.assertTrue({'Insurance','Inventory & materials','Equipment & hardware','Bank & payment fees','Employee benefits','Accommodation'}<=category_names)
        business={'invoice_reference':'INV-TEST-42','business_purpose':'Client workshop','cost_center':'CC-01','employee':'Test Employee','paid_by':'employee','reimbursement':'pending','billable':True,'billable_client':'Test Client','accounting_type':'operating','tax_amount':'18'}
        status,created,_=self.client.call(path+'transactions','POST',self.transaction(amount='118',category='Business meals',business=business))
        self.assertEqual(status,201,created)
        self.client.call(path+'transactions','POST',self.transaction(amount='500',category='Equipment & hardware',business={'accounting_type':'capital'}))
        self.client.call(path+'transactions','POST',self.transaction(amount='200',category='Inventory & materials',business={'accounting_type':'direct_cost'}))
        self.client.call(path+'transactions','POST',self.transaction(amount='1000',category='Revenue',kind='income'))
        dashboard=self.client.call(path+'dashboard')[1]
        tracking=dashboard['business_tracking']
        self.assertEqual(tracking['total'],81800)
        self.assertEqual(tracking['included_tax'],1800)
        self.assertEqual(tracking['reimbursements_pending'],11800)
        self.assertEqual(tracking['billable'],11800)
        self.assertEqual(tracking['buckets'],{'operating':11800,'capital':50000,'direct_cost':20000})
        self.assertEqual(dashboard['operating_spend'],11800)
        self.assertEqual(sum(g['amount'] for g in tracking['groups']),81800)
        self.assertEqual(self.client.call(path+'overview')[1]['spend'],81800)
        for query in ('q=INV-TEST-42','q=CC-01','q=Test%20Client','billable=true','reimbursement=pending'):
            rows=self.client.call(path+'transactions?'+query)[1]
            self.assertEqual(len(rows),1,query)
            self.assertEqual(rows[0]['id'],created['id'])
        exported=self.client.call(path+'export?reimbursement=pending')[1]
        row=list(csv.DictReader(io.StringIO(exported)))[0]
        self.assertEqual(row['tax_amount'],'18.00')
        self.assertEqual(row['net_amount'],'100.00')
        self.assertEqual(row['amount'],'118.00')
        self.assertEqual(row['employee'],'Test Employee')
        self.assertEqual(row['invoice_reference'],'INV-TEST-42')
        # Updating via a legacy client preserves metadata and rejects a too-low total.
        self.assertEqual(self.client.call(path+'transactions/'+created['id'],'PUT',self.transaction(amount='150',category='Business meals'))[0],200)
        self.assertEqual(self.client.call(path+'transactions?q=INV-TEST-42')[1][0]['business']['tax_amount'],1800)
        self.assertEqual(self.client.call(path+'transactions/'+created['id'],'PUT',self.transaction(amount='10',category='Business meals'))[0],400)

    def linked(self, path, prefix):
        return [r for r in self.client.call(path+'transactions')[1] if r['source_ref'].startswith(prefix)]

    def test_bill_paid_creates_one_linked_expense_and_undo(self):
        path=self.new_workspace('Household')
        bill=self.plan(path,'bill',name='Water bill',amount='150',category='Utilities',date=(date.today()+timedelta(days=5)).isoformat())
        before=self.client.call(path+'overview')[1]['spend']
        record=next(r for r in self.client.call(path+'planning')[1] if r['id']==bill)
        payload={**record,'amount':'150','status':'paid','paid_on':date.today().isoformat()}
        # Repeated clicks and concurrent retries still create exactly one expense.
        import threading
        statuses=[]
        threads=[threading.Thread(target=lambda: statuses.append(self.client.call(path+'planning/'+bill,'PUT',payload)[0])) for _ in range(5)]
        [t.start() for t in threads];[t.join() for t in threads]
        self.assertEqual(statuses,[200]*5)
        self.assertEqual(self.client.call(path+'planning/'+bill,'PUT',payload)[0],200)
        linked=self.linked(path,'bill:'+bill)
        self.assertEqual(len(linked),1)
        tx=linked[0]
        self.assertEqual((tx['amount'],tx['category'],tx['date'],tx['kind'],tx['merchant']),(15000,'Utilities',date.today().isoformat(),'expense','Water bill'))
        overview=self.client.call(path+'overview')[1]
        self.assertEqual(overview['spend'],before+15000)
        self.assertEqual(overview['transactions'][0]['id'],tx['id'])
        dashboard=self.client.call(path+'dashboard')[1]
        self.assertNotIn(bill,[r['id'] for r in dashboard['upcoming']])
        # Persists across a restart/migration.
        server.initialize()
        self.assertEqual(len(self.linked(path,'bill:'+bill)),1)
        # Undo removes the expense; paying again recreates exactly one.
        self.assertEqual(self.client.call(path+'planning/'+bill,'PUT',{**payload,'status':'active'})[0],200)
        self.assertEqual(self.linked(path,'bill:'+bill),[])
        self.assertEqual(self.client.call(path+'overview')[1]['spend'],before)
        self.client.call(path+'planning/'+bill,'PUT',payload)
        tx=self.linked(path,'bill:'+bill)[0]
        # Deleting the expense from Transactions marks the bill unpaid again.
        self.assertEqual(self.client.call(path+'transactions/'+tx['id'],'DELETE')[0],200)
        self.assertEqual(next(r for r in self.client.call(path+'planning')[1] if r['id']==bill)['status'],'active')
        future={**payload,'paid_on':(date.today()+timedelta(days=1)).isoformat()}
        self.assertEqual(self.client.call(path+'planning/'+bill,'PUT',future)[0],400)
        self.assertEqual(self.linked(path,'bill:'+bill),[])

    def test_subscription_payment_per_occurrence_and_isolation(self):
        path=self.new_workspace('Personal')
        renewal=date.today().replace(day=min(date.today().day,28))
        status,sub,_=self.client.call(path+'subscriptions','POST',{'name':'Music','amount':'99','cadence':'monthly','renewal':renewal.isoformat(),'category':'Subscriptions'})
        self.assertEqual(status,201)
        # Creating a subscription records no expense, but it appears in upcoming renewals and the Subscriptions list.
        self.assertEqual(self.client.call(path+'transactions')[1],[])
        self.assertIn(sub['id'],[r['id'] for r in self.client.call(path+'dashboard')[1]['upcoming']])
        self.assertEqual([s['id'] for s in self.client.call(path+'subscriptions')[1]],[sub['id']])
        pay={'subscription_id':sub['id'],'occurrence':renewal.isoformat(),'paid_on':date.today().isoformat()}
        status,first,_=self.client.call(path+'subscription-payments','POST',pay)
        self.assertEqual(status,201,first)
        for _ in range(3):
            status,again,_=self.client.call(path+'subscription-payments','POST',pay)
            self.assertEqual((status,again['created'],again['id']),(200,False,first['id']))
        self.assertEqual(len(self.linked(path,'subscription:')),1)
        next_renewal=self.client.call(path+'subscriptions')[1][0]['renewal']
        self.assertEqual(next_renewal,first['renewal'])
        self.assertGreater(next_renewal,renewal.isoformat())
        self.assertEqual(next(r for r in self.client.call(path+'dashboard')[1]['upcoming'] if r['id']==sub['id'])['date'],next_renewal)
        # A stale or invented occurrence cannot create a payment; the next real renewal can.
        self.assertEqual(self.client.call(path+'subscription-payments','POST',{**pay,'occurrence':'2020-01-01'})[0],409)
        self.assertEqual(self.client.call(path+'subscription-payments','POST',{**pay,'occurrence':next_renewal})[0],201)
        self.assertEqual(len(self.linked(path,'subscription:')),2)
        # Editing from either view updates the single subscriptions source.
        sub_row=self.client.call(path+'subscriptions')[1][0]
        self.assertEqual(self.client.call(path+'subscriptions/'+sub['id'],'PUT',{**sub_row,'amount':'120'})[0],200)
        self.assertEqual(next(r for r in self.client.call(path+'dashboard')[1]['upcoming'] if r['id']==sub['id'])['amount'],12000)
        # Other workspaces and other users cannot pay this subscription.
        other=self.new_workspace('Household')
        self.assertEqual(self.client.call(other+'subscription-payments','POST',pay)[0],404)
        outsider=Client(self.base).signup(server.uid()+'@example.com')
        self.assertEqual(outsider.call(path+'subscription-payments','POST',pay)[0],404)
        self.assertEqual(self.client.call(other+'transactions')[1],[])

    def test_business_bill_payment_and_viewer_blocked(self):
        path=self.new_workspace('Business')
        bill=self.plan(path,'bill',name='Hosting',amount='500',category='Software',owner='Operations')
        record=next(r for r in self.client.call(path+'planning')[1] if r['id']==bill)
        email=server.uid()+'@example.com'
        viewer=Client(self.base).signup(email,'business')
        self.client.invite(path,viewer,'viewer')
        self.assertEqual(viewer.call(path+'planning/'+bill,'PUT',{**record,'amount':'500','status':'paid'})[0],403)
        self.assertEqual(self.client.call(path+'planning/'+bill,'PUT',{**record,'amount':'500','status':'paid'})[0],200)
        rows=self.linked(path,'bill:'+bill)
        self.assertEqual(len(rows),1)
        self.assertEqual(self.client.call(path+'dashboard')[1]['operating_spend'],50000)
        self.assertIn('Hosting',self.client.call(path+'export')[1])

    def test_household_member_spending_by_member_id_and_privacy(self):
        path=self.new_workspace('Household')
        member=Client(self.base).signup(server.uid()+'@example.com')
        viewer=Client(self.base).signup(server.uid()+'@example.com')
        self.client.invite(path,member)
        self.client.invite(path,viewer,'viewer')
        self.client.call(path+'transactions','POST',self.transaction(amount='100'))
        member.call(path+'transactions','POST',self.transaction(amount='200'))
        member.call(path+'transactions','POST',self.transaction(amount='300',visibility='private'))
        member.call(path+'transactions','POST',self.transaction(amount='400',visibility='amount-only'))
        owner_view=self.client.call(path+'overview')[1]
        ms=owner_view['member_spending']
        by_id={m['id']:m['amount'] for m in ms['members']}
        member_id=member.call('/api/auth/me')[1]['user']['id']
        viewer_id=viewer.call('/api/auth/me')[1]['user']['id']
        owner_id=self.client.call('/api/auth/me')[1]['user']['id']
        self.assertEqual(by_id,{owner_id:10000,member_id:20000,viewer_id:0})  # zero-spend viewer included
        self.assertEqual((ms['private'],ms['unattributed']),(40000,0))
        self.assertEqual(sum(by_id.values())+ms['private']+ms['unattributed'],owner_view['spend'])  # private 300 never counted
        # The member sees their own private and amount-only records attributed to themselves.
        mine={m['id']:m['amount'] for m in member.call(path+'overview')[1]['member_spending']['members']}
        self.assertEqual(mine[member_id],90000)
        # Removed members' spending becomes unattributed rather than disappearing or being re-labelled.
        self.client.call(path+'members/'+member_id,'DELETE')
        ms=self.client.call(path+'overview')[1]['member_spending']
        self.assertNotIn(member_id,[m['id'] for m in ms['members']])
        self.assertEqual(ms['unattributed'],20000)

    def test_member_invitations_by_email(self):
        import re, sqlite3
        from contextlib import closing
        import accounts
        outbox = api_tests.OUTBOX
        token_of = lambda: re.search(r'token=([\w-]+)', outbox[-1]['text']).group(1)
        for kind in ('Household', 'Business'):
            path = self.new_workspace(kind)
            account = 'business' if kind == 'Business' else 'personal_household'
            ws_name = kind + ' test'
            friend = Client(self.base).signup(server.uid() + '@example.com', account)
            # The invitee's email is required and validated.
            self.assertEqual(self.client.call(path + 'members', 'POST', {'role': 'member'})[0], 400)
            self.assertEqual(self.client.call(path + 'members', 'POST', {'identifier': friend.username, 'role': 'member'})[0], 400)
            self.assertEqual(self.client.call(path + 'members', 'POST', {'email': 'not-an-email', 'role': 'member'})[0], 400)
            # Sending: exact wording, link to the invitation, nothing granted yet.
            status, body, _ = self.client.call(path + 'members', 'POST', {'email': friend.email.upper(), 'role': 'viewer'})
            self.assertEqual((status, body['access_granted']), (201, False), body)
            mail = outbox[-1]
            self.assertEqual(mail['to'], friend.email)
            self.assertIn(f'Test User has invited you to join {ws_name} on Trikosh. Log in to see more.', mail['text'])
            self.assertIn('Accept invitation: https://trikosh.test/invite?token=', mail['text'])
            first = token_of()
            self.assertEqual(friend.call(path + 'transactions')[0], 404)
            # No duplicate pending invitations.
            self.assertEqual(self.client.call(path + 'members', 'POST', {'email': friend.email, 'role': 'member'})[0], 409)
            listed = [m for m in self.client.call(path + 'members')[1] if m.get('invite')]
            self.assertEqual([(m['email'], m['role'], m['status']) for m in listed], [(friend.email, 'viewer', 'pending')])
            invite_id = listed[0]['id']
            # Preview needs no login and shows only what the recipient needs.
            status, preview, _ = Client(self.base).call('/api/invites/preview?token=' + first)
            self.assertEqual((status, preview['workspace_name'], preview['email'], preview['account_type']), (200, ws_name, friend.email, account))
            # Resend issues a new link; the old one stops working.
            self.assertEqual(self.client.call(path + 'members/' + invite_id, 'POST', {})[0], 200)
            second = token_of()
            self.assertNotEqual(first, second)
            self.assertEqual(friend.call('/api/invites/accept', 'POST', {'token': first})[0], 404)
            # Only the matching email can accept.
            stranger = Client(self.base).signup(server.uid() + '@example.com', account)
            status, body, _ = stranger.call('/api/invites/accept', 'POST', {'token': second})
            self.assertEqual(status, 403)
            self.assertIn(friend.email, body['error'])
            self.assertEqual(stranger.call(path + 'transactions')[0], 404)
            self.assertEqual(Client(self.base).call('/api/invites/accept', 'POST', {'token': second})[0], 401)
            # Accepting grants the invited role and verifies the email; the link is single-use.
            status, body, _ = friend.call('/api/invites/accept', 'POST', {'token': second})
            self.assertEqual((status, body['workspace_name'], body['switch_account_type']), (200, ws_name, False))
            self.assertEqual(friend.call(path + 'transactions')[0], 200)
            self.assertEqual(friend.call(path + 'transactions', 'POST', self.transaction())[0], 403)  # viewer
            self.assertEqual(friend.call('/api/invites/accept', 'POST', {'token': second})[0], 404)
            self.assertFalse(any(m.get('invite') for m in self.client.call(path + 'members')[1]))
            with closing(sqlite3.connect(server.DB_PATH)) as db, db:
                self.assertTrue(db.execute('SELECT email_verified_at FROM users WHERE email=?', (friend.email,)).fetchone()[0])
            # Existing members: the same form changes the role without another invitation.
            sent = len(outbox)
            status, body, _ = self.client.call(path + 'members', 'POST', {'email': friend.email, 'role': 'member'})
            self.assertEqual((status, body.get('role_updated')), (200, True))
            self.assertEqual(len(outbox), sent)
            self.assertEqual(next(m['role'] for m in self.client.call(path + 'members')[1] if m.get('email') == friend.email), 'member')
            # Only the owner can invite.
            self.assertEqual(friend.call(path + 'members', 'POST', {'email': 'x@example.com', 'role': 'member'})[0], 403)

        # Delivery failure: the error is shown, the invitation stays pending, and Resend retries.
        path = self.new_workspace('Household') if self.client_type != 'business' else self.new_workspace('Business')
        real_send = accounts.send_email
        def failing(*args):
            raise OSError('SMTP connection refused')
        accounts.send_email = failing
        try:
            status, body, _ = self.client.call(path + 'members', 'POST', {'email': 'later@example.com', 'role': 'member'})
        finally:
            accounts.send_email = real_send
        self.assertEqual(status, 502)
        self.assertIn('SMTP connection refused', body['error'])
        self.assertIn('Use Resend', body['error'])
        row = next(m for m in self.client.call(path + 'members')[1] if m.get('invite'))
        self.assertIn('SMTP connection refused', row['last_error'])
        self.assertEqual(self.client.call(path + 'members/' + row['id'], 'POST', {})[0], 200)
        row = next(m for m in self.client.call(path + 'members')[1] if m.get('invite'))
        self.assertEqual((row['last_error'], row['sent']), ('', True))
        # Revoking stops the link.
        token = token_of()
        self.assertEqual(self.client.call(path + 'members/' + row['id'], 'DELETE')[0], 200)
        self.assertEqual(Client(self.base).call('/api/invites/preview?token=' + token)[0], 404)

        # Expired links are rejected.
        self.assertEqual(self.client.call(path + 'members', 'POST', {'email': 'old@example.com', 'role': 'member'})[0], 201)
        token = token_of()
        with closing(sqlite3.connect(server.DB_PATH)) as db, db:
            db.execute("UPDATE workspace_invites SET expires='2000-01-01T00:00:00+00:00' WHERE email='old@example.com'")
        self.assertEqual(Client(self.base).call('/api/invites/preview?token=' + token)[0], 404)
        row = next(m for m in self.client.call(path + 'members')[1] if m.get('invite') and m['email'] == 'old@example.com')
        self.assertEqual(row['status'], 'expired')

        # Email delivery not configured: exact settings are reported and nothing is created.
        real_config = accounts.mail_config
        accounts.mail_config = lambda: None
        try:
            status, body, _ = self.client.call(path + 'members', 'POST', {'email': 'nobody@example.com', 'role': 'member'})
        finally:
            accounts.mail_config = real_config
        self.assertEqual(status, 503)
        for setting in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'DOMAIN', 'docker compose up -d'):
            self.assertIn(setting, body['error'])
        self.assertFalse(any(m.get('email') == 'nobody@example.com' for m in self.client.call(path + 'members')[1]))

        # Personal workspaces cannot be shared.
        personal = Client(self.base).signup(server.uid() + '@example.com')
        ppath = '/api/workspaces/' + personal.call('/api/workspaces', 'POST', {'name': 'Mine', 'kind': 'Personal'})[1]['id'] + '/'
        self.assertEqual(personal.call(ppath + 'members', 'POST', {'email': 'x@example.com', 'role': 'member'})[0], 403)

    def test_month_comparison_uses_full_previous_month_when_complete(self):
        path=self.new_workspace('Personal')
        self.client.call(path+'transactions','POST',self.transaction(amount='50',date='2026-03-31'))
        self.client.call(path+'transactions','POST',self.transaction(amount='10',date='2026-03-01'))
        self.client.call(path+'transactions','POST',self.transaction(amount='30',date='2026-04-15'))
        april=self.client.call(path+'overview?month=2026-04')[1]
        self.assertEqual((april['spend'],april['previous_spend'],april['change']),(3000,6000,-50.0))
        future=self.client.call(path+'overview?month=2099-01')[1]
        self.assertEqual((future['previous_spend'],future['change']),(0,None))

    def test_balance_setup_and_edit_create_no_transactions(self):
        path=self.new_workspace('Personal')
        settings=lambda **kw: self.client.call(path+'settings','PUT',{'name':'Personal test','salary_day':1,'tracking_start':date.today().isoformat(),**kw})
        self.assertEqual(settings(tracking_balance='24000')[0],200)
        tracker=self.client.call(path+'dashboard')[1]['cash_tracker']
        self.assertEqual((tracker['configured'],tracker['available']),(True,2400000))
        self.assertEqual(settings(tracking_balance='30500.50')[0],200)
        server.initialize()  # restart
        self.assertEqual(self.client.call(path+'dashboard')[1]['cash_tracker']['available'],3050050)
        self.assertEqual(self.client.call(path+'transactions')[1],[])
        self.assertEqual(self.client.call(path+'overview')[1]['income'],0)
        for bad in ({'tracking_balance':'abc'},{'tracking_balance':'-5'},{'tracking_start':(date.today()+timedelta(days=1)).isoformat(),'tracking_balance':'1'}):
            self.assertEqual(settings(**bad)[0],400,bad)
        self.assertEqual(self.client.call(path+'dashboard')[1]['cash_tracker']['available'],3050050)

    def test_goal_types_persist_and_validate(self):
        path=self.new_workspace('Personal')
        due=(date.today()+timedelta(days=365)).isoformat()
        ids={}
        for goal_type in ('fd','rd',None):
            payload={'name':'Goal '+str(goal_type),'target':'100000','saved':'2500','due':due}
            if goal_type:
                payload['goal_type']=goal_type
            status,body,_=self.client.call(path+'goals','POST',payload)
            self.assertEqual(status,201,body)
            ids[goal_type or 'savings']=body['id']
        self.assertEqual(self.client.call(path+'goals','POST',{'name':'X','target':'1','due':due,'goal_type':'stocks'})[0],400)
        self.assertEqual(self.client.call(path+'goals/'+ids['fd'],'PUT',{'name':'FD renamed','target':'120000','saved':'5000','due':due,'goal_type':'rd'})[0],200)
        server.initialize()
        goals={g['id']:g for g in self.client.call(path+'goals')[1]}
        self.assertEqual(goals[ids['fd']]['goal_type'],'rd')
        self.assertEqual((goals[ids['fd']]['target'],goals[ids['fd']]['saved']),(12000000,500000))
        self.assertEqual(goals[ids['rd']]['goal_type'],'rd')
        self.assertEqual(goals[ids['savings']]['goal_type'],'savings')
        other=self.new_workspace('Household')
        self.assertEqual(self.client.call(other+'goals')[1],[])
        self.assertEqual(self.client.call(other+'goals/'+ids['rd'],'PUT',{'name':'X','target':'1','due':due})[0],404)

    def test_business_details_validation_and_category_migration(self):
        path=self.new_workspace('Business')
        invalid=[{'tax_amount':'200'},{'tax_amount':'-1'},{'paid_by':'employee'},{'reimbursement':'pending','paid_by':'company'},{'billable':True},{'billable':'true'},{'accounting_type':'pretend'},{'business_purpose':{'bad':'value'}}]
        for details in invalid:
            status,body,_=self.client.call(path+'transactions','POST',self.transaction(amount='100',category='Travel',business=details))
            self.assertEqual(status,400,(details,body))
        before=self.client.call(path+'categories')[1]
        cat=next(r for r in before if r['name']=='Insurance')
        self.client.call(path+'categories/'+cat['id'],'PUT',{'name':'Our insurance'})
        server.initialize()
        after=self.client.call(path+'categories')[1]
        self.assertEqual(len(before),len(after))
        self.assertNotIn('Insurance',{r['name'] for r in after})
        self.assertIn('Our insurance',{r['name'] for r in after})


# Inherited API cases are covered once by test_api.py.
for name in list(api_tests.APITests.__dict__):
    if name.startswith('test_') and name not in WorkspaceDashboardTests.__dict__:
        setattr(WorkspaceDashboardTests,name,None)
