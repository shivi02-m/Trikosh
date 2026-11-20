'use strict';

function workspaceTypeNav(){
  return '';
}

function panel(title,body,action='',label='Manage',subtitle=''){
  return `<section class="panel feature-panel"><div class="panel-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${action?`<button class="text-btn" data-action="${action}">${esc(label)} ${icon('arrow')}</button>`:''}</div>${body}</section>`;
}
function featureRows(rows,emptyText='No records yet.'){
  return rows.length?`<div class="feature-rows">${rows.join('')}</div>`:`<p class="feature-empty">${esc(emptyText)}</p>`;
}
function valueRow(name,value,note='',action='',id=''){
  return `<div class="feature-row"><div><strong>${esc(name)}</strong>${note?`<small>${esc(note)}</small>`:''}</div><div class="feature-value">${value}${action?`<button class="icon-btn" data-action="${action}" data-id="${id}" aria-label="Manage ${esc(name)}">${icon('edit')}</button>`:''}</div></div>`;
}
function smallKpi(label,value,note,symbol='wallet',tone='') {return stat(label,value,symbol,tone,esc(note));}
function dashboard(){
  if(!state.dashboard)return '<div class="boot">Loading your dashboard…</div>';
  return `${toolbar()}<div class="dashboard-columns adaptive-dashboard">${state.workspace.kind==='Business'?businessDashboard():personalDashboard()}</div>`;
}
function insightSidebar(title){return panel(title,`<div class="insight-cards">${state.insights.length?state.insights.map(insightCard).join(''):empty('Your story starts here','Add transactions to see explanations grounded in your records.')}</div><div class="insights-footer"><button class="btn" data-page="insights">${icon('spark')} Ask Trikosh ${icon('arrow')}</button></div>`);}
function recentPanel(){return panel('Recent transactions',transactionTable(state.overview.transactions.slice(0,5),false),'show-transactions','View all',`Calendar month · ${monthLabel()}`);}
function upcomingPanel(title='Upcoming bills & renewals'){
  const d=state.dashboard;
  return panel(title,featureRows(d.upcoming.slice(0,6).map(upcomingRow),'No upcoming commitments. Add bills or subscriptions.'),'manage-bills','Manage','Scheduled costs, separate from posted expenses');
}
// Bills and subscription renewals become expenses only when payment is recorded.
function upcomingRow(r){
  const sub=r.source==='subscription';
  const actions=editable()?`<button class="btn" data-action="${sub?'pay-subscription':'pay-bill'}" data-id="${r.id}" data-occurrence="${r.date}">${icon('check')} ${sub?'Record payment':'Mark paid'}</button><button class="icon-btn" data-action="${sub?'edit-subscription':'edit-plan'}" data-id="${r.id}" aria-label="Manage ${esc(r.name)}">${icon('edit')}</button>`:'';
  return `<div class="feature-row"><div><strong>${esc(r.name)}</strong><small>${dateLabel(r.date)} ${r.date.slice(0,4)} · ${sub?'Subscription':esc(r.owner)}</small></div><div class="feature-value">${money(r.amount)}${actions}</div></div>`;
}
async function payCommitment(target,request,message){
  if(target.disabled)return;
  target.disabled=true;
  try{const result=await request();await load();toast(result.created===false?'Payment was already recorded.':message);}
  finally{if(target.isConnected)target.disabled=false;}
}
function personalDashboard(){
  const d=state.dashboard,t=d.cash_tracker;
  if(!t)return panel('Dashboard update needed','<p class="feature-empty">Restart the Python backend, then refresh this page to load the latest balance features.</p>');
  return `<div class="primary-column personal-money">
    ${panel('Your account balance',`${t.configured?`<div class="safe-number">${exactMoney(t.available)}</div><p class="feature-explainer">Money you started with + income received - expenses recorded since ${esc(t.start_date)}. Unspent money carries forward.</p>`:'<p class="feature-empty">Set the money already in your account to start tracking your available balance.</p>'}<p class="feature-explainer">Example: 20,000 already in your account + 75,000 salary - 6,000 expenses = 89,000 available. This is based on your visible records, not a bank connection.</p>${state.workspace.role==='owner'?'<button class="btn primary panel-action" data-action="personal-settings">'+(t.configured?'Edit balance':'Set up my balance')+'</button>':''}`)}
    <section class="personal-summary"><div class="feature-heading"><div><h2>Income & spending</h2><p>${d.period_mode==='salary'?`${esc(d.cycle_start)} to ${esc(d.cycle_end)}`:esc(monthLabel())}</p></div><div class="tab-group"><button class="${d.period_mode!=='salary'?'active':''}" data-action="personal-period" data-period="calendar">Calendar month</button><button class="${d.period_mode==='salary'?'active':''}" data-action="personal-period" data-period="salary">Salary cycle</button></div></div>
    <div class="salary-cycle-control"><div><strong>Salary day: ${d.settings.salary_day} each month</strong><p class="feature-explainer">Set this to your own payday. Changing it changes the reporting dates; it does not add salary or reset your balance.</p></div>${state.workspace.role==='owner'?'<button class="btn" data-action="change-salary-cycle">Change salary day</button>':''}</div>
    <div class="stats-grid mode-stats">${smallKpi('Income',exactMoney(d.income),'Income recorded in the selected period','wallet','green')}${smallKpi('Total spend',exactMoney(d.spend),'Expenses recorded in the selected period','arrows')}${smallKpi('Income left',exactMoney(d.remaining),'Period income minus spending; excludes earlier money','wallet','blue')}${smallKpi('Savings rate',d.savings_rate===null?'--':d.savings_rate+'%','Share of period income left after spending','target','green')}</div>
    <p class="feature-explainer">Record salary once when received. To correct it, edit the entry in Transactions. Salary cycle starts on your payday in the selected month; your account balance above always shows the balance as of today.</p></section>
    ${panel('Fixed vs variable costs',`<div class="split-metrics"><div><span>Fixed costs</span><strong>${money(d.fixed)}</strong><small>Expenses marked fixed, such as rent</small></div><div><span>Variable costs</span><strong>${money(d.variable)}</strong><small>Changing expenses, such as groceries</small></div></div>`)}
    ${trendPanel()}${recentPanel()}${state.workspace.kind==='Household'?memberSpendingPanel():''}${state.workspace.kind==='Household'?`<details class="simple-more" ${state.showMore?'open':''}><summary>People & shared plans</summary>${sharedFamilySections()}</details>`:''}</div>
    <aside class="secondary-column">${upcomingPanel()}<p class="feature-explainer">Bills are reminders. Your balance reduces when you record the payment as an expense.</p>${goalsPanel()}${renewalsPanel()}${insightSidebar('Your money explained')}</aside>`;
}
function simpleEntry(kind='expense'){
  if(!state.dashboard.cash_tracker.configured&&state.workspace.role==='owner'){personalSettings();return;}
  const income=kind==='income';
  const categories=state.categories.map(c=>c.name);
  const category=income?(categories.find(c=>/salary/i.test(c))||categories.find(c=>/income/i.test(c))||categories[0]):(categories.find(c=>/other/i.test(c))||categories[0]);
  const fields=field(`Amount (${state.workspace.currency})`,'amount','','number')+field(income?'Received on':'Spent on','date',localDate(),'date')+(income?'':field('What did you spend on?','merchant','','text','full')+selectField('Category','category',categories,category)+(state.workspace.kind==='Household'?householdExpenseFields():''));
  openModal(income?'Record salary':'Add expense',`<form><p class="modal-desc">${income?'Enter a salary payment you actually received. Each save adds a NEW income record. To correct an existing salary, edit it in Transactions.':'Record a purchase to update your money left.'}</p><div class="form-grid">${fields}</div><p class="feature-explainer">Shared with members of this workspace.</p><button type="button" class="text-btn" data-action="advanced-entry">Other income or more details</button>${formFooter(income?'Save salary':'Save expense')}</form>`,{onSubmit:async e=>{
    e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));
    const missing=income?'':householdChoiceMissing(form);if(missing){form.querySelector('.form-error').textContent=missing;return;}
    Object.assign(data,{kind,merchant:income?'Salary':data.merchant,category:data.category||category,payment:income?'Bank transfer':'Other',owner:'Me',classification:'regular',essential:false,cost_type:'variable',visibility:'shared',notes:''});
    await submitForm(form,async()=>{await api(endpoint('transactions'),'POST',data);state.month=data.date.slice(0,7);state.filters={};closeModal();await load();toast(income?'Salary recorded. You can start adding expenses.':'Expense saved.');});
  }});
}
function householdExpenseFields(r){
  const members=state.dashboard.household_members||[];
  const current=r?r.spent_by:state.user.id,known=members.some(m=>m.id===current);
  const spentBy=`<label class="field">Spent by<select name="spent_by" required>${known?'':`<option value="" selected>${r?'Unassigned · choose a member':'Choose a member'}</option>`}${members.map(m=>`<option value="${esc(m.id)}" ${m.id===current?'selected':''}>${esc(m.name)}${m.id===state.user.id?' (you)':''}${m.username?' · @'+esc(m.username):''}</option>`).join('')}</select></label>`;
  const link=(label,name,type,value)=>selectField(label,name,[['','Not linked'],...state.dashboard.records.filter(x=>x.type===type).map(x=>[x.id,x.name])],value||'');
  return spentBy+link('Child / dependent cost (optional)','dependent_id','dependent',r?.dependent_id)+link('Event / festival (optional)','event_id','event',r?.event_id);
}
function householdChoiceMissing(form){
  if(state.workspace.kind!=='Household'||form.elements.kind?.value==='income')return '';
  return form.elements.spent_by&&!form.elements.spent_by.value?'Choose who spent this.':'';
}
// Linked records are fetched with the same filters the totals use (event: any date; dependent: selected month).
async function showLinkedRecords(title,params){
  const rows=await api(endpoint('transactions')+'?'+new URLSearchParams({kind:'expense',...params}));
  openModal(title,`<p class="modal-desc">${rows.length} linked record${rows.length===1?'':'s'} · ${params.month?esc(monthLabel()):'all dates'}. Edit an expense in Transactions to change or remove its link.</p>${rows.length?transactionTable(rows,false):'<p class="feature-empty">No linked expenses yet. Edit an expense and choose this item to link it.</p>'}`,{wide:true});
}
function sharedFamilySections(){
  const d=state.dashboard,o=state.overview,total=d.contributions.reduce((s,r)=>s+r.amount,0);
  return `<div class="feature-heading"><h2>People & shared plans</h2><span class="small muted">${monthLabel()}</span></div><div class="stats-grid mode-stats">${smallKpi('Shared spend',money(d.shared),'Assigned to Shared','users')}${smallKpi('Individual spend',money(d.individual),'Visible member-assigned expenses','user','blue')}${smallKpi('Regular baseline',money(d.baseline),'Regular spending; excludes events','home','green')}${smallKpi('Shared-pool contributions',money(total),'Recorded contributions this month','wallet','amber')}</div>
    ${panel('Member contributions',featureRows(d.contributions.map(r=>valueRow(r.owner,money(r.amount),`${r.name} · ${dateLabel(r.date)}`,editable()?'edit-plan':'',r.id)),'Track who contributes to your shared pool.')+'<p class="feature-explainer">Contributions track shared funding separately. They do not create or duplicate income transactions.</p>','manage-contributions','Manage',monthLabel())}
    ${panel('Children & dependent costs',featureRows(d.dependent_costs.map(r=>`<div class="feature-row"><div><strong>${esc(r.name)}</strong><small>${r.evidence.length} linked record${r.evidence.length===1?'':'s'}</small></div><button class="text-btn" data-action="dependent-records" data-id="${r.id}" data-name="${esc(r.name)}">${money(r.amount)} ${icon('arrow')}</button></div>`),'Add an item such as School fees, then link expenses to it.') ,'manage-dependents','Manage',`Linked expenses · ${monthLabel()}`)}
    ${panel('Events & festivals',featureRows(d.events.map(r=>`<div class="event-row"><div class="feature-row"><div><strong>${esc(r.name)}</strong><small>${dateLabel(r.date)} ${r.date.slice(0,4)} · budget ${money(r.amount)} · ${r.remaining>=0?money(r.remaining)+' remaining':money(-r.remaining)+' over budget'}</small></div><div class="feature-value"><strong>${money(r.spent)} spent</strong>${editable()?`<button class="icon-btn" data-action="edit-plan" data-id="${r.id}" aria-label="Edit ${esc(r.name)}">${icon('edit')}</button>`:''}</div></div>${progress(r.spent,r.amount,r.spent>r.amount?'red':'')}<button class="text-btn" data-action="event-records" data-id="${r.id}" data-name="${esc(r.name)}">View ${r.evidence.length} linked record${r.evidence.length===1?'':'s'} ${icon('arrow')}</button></div>`),'Plan your next festival, school admission or family celebration.'),'manage-events','Manage','All linked expenses, any date, against each event budget')}
`;
}
function businessDashboard(){
  const d=state.dashboard,pending=d.approvals.filter(r=>r.status==='pending');
  return `<div class="primary-column"><div class="stats-grid mode-stats">${smallKpi('Income',money(state.overview.income),'Actual received: all income transactions this month','wallet','green')}${smallKpi('Revenue',money(d.revenue),'Same records as Income (no separate revenue type yet); not added to it','trend','green')}${smallKpi('Operating spend',money(d.operating_spend),'Posted operating expenses','building')}${smallKpi('Committed spend',money(d.committed),'Upcoming in selected month','calendar','amber')}${smallKpi('Forecast spend',money(d.forecast),'Month-end estimate','trend','blue')}${smallKpi('Pending approvals',String(pending.length),money(pending.reduce((s,r)=>s+r.amount,0))+' awaiting a decision','clock','amber')}</div>
    <p class="feature-explainer forecast-note">Estimate basis: ${esc(d.forecast_basis)} Pending approvals are excluded from posted and committed spend.</p>${businessTrackingPanel()}
    ${panel('Department budgets',featureRows(d.department_budgets.map(r=>`<div class="event-row"><div class="feature-row"><div><strong>${esc(r.owner)}</strong><small>${money(r.spent)} spent of ${money(r.amount)}</small></div><div class="feature-value">${badge(budgetStatus(r),budgetTone(r))}${state.workspace.role==='owner'?`<button class="icon-btn" data-action="edit-plan" data-id="${r.id}" aria-label="Edit ${esc(r.owner)} budget">${icon('edit')}</button>`:''}</div></div>${progress(r.spent,r.amount,budgetTone(r))}</div>`),'Set department limits and assign transactions to each department.'),'manage-department-budgets','Manage',monthLabel())}
    ${panel('Expense approval queue',featureRows(pending.map(r=>`<div class="feature-row"><div><strong>${esc(r.name)}</strong><small>${esc(r.owner)} · ${esc(r.category)} · ${money(r.amount)}</small></div>${state.workspace.role==='owner'?`<div class="approval-actions"><button class="btn" data-action="approval-decision" data-id="${r.id}" data-status="approved">${icon('check')} Approve</button><button class="icon-btn" data-action="approval-decision" data-id="${r.id}" data-status="rejected" aria-label="Reject ${esc(r.name)}">${icon('close')}</button></div>`:badge('Pending','amber')}</div>`),'No requests awaiting a decision.')+'<p class="feature-explainer">Owner approval records a decision; it does not post an expense. Add the payment as a transaction when paid.</p>','manage-approvals','View / submit')}
    ${panel('Project & client cost allocation',featureRows(d.projects.map(r=>`<div class="feature-row"><div><strong>${esc(r.name)}</strong><small>${esc(r.extra.client||'Unassigned')} · project budget ${money(r.amount)}</small></div><div class="feature-value"><button class="text-btn" data-action="project-records" data-id="${r.id}">${money(r.spent)} ${icon('arrow')}</button>${editable()?`<button class="icon-btn" data-action="edit-plan" data-id="${r.id}" aria-label="Edit project">${icon('edit')}</button>`:''}</div></div>`),'Create a project and allocate transactions to it.')+`<p class="feature-explainer">${money(d.unallocated)} remains unallocated this month. Project amounts are budgets, not revenue.</p>`,'manage-projects','Manage',`Allocated expenses · ${monthLabel()}`)}
    ${panel('Revenue & pipeline',d.settings.pipeline_enabled?`<div class="split-metrics"><div><span>Recorded revenue</span><strong>${money(d.revenue)}</strong><small>Income transactions in ${monthLabel()}</small></div><div><span>Open pipeline</span><strong>${money(d.pipeline)}</strong><small>Expected close date in ${monthLabel()}</small></div></div><p class="feature-explainer">Probability-weighted pipeline estimate: ${money(d.weighted_pipeline)}. Based on manually entered opportunity probabilities; not guaranteed revenue. Spend and pipeline are associated, not causal.</p>${featureRows(d.opportunities.map(r=>valueRow(r.name,money(r.amount),`${r.extra.client||'Unassigned'} · ${r.extra.probability||0}% probability`,editable()?'edit-plan':'',r.id)))}<div class="feature-actions"><button class="btn" data-action="manage-opportunities">Manage opportunities</button>${state.workspace.role==='owner'?'<button class="text-btn" data-action="toggle-pipeline">Hide pipeline analytics</button>':''}</div>`:`<p class="feature-empty">Optional view for recorded revenue and manually tracked opportunities.</p>${state.workspace.role==='owner'?'<div class="feature-actions"><button class="btn" data-action="toggle-pipeline">Enable revenue & pipeline</button></div>':''}`)}${recentPanel()}</div>
    <aside class="secondary-column">${businessCategoryPanel()}${panel('Policy flags',featureRows(d.policy_flags.map(r=>`<div class="policy-flag"><strong>${esc(r.name)}</strong><p>${money(r.amount)} exceeds ${money(r.limit)} · ${esc(r.policy)}</p><small>${r.source==='approval'?'Pending request':'Posted transaction'} · Review required</small></div>`),'No visible expenses or pending requests exceed configured limits.'),'manage-policies','Manage','Per-transaction category limits; advisory flags')}${vendorSaasPanel()}${upcomingPanel('Upcoming business commitments')}${renewalsPanel()}${insightSidebar('Your business spend story')}</aside>`;
}

const planLabels={vendor:'vendor',bill:'bill',contribution:'contribution',dependent:'dependent',event:'event / festival','department-budget':'department budget',approval:'expense request',policy:'spending policy',project:'project',opportunity:'opportunity'};
function planManager(type){
  const rows=state.dashboard.records.filter(r=>r.type===type),ownerOnly=['policy','department-budget'].includes(type);
  openModal(`Manage ${planLabels[type]}s`,`${type==='approval'?'<p class="modal-desc">Owner decisions are saved in the audit log. Approval does not create a posted transaction. This is a single-step workflow without receipt attachments.</p>':''}<div class="feature-rows">${rows.map(r=>valueRow(r.name,['dependent','vendor'].includes(type)?'':money(r.amount),`${dateLabel(r.date)} ${r.date.slice(0,4)} · ${r.status} · ${r.owner}`,editable()&&(!ownerOnly||state.workspace.role==='owner')&&!(type==='approval'&&(r.status!=='pending'||state.workspace.role!=='owner'))?'edit-plan':'',r.id)).join('')||'<p class="feature-empty">No records yet.</p>'}</div>${type==='bill'?`<p class="modal-desc">Paid bills appear as expenses. Subscriptions are managed with the Subscriptions page, so both stay in sync.</p>`:''}${editable()&&(!ownerOnly||state.workspace.role==='owner')?`<div class="modal-footer">${type==='bill'?`<button class="btn" data-action="add-subscription">${icon('repeat')} Add subscription</button>`:''}<button class="btn primary" data-action="add-plan" data-type="${type}">${icon('plus')} Add ${planLabels[type]}</button></div>`:''}`);
}
function planForm(type,id){
  const r=state.dashboard.records.find(r=>r.id===id),label=planLabels[type];
  const owners=state.workspace.kind==='Business'?state.workspace.settings.departments.split(',').map(s=>s.trim()):['Shared',...state.workspace.settings.members.split(',').map(s=>s.trim())];
  if(r&&!owners.includes(r.owner))owners.push(r.owner);
  let fields=field(type==='dependent'?'Dependent name':'Name','name',r?.name||'','text','full');
  if(!['dependent','vendor'].includes(type))fields+=field(`${['event','project','department-budget'].includes(type)?'Budget':type==='policy'?'Per-transaction limit':'Amount'} (${state.workspace.currency})`,'amount',r?r.amount/100:'','number');
  fields+=field(type==='bill'?'Due date':type==='event'?'Event date':type==='opportunity'?'Expected close date':type==='department-budget'?'Date in budget month':'Date','date',r?.date||localDate(),'date');
  fields+=type==='dependent'?field('Expense assignment label','owner',r?.owner||'','text','full','Must match the member label used on transactions.'):selectField(state.workspace.kind==='Business'?'Department':'Member / owner','owner',owners,r?.owner||owners[0]);
  if(['bill','approval','policy'].includes(type))fields+=selectField('Category','category',state.categories.map(c=>c.name),r?.category||state.categories[0]?.name);
  if(type==='bill')fields+=selectField('Status','status',['active','paid','cancelled'],r?.status||'active');
  if(type==='approval'&&r)fields+=selectField('Decision','status',['pending','approved','rejected'],r.status);
  if(type==='opportunity')fields+=selectField('Stage','status',['open','won','lost'],r?.status||'open')+field('Probability (0–100%)','probability',r?.extra.probability||0,'number');
  if(['project','opportunity'].includes(type))fields+=field('Client','client',r?.extra.client||'','text','full');
  openModal((r?'Edit ':'Add ')+label,`<form><div class="form-grid">${fields}</div>${formFooter(r?'Save changes':'Add '+label)}${r&&!(type==='approval'&&state.workspace.role!=='owner')?`<button class="text-btn" type="button" data-action="delete-plan" data-id="${r.id}" style="color:#c7525b;margin-top:15px">Delete record</button>`:''}</form>`,{onSubmit:async e=>{
    e.preventDefault();const form=e.currentTarget;
    await submitForm(form,async()=>{const values=Object.fromEntries(new FormData(form));const payload={...values,type,amount:['dependent','vendor'].includes(type)?0:values.amount,extra:{client:values.client||'Unassigned',probability:values.probability||0}};await api(endpoint('planning')+(r?'/'+r.id:''),r?'PUT':'POST',payload);closeModal();await load();toast('Saved to your '+state.workspace.kind.toLowerCase()+' workspace.');});
  }});
  // Planning records can have future dates; posted transactions cannot.
  modalRoot.querySelector('[name="date"]')?.removeAttribute('max');
}
function changeSalaryDay(){
  openModal('Change salary day',`<form><p class="modal-desc">Choose the day salary normally arrives for this workspace. For example, day 24 gives a period from the 24th to the 23rd. Shorter months use their last day. Record each salary separately on its actual received date.</p>${field('Salary day (1-31)','salary_day',state.dashboard.settings.salary_day,'number')}${formFooter('Save salary day')}</form>`,{onSubmit:async e=>{e.preventDefault();await submitForm(e.currentTarget,async()=>{await api(endpoint('settings'),'PUT',{name:state.workspace.name,...state.workspace.settings,salary_day:e.currentTarget.elements.salary_day.value});closeModal();await bootstrap();toast('Salary day updated for this workspace.');});}});
  const input=modalRoot.querySelector('[name="salary_day"]');input.min=1;input.max=31;input.step=1;
}
function personalSettings(){
  const d=state.dashboard.settings,configured=state.dashboard.cash_tracker?.configured;
  openModal(configured?'Edit balance':'Set up your account balance',`<form novalidate><p class="modal-desc">Enter the money you had BEFORE the income and expenses you will track. Example: start with 20,000, then record salary of 75,000 to see 95,000 available. This is a starting amount only; it is not recorded as income.</p><div class="form-grid">${field('Salary arrives on day (1-31)','salary_day',d.salary_day,'number')}${field('Start tracking from','tracking_start',d.tracking_start||localDate(),'date')}${amountField('Money already in account before that date','tracking_balance',d.tracking_balance||0,'full','You can type 24000 or 24,000.')}</div><p class="feature-explainer">All recorded income and expenses ON or AFTER this date will be added or deducted. Earlier records remain in history. For a salary received on the 24th, choose the 24th and enter the balance before that salary. For shorter months, salary day uses the last day. Changing this setup recalculates the balance.</p>${formFooter(configured?'Save balance':'Save setup')}</form>`,{onSubmit:async e=>{
    e.preventDefault();
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),error=form.querySelector('.form-error');
    try{
      const day=Number(data.salary_day);
      if(!Number.isInteger(day)||day<1||day>31)throw new Error('Salary day must be a whole number from 1 to 31.');
      if(!isoDate(data.tracking_start))throw new Error('Choose the date tracking starts.');
      if(data.tracking_start>localDate())throw new Error('The tracking start date cannot be in the future.');
      data.tracking_balance=parseAmount(data.tracking_balance,'the starting balance',{allowZero:true});
    }catch(err){error.textContent=err.message;return;}
    await submitForm(form,async()=>{await api(endpoint('settings'),'PUT',{name:state.workspace.name,...state.workspace.settings,...data});closeModal();await bootstrap();toast(configured?'Balance updated.':'Balance saved.');},'Saving…');
  }});
  const input=modalRoot.querySelector('[name="salary_day"]');input.min=1;input.max=31;input.step=1;input.removeAttribute('maxlength');
  modalRoot.querySelector('[name="tracking_start"]').max=localDate();
}

function transactionExtraFields(r){
  let fields=selectField('Cost behavior','cost_type',[['variable','Variable cost'],['fixed','Fixed cost']],r?.cost_type||'variable');
  if(state.workspace.kind!=='Business')fields+=selectField('Who can see this record?','visibility',[['shared','Shared · all workspace members'],['private','Private · only me'],['amount-only','Amount visible · details private']],r?.visibility||'shared','full');
  const kind=state.workspace.kind==='Business'?'project':'event';
  if(state.workspace.kind==='Household')fields+=householdExpenseFields(r);
  else fields+=selectField(kind==='event'?'Event / festival':'Project / client',kind+'_id',[['','Not allocated'],...state.dashboard.records.filter(x=>x.type===kind).map(x=>[x.id,x.name])],r?.[kind+'_id']||'','full');
  if(state.workspace.kind==='Business'){
    fields+=selectField('Vendor (optional)','vendor_id',[['','Not linked'],...state.dashboard.records.filter(x=>x.type==='vendor').map(x=>[x.id,x.name])],r?.vendor_id||'')+selectField('SaaS subscription (optional)','subscription_id',[['','Not linked'],...state.subscriptions.map(s=>[s.id,s.name])],r?.subscription_id||'');
    const status=r?.approval_status||'';
    fields+=`<div class="field full approval-note"><strong>Approval</strong><small>${status?`Status: ${esc(status)}. `:''}Approval is not automatic: the workspace owner approves or rejects submitted expenses in Pending approvals. Pending and rejected expenses are not counted in spending totals; approval does not record a payment.</small>${!['pending','approved'].includes(status)?'<label class="check-field"><input type="checkbox" name="submit_approval"> Submit for approval after saving</label>':''}</div>`;
    fields+=businessTransactionFields(r);
  }
  return fields;
}
async function handleDashboardAction(action,target){
  if(action==='advanced-entry'){advancedTransactionForm();return true;}
  if(action==='record-salary'){simpleEntry('income');return true;}
  const managers={'manage-vendors':'vendor','manage-bills':'bill','manage-contributions':'contribution','manage-dependents':'dependent','manage-events':'event','manage-department-budgets':'department-budget','manage-approvals':'approval','manage-policies':'policy','manage-projects':'project','manage-opportunities':'opportunity'};
  if(managers[action]){planManager(managers[action]);return true;}
  switch(action){
    case 'pay-bill':{const r=state.dashboard.records.find(x=>x.id===target.dataset.id);if(!r)return true;await payCommitment(target,()=>api(endpoint('planning')+'/'+r.id,'PUT',{...r,amount:r.amount/100,status:'paid',paid_on:localDate()}),`${r.name} marked paid and added to expenses.`);return true;}
    case 'pay-subscription':await payCommitment(target,()=>api(endpoint('subscription-payments'),'POST',{subscription_id:target.dataset.id,occurrence:target.dataset.occurrence,paid_on:localDate()}),'Payment recorded. Next renewal scheduled.');return true;
    case 'vendor-records':{const rows=await api(endpoint('transactions')+'?'+new URLSearchParams({kind:'expense',month:state.month,vendor_link:target.dataset.link}));const total=rows.reduce((s,r)=>s+r.amount,0);openModal(target.dataset.link==='linked'?'Linked vendor & SaaS expenses':'Expenses without a vendor or subscription',`<p class="modal-desc">${rows.length} record${rows.length===1?'':'s'} · ${esc(monthLabel())} · total ${money(total)}. ${target.dataset.link==='none'?'Open Transactions and edit an expense to choose its Vendor or SaaS subscription.':''}</p>${rows.length?transactionTable(rows,false):'<p class="feature-empty">No records.</p>'}<div class="modal-footer"><button class="btn" data-action="close-modal">Close</button>${target.dataset.link==='none'?`<button class="btn primary" data-page="transactions">Open Transactions ${icon('arrow')}</button>`:''}</div>`,{wide:true});return true;}
    case 'business-categories':businessCategoryLibrary();return true;
    case 'business-add-category':closeModal();transactionForm();modalRoot.querySelector('[name="category"]').value=target.dataset.category;return true;
    case 'business-reimbursements':state.filters={kind:'expense',reimbursement:'pending'};state.page='transactions';await load();return true;
    case 'business-billable':state.filters={kind:'expense',billable:'true'};state.page='transactions';await load();return true;
    case 'personal-period':state.periodMode=target.dataset.period;await load();return true;
    case 'personal-settings':personalSettings();return true;
    case 'change-salary-cycle':changeSalaryDay();return true;
    case 'add-plan':planForm(target.dataset.type);return true;
    case 'edit-plan':{const r=state.dashboard.records.find(r=>r.id===target.dataset.id);planForm(r.type,r.id);return true;}
    case 'delete-plan':{const r=state.dashboard.records.find(r=>r.id===target.dataset.id);confirmDialog('Delete this '+planLabels[r.type]+'?',r.name+' will be removed. Existing posted expenses will remain.',()=>api(endpoint('planning')+'/'+r.id,'DELETE'),'Delete record');return true;}
    case 'approval-decision':{const r=state.dashboard.records.find(r=>r.id===target.dataset.id);await api(endpoint('planning')+'/'+r.id,'PUT',{...r,amount:r.amount/100,status:target.dataset.status});await load();toast('Expense request '+target.dataset.status+'.');return true;}
    case 'toggle-pipeline':await api(endpoint('settings'),'PUT',{name:state.workspace.name,...state.workspace.settings,pipeline_enabled:!state.dashboard.settings.pipeline_enabled});await bootstrap();return true;
    case 'show-transactions':state.page='transactions';state.filters={};await load();return true;
    case 'event-records':await showLinkedRecords(`Linked to ${target.dataset.name}`,{event_id:target.dataset.id});return true;
    case 'project-records':state.filters={project_id:target.dataset.id};state.page='transactions';await load();return true;
    case 'dependent-records':await showLinkedRecords(`Linked to ${target.dataset.name}`,{dependent_id:target.dataset.id,month:state.month});return true;
    case 'review-unassigned':closeModal();state.filters={kind:'expense',spent_by:'unassigned'};state.page='transactions';await load();window.scrollTo(0,0);return true;
  }
  return false;
}

function businessTrackingPanel(){
  const t=state.dashboard.business_tracking;
  return panel('Business expense tracking',`<div class="business-buckets">${[['Operating costs',t.buckets.operating],['Direct costs / materials',t.buckets.direct_cost],['Capital purchases',t.buckets.capital]].map(([name,amount])=>`<div><span>${name}</span><strong>${money(amount)}</strong></div>`).join('')}</div><p class="feature-explainer">Total recorded outflow: ${money(t.total)}. Included tax: ${money(t.included_tax)}. Tax is part of the recorded total, not added again. Capital purchases are tracked separately; no depreciation is calculated.</p><div class="claim-summary"><button data-action="business-reimbursements"><span>Employee reimbursement pending</span><strong>${money(t.reimbursements_pending)}</strong><small>${t.reimbursement_records.length} expense records ${icon('arrow')}</small></button><button data-action="business-billable"><span>Client-billable expenses</span><strong>${money(t.billable)}</strong><small>${t.billable_records.length} expense records ${icon('arrow')}</small></button></div><p class="feature-explainer">Reimbursement and billable flags describe existing expenses. They do not create another expense, reimbursement payment or client invoice.</p>`,'business-categories','Expense categories');
}
function vendorSaasPanel(){
  const v=state.dashboard.vendor_costs,rows=[...v.vendors.map(x=>({...x,type:'Vendor'})),...v.subscriptions.map(x=>({...x,type:'SaaS subscription'}))].filter(x=>x.amount||x.count).sort((a,b)=>b.amount-a.amount);
  return panel('Vendor & SaaS costs',`<div class="saas-total"><span>Actual spend · ${esc(monthLabel())}</span><strong>${money(v.actual)}</strong></div><p class="feature-explainer">Recorded expenses linked to a vendor or SaaS subscription (each counted once). Pending or rejected approvals are not counted.</p>${featureRows(rows.slice(0,6).map(r=>valueRow(r.name,money(r.amount),`${r.type} · ${r.count} expense${r.count===1?'':'s'}`)),'No linked expenses this month.')}<div class="claim-summary"><button class="text-btn" data-action="vendor-records" data-link="linked">View ${v.count} linked expense${v.count===1?'':'s'} ${icon('arrow')}</button>${v.unlinked_count?`<button class="text-btn" data-action="vendor-records" data-link="none">${v.unlinked_count} unlinked (${money(v.unlinked_amount)}) · link them ${icon('arrow')}</button>`:''}</div><p class="feature-explainer">Scheduled, not paid: ${money(v.scheduled)} in ${v.scheduled_count} subscription renewal${v.scheduled_count===1?'':'s'} due this month. Shown separately; not spend until a payment is recorded.</p>`,'manage-vendors','Vendors');
}
function businessCategoryPanel(){
  const groups=state.dashboard.business_tracking.groups;
  return panel('What your business spends on',featureRows(groups.map(g=>valueRow(g.name,money(g.amount),g.categories.slice(0,3).join(' · ')+(g.categories.length>3?'…':'')))),'business-categories','Browse categories','People, operations, technology, delivery & finance');
}
function businessCategoryLibrary(){
  const catalog=state.dashboard.business_tracking.catalog,available=new Set(state.categories.map(c=>c.name));
  openModal('Business expense categories',`<p class="modal-desc">A practical starting library based on Xero and Zoho expense guidance, plus common business cost categories. Choose a category to record an expense. You can add custom categories in Settings.</p><div class="category-library">${Object.entries(catalog).map(([group,categories])=>`<section><h3>${esc(group)}</h3><div class="settings-list">${categories.filter(c=>available.has(c)).map(c=>`<button class="btn" ${editable()?`data-action="business-add-category" data-category="${esc(c)}"`:'disabled'}>${esc(c)} ${icon('plus')}</button>`).join('')}</div></section>`).join('')}</div><p class="modal-desc" style="margin-top:20px">Tax amounts and purchase classifications are for tracking. This app does not decide deductibility or GST/VAT credit eligibility.</p><div class="research-links"><a href="https://www.xero.com/us/accounting-software/business-expenses/" target="_blank" rel="noopener noreferrer">Xero: business expense tracking</a><a href="https://www.zoho.com/expense/api/v1/expenses/" target="_blank" rel="noopener noreferrer">Zoho: expense fields</a></div>`,{wide:true});
}
function businessTransactionFields(r){
  const b=r?.business||{};
  const optional=(label,name,value='',type='text',classes='',hint='')=>field(label,'biz_'+name,value,type,classes,hint).replace(' required','');
  return `<details class="business-form-section field full" data-business-fields open><summary>Business expense details</summary><p class="small muted">The transaction amount is the full total, including any tax entered below.</p><div class="form-grid">${optional('Invoice / receipt reference','invoice_reference',b.invoice_reference)}${optional(`Included tax / GST / VAT (${state.workspace.currency})`,'tax_amount',(b.tax_amount||0)/100,'number')}${optional('Business purpose','business_purpose',b.business_purpose,'text','full')}${optional('Cost center','cost_center',b.cost_center)}${selectField('Expense classification','biz_accounting_type',[['operating','Operating expense'],['direct_cost','Direct cost / materials'],['capital','Capital purchase']],b.accounting_type||'operating')}${selectField('Paid by','biz_paid_by',[['company','Company'],['employee','Employee personally']],b.paid_by||'company')}${optional('Employee name','employee',b.employee)}${selectField('Reimbursement status','biz_reimbursement',[['none','Not requested / not applicable'],['pending','Pending reimbursement'],['reimbursed','Already reimbursed']],b.reimbursement||'none')}<label class="check-field"><input name="biz_billable" type="checkbox" ${b.billable?'checked':''}> Billable to a client</label>${optional('Client to bill','billable_client',b.billable_client,'text','full')}</div></details>`;
}
function businessFormPayload(form,data){
  if(state.workspace.kind!=='Business')return data;
  if(data.kind==='income'){data.business={};return data;}
  data.business={};
  const defaults={tax_amount:0,paid_by:'company',reimbursement:'none',accounting_type:'operating'};
  for(const key of ['invoice_reference','business_purpose','cost_center','employee','billable_client','tax_amount','paid_by','reimbursement','accounting_type'])data.business[key]=data['biz_'+key]||(defaults[key]??'');
  data.business.billable=form.elements.biz_billable.checked;
  return data;
}
function wireBusinessFields(){
  if(state.workspace.kind!=='Business')return;
  const form=modalRoot.querySelector('form');
  const update=()=>{const enabled=form.elements.kind.value==='expense';const section=form.querySelector('[data-business-fields]');section.hidden=!enabled;const employee=enabled&&form.elements.biz_paid_by.value==='employee';form.elements.biz_employee.required=employee;form.elements.biz_billable_client.required=enabled&&form.elements.biz_billable.checked;if(!employee)form.elements.biz_reimbursement.value='none';form.elements.biz_reimbursement.disabled=!employee;};
  form.addEventListener('change',update);update();
}
function businessFilters(){
  if(state.workspace.kind!=='Business')return '';
  return `<select name="accounting_type" aria-label="Expense classification filter"><option value="">All cost classes</option>${[['operating','Operating'],['direct_cost','Direct costs'],['capital','Capital purchases']].map(([v,l])=>`<option value="${v}" ${state.filters.accounting_type===v?'selected':''}>${l}</option>`).join('')}</select><select name="reimbursement" aria-label="Reimbursement filter"><option value="">All reimbursements</option>${[['none','Not requested'],['pending','Pending reimbursement'],['reimbursed','Reimbursed']].map(([v,l])=>`<option value="${v}" ${state.filters.reimbursement===v?'selected':''}>${l}</option>`).join('')}</select><select name="billable" aria-label="Client billable filter"><option value="">All billing</option><option value="true" ${state.filters.billable==='true'?'selected':''}>Client billable</option><option value="false" ${state.filters.billable==='false'?'selected':''}>Not billable</option></select>`;
}
function businessLedgerNote(r){
  if(state.workspace.kind!=='Business'||r.kind!=='expense')return '';
  const b=r.business||{},parts=[];
  if(b.invoice_reference)parts.push('Ref '+b.invoice_reference);
  if(b.reimbursement&&b.reimbursement!=='none')parts.push(b.employee+' · '+b.reimbursement);
  if(b.billable)parts.push('Billable: '+b.billable_client);
  if(b.accounting_type==='capital')parts.push('Capital purchase');
  if(b.accounting_type==='direct_cost')parts.push('Direct cost');
  if(r.approval_status)parts.push({pending:'Pending approval · not counted',approved:'Approved',rejected:'Rejected · not counted'}[r.approval_status]);
  return parts.length?`<span class="business-note">${esc(parts.join(' · '))}</span>`:'';
}

function salaryCycleControl(){
  return `<div class="salary-cycle-control"><span>Salary day: <strong>${state.dashboard.settings.salary_day}</strong> of each month</span>${state.workspace.role==='owner'?`<button class="btn" data-action="change-salary-cycle">${icon('calendar')} Change salary cycle</button>`:'<span>Ask the workspace owner to change this setting.</span>'}</div>`;
}

document.addEventListener('toggle',e=>{if(e.target.matches?.('.simple-more')&&e.target.isConnected)state.showMore=e.target.open;},true);
