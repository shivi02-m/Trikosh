'use strict';

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  arrows:'<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  wallet:'<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6m18 7h-6v4h6z"/>',
  repeat:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart:'<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
  spark:'<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3zM20 2v4m-2-2h4"/>',
  settings:'<path d="m10 3-.8 2.3-2 .9L5 5.5 3 9l1.5 1.7v2.6L3 15l2 3.5 2.2-.7 2 .9L10 21h4l.8-2.3 2-.9 2.2.7 2-3.5-1.5-1.7v-2.6L21 9l-2-3.5-2.2.7-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m6 9 6 6 6-6"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  up:'<path d="m6 15 6-6 6 6"/>', arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  trend:'<path d="m3 17 6-6 4 4 8-11m-6 0h6v6"/>',
  home:'<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3z"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  building:'<path d="M5 21V3h14v18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  logout:'<path d="M9 4H4v16h5m5-4 4-4-4-4m-5 4h12"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  edit:'<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  bag:'<path d="M4 7h16l1 14H3L4 7zM8 8V6a4 4 0 0 1 8 0v2"/>',
  food:'<path d="M5 3v7m4-7v7m-2 0v11M3 3v5a4 4 0 0 0 8 0V3m7 0c-3 4-3 8 1 9V3m0 9v9"/>',
  coffee:'<path d="M4 8h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zm13 1h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2"/>',
  car:'<path d="m5 6-3 8v5h20v-5l-3-8H5zm-2 8h18M5 19v2m14-2v2M6 16h2m8 0h2"/>',
  heart:'<path d="M12 21 3 12a6 6 0 0 1 9-8 6 6 0 0 1 9 8z"/>',
  plane:'<path d="m21 3-7 18-3-8-8-3L21 3zM11 13l5-5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="m5 12 4 4L19 6"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.wallet}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const state = {csrf:'', user:null, accountType:null, accountTypeLabel:'', kinds:[], view:null, workspaces:[], workspace:null, page:'overview', month:localDate().slice(0,7), filters:{}, overview:null, subscriptions:[], goals:[], categories:[], insights:[], answer:null, busy:false, request:0};
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const colors = ['#9373dd','#b49ae9','#cbb8f0','#e0d4f5','#bfcddf','#7faeac','#d9b1c3','#b3b9da'];
let toastTimer, lastFocus, searchTimer;
const money = (cents, compact=false) => new Intl.NumberFormat(state.workspace?.currency === 'INR' ? 'en-IN' : 'en-US', {style:'currency', currency:state.workspace?.currency || 'INR', maximumFractionDigits:compact?1:((cents||0)%100?2:0), ...(compact?{notation:'compact'}:{})}).format((cents || 0)/100);
const exactMoney = cents => new Intl.NumberFormat('en-IN', {style:'currency',currency:state.workspace?.currency||'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format((cents||0)/100);
const percent = (a,b) => b ? Math.min(Math.max(a / b * 100,0),100) : 0;
const dateLabel = d => new Date(d+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const monthLabel = () => new Date(state.month+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
const editable = () => state.workspace?.role !== 'viewer';
const wsIcon = kind => ({Personal:'user',Household:'users',Business:'building'}[kind]);
const catIcon = category => ({Housing:'home',Groceries:'bag',Dining:'coffee',Transport:'car',Travel:'plane',Health:'heart',Shopping:'bag',Salary:'wallet',Revenue:'trend',Software:'grid',Payroll:'users',Education:'building',Subscriptions:'repeat'}[category] || 'wallet');
const serviceClass = name => ({netflix:'netflix',spotify:'spotify','icloud+':'icloud'}[name.toLowerCase()] || '');
const query = extra => new URLSearchParams({month:state.month,...state.filters,...extra}).toString();
const endpoint = resource => `/api/workspaces/${state.workspace.id}/${resource}`;
const brand = () => '<div class="brand"><img src="/Trikosh_logo.png" alt="Trikosh"></div>';
const badge = (text,tone='') => `<span class="badge ${tone}">${esc(text)}</span>`;
const progress = (spent,total,tone='') => `<div class="progress ${tone}" role="progressbar" aria-label="Progress" aria-valuenow="${Math.round(percent(spent,total))}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent(spent,total)}%"></span></div>`;
const empty = (title,description,action='',label='') => `<div class="empty-state">${icon('wallet')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action && editable()?`<button class="btn primary" data-action="${action}">${icon('plus')}${esc(label)}</button>`:''}</div>`;

async function api(path,method='GET',body){
  const response = await fetch(path,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':state.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let data;
  try{data = await response.json();}catch{data={error:response.ok?'Unexpected server response.':`The server returned ${response.status}. Please try again.`};}
  if(!response.ok){
    if(response.status===401 && state.user){clearClientState();renderAuth('login','Your session has ended. Please sign in again.');}
    throw new Error(data.error || 'Unable to complete the request.');
  }
  return data;
}
// Drop everything tied to the signed-in account. Theme preference is the only thing kept.
function clearClientState(){
  Object.assign(state,{csrf:'',user:null,accountType:null,accountTypeLabel:'',kinds:[],view:null,workspaces:[],workspace:null,page:'overview',filters:{},overview:null,dashboard:null,subscriptions:[],goals:[],categories:[],insights:[],answer:null,trend:null,trendMode:'month',weekStart:null,revenueTrend:null,revenueMode:'month',revenueWeekStart:null,showMore:false,periodMode:'calendar'});
  state.request++;
  clearTimeout(toastTimer);document.getElementById('toast')?.classList.remove('show');
  sessionStorage.clear();
  localStorage.removeItem('opsmind-workspace');
  closeModal();
}
function rememberWorkspace(){sessionStorage.setItem('opsmind-view',state.view||'');if(state.workspace)sessionStorage.setItem('opsmind-workspace',state.workspace.id);}
function setPath(path){if(location.pathname!==path)history.replaceState(null,'',path);}
function toast(message){clearTimeout(toastTimer);const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),4000);}
function setTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem('opsmind-theme',theme);}
setTheme(localStorage.getItem('opsmind-theme')||'light');

// The server decides which workspace kinds this session may open; the client only picks among them.
async function bootstrap(preferred){
  const me = await api('/api/auth/me');
  localStorage.removeItem('opsmind-workspace');
  state.user=me.user;state.csrf=me.csrf;state.workspaces=me.workspaces;state.accountType=me.account_type;state.accountTypeLabel=me.account_type_label;state.kinds=me.kinds;
  setPath('/');
  if(me.needs_username){renderUsernameSetup();return;}
  if(inviteToken){await acceptPendingInvite();return;}
  const find=id=>id&&me.workspaces.find(w=>w.id===id);
  const chosen=find(preferred)||find(state.workspace?.id)||null;
  const storedView=sessionStorage.getItem('opsmind-view');
  // Personal is the default view for Personal / Household accounts.
  state.view=chosen?.kind||(state.kinds.includes(state.view)?state.view:state.kinds.includes(storedView)?storedView:state.kinds[0]);
  const inView=me.workspaces.filter(w=>w.kind===state.view);
  if(!inView.length){state.workspace=null;rememberWorkspace();state.view==='Household'?renderHouseholdSetup():renderOnboarding(state.view);return;}
  state.workspace=(chosen&&chosen.kind===state.view?chosen:null)||inView.find(w=>w.id===sessionStorage.getItem('opsmind-workspace'))||inView[0];
  rememberWorkspace();
  if(state.workspace.kind==='Business'&&state.page==='goals')state.page='overview';
  await load();
}
async function switchView(view){
  if(!state.kinds.includes(view)||view===state.view&&state.workspace)return;
  state.view=view;state.workspace=null;state.filters={};state.answer=null;state.overview=null;state.dashboard=null;state.page='overview';state.periodMode='calendar';
  sessionStorage.setItem('opsmind-view',view);sessionStorage.removeItem('opsmind-workspace');
  await bootstrap();
}
async function logout(){
  // The session cookie is HttpOnly, so only the server can end it. Do not pretend on failure.
  try{await api('/api/auth/logout','POST',{});}
  catch(error){toast('Could not sign out: '+error.message+' Check your connection and try again.');return;}
  clearClientState();
  renderAuth('login','You have been signed out.');
}
async function load(){
  const request=++state.request;
  const wid=state.workspace.id;
  if(!state.overview)app.innerHTML='<div class="boot"><img src="/Trikosh_logo.png" width="180" height="90" alt="Trikosh"><p>Putting your numbers in perspective…</p></div>';
  const results=await Promise.all([
    api(endpoint('overview')+'?'+query()),api(endpoint('categories')),api(endpoint('subscriptions')),
    state.workspace.kind!=='Business'?api(endpoint('goals')):Promise.resolve([]),api(endpoint('insights')+'?'+query()),api(endpoint('dashboard')+'?'+query({period:state.periodMode||'calendar'})),computeTrend(),state.workspace.kind==='Business'?computeTrend('revenue'):Promise.resolve(null)
  ]);
  if(request!==state.request||wid!==state.workspace.id)return;
  [state.overview,state.categories,state.subscriptions,state.goals]=results;
  state.insights=results[4].insights;
  state.dashboard=results[5];
  state.trend=results[6];state.revenueTrend=results[7];
  render();
}
const navigation=[['overview','grid','Overview'],['transactions','arrows','Transactions'],['budgets','wallet','Budgets'],['subscriptions','repeat','Subscriptions'],['goals','target','Savings goals'],['analytics','chart','Analytics'],['insights','spark','Ask Trikosh']];
function render(){
  const w=state.workspace;
  const current=navigation.find(n=>n[0]===state.page)?.[2]||'Settings';
  const initials=userInitials();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar" id="sidebar">${brand()}<div class="brand-caption">Har Rupee ki Apni Story</div>
    <div class="workspace-control"><div class="workspace-icon">${icon(wsIcon(w.kind))}</div><div class="workspace-name" id="workspace-name" title="${esc(w.name)}">${esc(w.name)}</div>${state.workspaces.length>1?`<button type="button" class="icon-btn workspace-switch" data-action="switch-workspace" aria-label="Switch workspace" title="Switch workspace">${icon('repeat')}</button>`:''}</div>
    <div class="nav-label">WORKSPACE</div><nav aria-label="Main navigation">${navigation.slice(0,5).filter(n=>n[0]!=='goals'||w.kind!=='Business').map(navButton).join('')}</nav>
    <div class="nav-section"><div class="nav-label">INTELLIGENCE</div><nav aria-label="Intelligence">${navigation.slice(5).map(navButton).join('')}</nav></div>
    <div class="nav-section"><button class="nav-item ${state.page==='settings'?'active':''}" data-page="settings">${icon('settings')}Settings</button></div>
    <div class="sidebar-bottom"><div class="side-promo">${icon('spark')}<h3>A little clarity. A lot of control.</h3><p>Rule-based explanations from your own records.</p><button class="text-btn" data-page="insights">Explore insights ${icon('arrow')}</button></div>
    <div class="profile"><div class="avatar">${esc(initials)}</div><div><div class="profile-name">${esc(state.user.name)}</div><div class="profile-sub">${w.demo?'Demo explorer':'@'+esc(state.user.username)+' · '+esc(w.role)}</div></div><button class="icon-btn" data-action="logout" aria-label="Log out" title="Log out">${icon('logout')}</button></div></div></aside>
    <div class="main-wrap"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb"><span>${esc(w.name)}</span>${icon('chevron')}<span>${esc(current)}</span></div>${viewSwitcher()}
    <div class="top-tools"><button class="search-button" data-action="search">${icon('search')}<span>Search transactions…</span><kbd>⌘ K</kbd></button><button class="icon-btn" data-action="theme" aria-label="Toggle light or dark theme">${icon('sun')}</button><button class="icon-btn" data-action="renewals" aria-label="Upcoming renewals">${icon('bell')}</button><span class="top-divider"></span>${profileMenu()}</div></header>
    <main class="content" id="main-content" data-workspace-kind="${w.kind}" data-workspace-id="${w.id}">${pageHeading()}${workspaceTypeNav()}${w.demo?`<div class="demo-banner">${icon('info')}<span><strong>You’re exploring a demo workspace.</strong> All numbers are synthetic. Make yourself at home.</span><span class="banner-right">${icon('shield')} Portfolio-safe data</span></div>`:''}${pageContent()}<footer class="footer"><span><strong>Trikosh</strong> · <a class="contact-link" href="mailto:admin@trikosh.com">Contact us</a></span><span>${icon('shield').replace('class="icon"','class="icon" style="width:10px;height:10px;vertical-align:middle"')} Workspace-isolated · ${esc(w.currency)}</span></footer></main></div></div>`;
}
function userInitials(){const source=(state.user?.name||state.user?.username||'?').trim();return source.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();}
function viewSwitcher(){
  if(state.accountType!=='personal_household')return '';
  return `<div class="view-switch" role="group" aria-label="Choose Personal or Household workspace">${['Personal','Household'].map(k=>`<button type="button" data-action="switch-view" data-view="${k}" aria-pressed="${state.view===k}" class="${state.view===k?'active':''}">${icon(wsIcon(k))}<span>${k}</span></button>`).join('')}</div>`;
}
function profileMenu(){
  const u=state.user,w=state.workspace;
  const current=w?w.name+(w.demo?' (demo)':''):'Not set up yet';
  return `<div class="profile-menu"><button type="button" class="profile-trigger" data-action="profile-menu" aria-haspopup="true" aria-expanded="false" aria-controls="profile-panel" aria-label="Open profile menu for ${esc(u.username||u.name)}"><span class="avatar">${esc(userInitials())}</span><span class="profile-trigger-name">@${esc(u.username||'')}</span>${icon('down')}</button>
    <div class="profile-panel" id="profile-panel" hidden><div class="profile-panel-head"><span class="avatar">${esc(userInitials())}</span><div><strong>${esc(u.name)}</strong><small>@${esc(u.username||'')}</small></div></div>
    <dl><div><dt>Username</dt><dd>@${esc(u.username||'')}</dd></div><div><dt>Email</dt><dd>${u.email?esc(u.email):'<span class="muted">Not available</span>'}</dd></div><div><dt>Account type</dt><dd>${esc(state.accountTypeLabel)}</dd></div><div><dt>Current workspace</dt><dd>${esc(current)}</dd></div></dl>
    <button type="button" class="btn danger" data-action="logout">${icon('logout')} Log out</button></div></div>`;
}
function closeProfileMenu(){document.querySelectorAll('.profile-panel').forEach(p=>{p.hidden=true;});document.querySelectorAll('.profile-trigger').forEach(b=>b.setAttribute('aria-expanded','false'));}
function setupHeader(){return `<header class="setup-header">${brand()}${viewSwitcher()}${state.user?profileMenu():''}</header>`;}
function navButton([page,symbol,label]){return `<button class="nav-item ${state.page===page?'active':''}" data-page="${page}" ${state.page===page?'aria-current="page"':''}>${icon(symbol)}${label}${page==='insights'?'<span class="badge">LOCAL</span>':''}</button>`;}
function pageHeading(){
  const names={overview:[`Your money, in perspective.`,`${new Date().getHours()<12?'Good morning':new Date().getHours()<18?'Good afternoon':'Good evening'}, ${state.user.name.split(' ')[0]}. Here’s what’s happening with your ${state.workspace.kind==='Business'?'business finances':state.workspace.kind==='Household'?'household finances':'money'} today.`],transactions:['Every transaction. One clear picture.','The details behind your financial story.'],budgets:['Make room for what matters.','A thoughtful plan for your spending, one category at a time.'],subscriptions:['Small charges. The full picture.','Keep recurring commitments and upcoming renewals in view.'],goals:['Give your savings a destination.','Turn someday into a plan you can track.'],analytics:['A closer look at your numbers.','Follow the patterns. Understand the changes.'],insights:['A little more financial clarity.','Grounded explanations, with the records to back them up.'],settings:['Your space, your preferences.','Manage your workspace, categories and access.']};
  if(state.page==='overview') names.overview = {Personal:['Your everyday money.','Record your salary. Add your expenses. See what is left.'],Household:['Your everyday money.','Record your salary. Add your expenses. See what is left.'],Business:['Your business finance command center.','Operating costs, commitments and decisions that keep your business moving.']}[state.workspace.kind];
  const [title,subtitle]=names[state.page];
  const actions={overview:['add-transaction','Add transaction'],transactions:['add-transaction','Add transaction'],budgets:['add-budget','Create budget'],subscriptions:['add-subscription','Add subscription'],goals:['add-goal','Create goal'],analytics:['add-transaction','Add transaction'],settings:['add-workspace','New workspace']};
  if(state.workspace.kind!=='Business'&&['overview','transactions','analytics'].includes(state.page))actions[state.page]=['add-transaction','Add expense'];
  const action=actions[state.page];
  if(state.workspace.kind!=='Business'&&state.page==='overview')return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${editable()?`<div class="heading-actions"><button class="btn" data-action="record-salary">${icon('plus')}Record salary</button><button class="btn primary" data-action="add-transaction">${icon('plus')}Add expense</button></div>`:''}</div>`;
  return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="heading-actions">${['overview','transactions','analytics'].includes(state.page)?`<button class="btn" data-action="export">${icon('download')}Export</button>`:''}${action&&(editable()||state.page==='settings')?`<button class="btn primary" data-action="${action[0]}">${icon('plus')}${action[1]}</button>`:''}</div></div>`;
}
function toolbar(tabs=false){return `<div class="section-toolbar">${tabs?`<div class="tab-group"><button class="active" data-page="overview">Overview</button><button data-page="analytics">Spending analysis</button></div>`:`<span class="small muted">${esc(monthLabel())} · ${esc(state.workspace.name)}</span>`}<label class="period-input">${icon('calendar')}<span class="sr-only">Reporting month</span><input id="period" type="month" value="${state.month}" aria-label="Reporting month"></label></div>`;}
function stat(label,value,symbol,tone,note,line){return `<article class="stat"><div class="stat-top"><span>${label}</span><span class="stat-icon ${tone}">${icon(symbol)}</span></div><div class="stat-number">${value}</div><div class="stat-note">${note}</div>${line!==undefined?`<div class="stat-line"><span style="width:${line}%"></span></div>`:''}</article>`;}
function stats(){const o=state.overview;return `<div class="stats-grid">
  ${stat(state.workspace.kind==='Business'?'Recorded revenue':'Total income',money(o.income),'wallet','green',state.workspace.kind==='Business'?'Actual received: all income transactions in '+esc(monthLabel())+' (same records as Income)':'<span class="positive">↗</span> Recorded in '+esc(monthLabel()))}
  ${stat('Total expenses',money(o.spend),'arrows','purple',o.change!==null?`<span class="${o.change<=0?'positive':'negative'}">${o.change<=0?'↘':'↗'} ${Math.abs(o.change)}%</span> vs same elapsed days last month`:'Your recorded expenses this month')}
  ${state.workspace.kind==='Household'?stat('Net income',money(o.balance),'chart','blue',`Income minus expenses · ${o.count} records`):stat('Net cash flow',money(o.balance),'chart','blue',`Income minus expenses · ${o.count} records`)}
  ${stat('Budget remaining',o.remaining===null?'—':money(o.remaining),'target','amber',o.budget?`${Math.round(o.spend/o.budget*100)}% of ${money(o.budget)} budget used`:'Set a budget to start your plan',o.budget?percent(o.spend,o.budget):0)}
  </div>`;}
function pageContent(){
  switch(state.page){case 'overview':return dashboard();case 'transactions':return transactionsPage();case 'budgets':return budgetsPage();case 'subscriptions':return subscriptionsPage();case 'goals':return goalsPage();case 'analytics':return analyticsPage();case 'insights':return insightsPage();case 'settings':return settingsPage();default:return '';}
}
// ---- Spending overview: Month / Week comparison --------------------------------------------
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d);};
const mondayOf=iso=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return localDate(d);};
const shortDate=iso=>new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const monthName=ym=>new Date(ym+'-01T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
const daysBetween=(start,end)=>{const out=[];for(let d=start;d<=end;d=addDays(d,1))out.push(d);return out;};
function defaultWeekStart(){
  const today=localDate(),[y,m]=state.month.split('-').map(Number),last=localDate(new Date(y,m,0,12));
  return mondayOf(state.month===today.slice(0,7)?today:last<today?last:state.month+'-01');
}
let trendRequest=0;
// Uses the same transaction API (workspace access, privacy and active filters) as the rest of Analytics.
const TRENDS={spend:{state:'trend',mode:'trendMode',week:'weekStart',title:'Spending overview'},revenue:{state:'revenueTrend',mode:'revenueMode',week:'revenueWeekStart',title:'Revenue'}};
async function computeTrend(key='spend'){
  const cfg=TRENDS[key],mode=state[cfg.mode]||'month',today=localDate();
  let cur,prev;
  if(mode==='week'){
    const ws=state[cfg.week]=state[cfg.week]||defaultWeekStart();
    cur={start:ws,end:addDays(ws,6)};prev={start:addDays(ws,-7),end:addDays(ws,-1)};
  }else{
    const [y,m]=state.month.split('-').map(Number);
    cur={start:state.month+'-01',end:localDate(new Date(y,m,0,12))};prev={start:localDate(new Date(y,m-2,1,12)),end:localDate(new Date(y,m-1,0,12))};
  }
  const rows=await api(endpoint('transactions')+'?'+new URLSearchParams({...state.filters,from:prev.start,to:cur.end}));
  const byDay={};
  for(const r of rows)if(key==='revenue'?r.kind==='income':r.kind==='expense'&&!r.excluded_from_totals)byDay[r.date]=(byDay[r.date]||0)+r.amount;
  const curDays=daysBetween(cur.start,cur.end),prevDays=daysBetween(prev.start,prev.end);
  const status=cur.start>today?'future':cur.end>=today?'partial':'complete';
  const elapsed=status==='future'?0:status==='partial'?curDays.filter(d=>d<=today).length:curDays.length;
  // Incomplete period: compare the same number of elapsed days. Complete period: whole vs whole.
  const prevCompared=status==='complete'?prevDays:prevDays.slice(0,elapsed);
  const sum=list=>list.reduce((t,d)=>t+(byDay[d]||0),0);
  const curTotal=sum(curDays.slice(0,elapsed)),prevTotal=sum(prevCompared);
  const range=list=>list.length?`${shortDate(list[0])}–${shortDate(list[list.length-1])}`:'';
  const partialNote=status==='partial'?` (${range(curDays.slice(0,elapsed))}, so far)`:'';
  const prevNote=status==='partial'&&prevCompared.length?` (${range(prevCompared)})`:'';
  const labels=mode==='week'
    ?{cur:`Week of ${range(curDays)}`+partialNote,prev:`Week of ${range(prevDays)}`+prevNote,unit:'week'}
    :{cur:monthName(state.month)+partialNote,prev:monthName(prev.start.slice(0,7))+prevNote,unit:'month'};
  return {key,mode,status,elapsed,curDays,prevDays,cur:curDays.map(d=>byDay[d]||0),prev:prevDays.map(d=>byDay[d]||0),curTotal,prevTotal,
    change:prevTotal?Math.round((curTotal-prevTotal)/prevTotal*1000)/10:null,labels};
}
async function refreshTrend(key='spend'){const id=++trendRequest,wid=state.workspace.id;try{const trend=await computeTrend(key);if(id!==trendRequest||wid!==state.workspace?.id)return;state[TRENDS[key].state]=trend;render();}catch(error){toast(error.message);}}
function trendBadge(t){
  if(t.status==='future')return badge('Future period · no data yet','gray');
  const noun=t.key==='revenue'?'revenue':'spending';
  if(!t.prevTotal&&!t.curTotal)return badge(`No ${noun} in either period`,'gray');
  if(!t.prevTotal)return badge(`No ${noun} in the previous ${t.labels.unit} to compare`,'gray');
  return badge(`${t.change>0?'+':''}${t.change}% vs previous ${t.labels.unit}`,(t.key==='revenue'?t.change>=0:t.change<=0)?'green':'amber');
}
function trendPanel(key='spend'){
  const cfg=TRENDS[key],t=state[cfg.state];
  if(!t)return `<section class="panel"><div class="panel-head"><h2>${cfg.title}</h2></div><p class="feature-empty">Loading comparison…</p></section>`;
  const width=600,height=170,left=50,right=580,bottom=140,top=15,count=Math.max(t.cur.length,t.prev.length);
  const shown=t.cur.slice(0,t.elapsed),max=Math.max(...shown,...t.prev,100);
  const x=i=>left+(count>1?i/(count-1):0)*(right-left),y=v=>bottom-v/max*(bottom-top);
  const line=values=>values.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
  const grids=[0,.5,1].map(p=>`<line class="gridline" x1="${left}" x2="${right}" y1="${bottom-p*(bottom-top)}" y2="${bottom-p*(bottom-top)}"/><text x="40" y="${bottom-p*(bottom-top)+3}" text-anchor="end">${esc(money(max*p,true))}</text>`).join('');
  const ticks=t.mode==='week'?t.curDays.map((d,i)=>[i,new Date(d+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})]):[1,5,10,15,20,25,t.curDays.length].map(d=>[d-1,`${String(d).padStart(2,'0')} ${new Date(state.month+'-01T12:00:00').toLocaleDateString('en-US',{month:'short'})}`]);
  const unit=t.labels.unit;
  return `<section class="panel trend-panel" data-chart="${key}" data-trend-mode="${t.mode}"><div class="panel-head"><div><h2>${cfg.title}</h2><p>${key==='revenue'?`Daily revenue received (income transactions, ${esc(state.workspace.currency)}), compared with the previous ${unit}`:`Daily expenses, compared with the previous ${unit}`}</p></div><div class="legend"><div class="tab-group" role="group" aria-label="Compare by"><button type="button" class="${t.mode==='month'?'active':''}" aria-pressed="${t.mode==='month'}" data-action="trend-mode" data-chart="${key}" data-mode="month">Month</button><button type="button" class="${t.mode==='week'?'active':''}" aria-pressed="${t.mode==='week'}" data-action="trend-mode" data-chart="${key}" data-mode="week">Week</button></div><button class="icon-btn" data-action="explain" aria-label="Explain spending">${icon('info')}</button></div></div>
    ${t.mode==='week'?`<div class="week-nav"><button type="button" class="icon-btn flip" data-action="trend-week" data-chart="${key}" data-step="-1" aria-label="Previous week">${icon('chevron')}</button><span>${esc(shortDate(t.curDays[0]))} – ${esc(shortDate(t.curDays[6]))} ${t.curDays[6].slice(0,4)}</span><button type="button" class="icon-btn" data-action="trend-week" data-chart="${key}" data-step="1" aria-label="Next week" ${addDays(t.curDays[0],7)>localDate()?'disabled':''}>${icon('chevron')}</button></div>`:''}
    <div class="chart-summary"><strong>${money(t.curTotal)}</strong><span>${esc(t.labels.cur)}</span>${trendBadge(t)}</div>
    <p class="trend-compare">Previous: <strong>${money(t.prevTotal)}</strong> in ${esc(t.labels.prev)}${t.status==='partial'?` · Compared over the same ${t.elapsed} elapsed day${t.elapsed===1?'':'s'}, because this ${unit} is not finished.`:''}</p>
    <div class="trend-legend"><span><i></i>This ${unit}</span><span><i class="previous"></i>Previous ${unit}</span></div>
    <div class="chart-container"><svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily spending, ${esc(t.labels.cur)}: ${esc(money(t.curTotal))}. Previous ${unit}, ${esc(t.labels.prev)}: ${esc(money(t.prevTotal))}."><defs><linearGradient id="area-fill-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ac8be5" stop-opacity=".28"/><stop offset="100%" stop-color="#ac8be5" stop-opacity=".015"/></linearGradient></defs>${grids}
    <path class="previous-line" d="${line(t.prev)}" fill="none" stroke="#b3b9da" stroke-width="1.8" stroke-dasharray="5 4" stroke-linecap="round"/>
    ${shown.length?`<path d="${line(shown)} L${x(shown.length-1)},${bottom} L${left},${bottom} Z" fill="url(#area-fill-${key})"/><path class="current-line" d="${line(shown)}" fill="none" stroke="#9875db" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`:''}
    ${shown.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="transparent"><title>${shortDate(t.curDays[i])}: ${exactMoney(v)}</title></circle>`).join('')}
    ${ticks.map(([i,label])=>`<text x="${x(i)}" y="160" text-anchor="middle">${esc(label)}</text>`).join('')}</svg></div>
    <div class="chart-foot">${icon('spark')} ${t.status==='future'?'This period has not started yet.':!t.curTotal&&!t.prevTotal?`No ${key==='revenue'?'income':'expenses'} recorded in either period.`:key==='revenue'?'Revenue = income transactions; reconciles to Transactions for these dates and filters. Pipeline forecasts are not included.':'Totals reconcile to the expenses in Transactions for these dates and your active filters. Pending or rejected approvals are not counted.'}</div></section>`;
}
function categoryPanel(){const o=state.overview;let angle=0;const segments=o.categories.map((c,i)=>{const start=angle;angle+=c.amount/o.spend*100;return `${colors[i%colors.length]} ${start}% ${angle}%`;}).join(',');return `<section class="panel"><div class="panel-head"><h2>Where your money goes</h2><button class="icon-btn" data-page="analytics" aria-label="View category analysis">${icon('chevron')}</button></div>${o.categories.length?`<div class="category-body"><div class="donut" style="--segments:${segments}" role="img" aria-label="Spending by category"><div class="donut-center"><span>Total spent</span><strong>${money(o.spend,true)}</strong></div></div><div class="category-legend">${o.categories.slice(0,5).map((c,i)=>`<button class="category-row" data-action="drill-category" data-category="${esc(c.name)}"><span class="dot" style="background:${colors[i%colors.length]}"></span><span class="category-label">${esc(c.name)}</span><b>${Math.round(c.amount/o.spend*100)}%</b></button>`).join('')}${o.categories.length>5?`<button class="category-row" data-page="analytics"><span class="dot" style="background:#bfcddf"></span><span>Other categories</span><b>${Math.round(o.categories.slice(5).reduce((s,c)=>s+c.amount,0)/o.spend*100)}%</b></button>`:''}</div></div>`:empty('No expenses yet','Your category breakdown will appear here.')}</section>`;}
function budgetTone(b){return b.spent>b.amount?'red':b.spent/b.amount>=.8?'amber':'green';}
function budgetStatus(b){return b.spent>b.amount?'Exceeded':b.spent/b.amount>=.9?'Near limit':b.spent/b.amount>=.75?'Watch':'On track';}
function budgetPanel(){const budgets=state.overview.budgets.filter(b=>b.category!=='Overall').slice(0,4);return `<section class="panel"><div class="panel-head"><h2>Budget check-in</h2><button class="text-btn" data-page="budgets">Manage ${icon('arrow')}</button></div>${budgets.length?`<div class="budget-list">${budgets.map(b=>`<div><div class="budget-item-top"><span>${esc(b.category)}</span><span>${money(b.spent)} <span class="muted">/ ${money(b.amount)}</span></span></div>${progress(b.spent,b.amount,budgetTone(b))}</div>`).join('')}</div>`:empty('A plan starts with a budget','Give each category a little direction.','add-budget','Create budget')}</section>`;}
// Household expenses show the "Spent by" member's name (a current member's user ID), not the legacy owner label.
function assignedLabel(r){
  if(state.workspace.kind!=='Household'||r.kind!=='expense')return r.owner;
  if(r.redacted)return 'Private';
  const m=(state.dashboard?.household_members||[]).find(x=>x.id===r.spent_by);
  return m?m.name+(m.id===state.user.id?' (you)':''):'Unassigned';
}
function transactionTable(rows,full=true){return rows.length?`<div class="table-wrap"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th>${full?`<th>Payment</th><th>${state.workspace.kind==='Household'?'Spent by':'Assigned to'}</th>`:''}<th style="text-align:right">Amount</th>${full&&editable()?'<th><span class="sr-only">Actions</span></th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td><div class="merchant-cell"><span class="merchant-icon">${icon(catIcon(r.category))}</span><div><strong>${esc(r.merchant)}</strong><small>${esc(r.classification==='regular'?r.payment:r.classification+' · '+r.payment)}</small>${businessLedgerNote(r)}</div></div></td><td>${badge(r.category,'gray')}</td><td class="muted">${dateLabel(r.date)}</td>${full?`<td class="muted">${esc(r.payment)}</td><td class="muted">${esc(assignedLabel(r))}</td>`:''}<td class="amount ${r.kind==='income'?'income':''}" style="text-align:right">${r.kind==='income'?'+':'−'}${exactMoney(r.amount)}</td>${full&&editable()&&!r.redacted?`<td>${state.workspace.kind==='Business'&&r.kind==='expense'&&!['pending','approved'].includes(r.approval_status)?`<button class="icon-btn" data-action="submit-approval" data-id="${r.id}" aria-label="Submit ${esc(r.merchant)} for approval" title="Submit for approval">${icon('check')}</button>`:''}<button class="icon-btn" data-action="edit-transaction" data-id="${r.id}" aria-label="Edit ${esc(r.merchant)}">${icon('edit')}</button><button class="icon-btn" data-action="delete" data-resource="transactions" data-id="${r.id}" data-name="${esc(r.merchant)}" aria-label="Delete ${esc(r.merchant)}">${icon('trash')}</button></td>`:full&&editable()?'<td class="muted">Private</td>':''}</tr>`).join('')}</tbody></table></div>`:empty('Nothing here just yet','Add a transaction or adjust your filters.','add-transaction','Add transaction');}
function insightCard(insight,index){return `<article class="insight-card ${insight.tone}"><div class="insight-label">${icon(insight.tone==='green'?'trend':'spark')}${insight.basis?'Looking ahead · estimate':'From your records'}</div><h3>${esc(insight.title)}</h3><p>${esc(insight.text)}</p><button class="text-btn" data-action="evidence" data-index="${index}">View supporting records ${icon('arrow')}</button></article>`;}
function renewalsPanel(){const subs=state.subscriptions.filter(s=>s.status==='active').sort((a,b)=>a.renewal.localeCompare(b.renewal)).slice(0,3);return `<section class="panel"><div class="panel-head"><div><h2>Upcoming renewals</h2><p>Your next recurring commitments</p></div><button class="icon-btn" data-page="subscriptions" aria-label="View subscriptions">${icon('chevron')}</button></div>${subs.length?`<div class="list-rows">${subs.map(s=>`<div class="list-row"><div class="service-logo ${serviceClass(s.name)}">${esc(s.name[0])}</div><div><strong>${esc(s.name)}</strong><small>${dateLabel(s.renewal)}${s.renewal<localDate()?' · Overdue':''}</small></div><div class="row-end"><strong>${money(s.amount)}</strong><small>${s.cadence}</small></div></div>`).join('')}</div>`:empty('All clear','Add a subscription to track renewals.','add-subscription','Add subscription')}</section>`;}
function goalsPanel(){return `<section class="panel"><div class="panel-head"><h2>A little closer to your goals</h2><button class="icon-btn" data-page="goals" aria-label="View savings goals">${icon('chevron')}</button></div>${state.goals.length?state.goals.slice(0,2).map(g=>`<div class="mini-goal"><div class="goal-line"><span>${icon('target')}${esc(g.name)}${g.goal_type&&g.goal_type!=='savings'?` <small class="goal-type">${g.goal_type.toUpperCase()}</small>`:''}</span><b>${Math.round(g.saved/g.target*100)}%</b></div>${progress(g.saved,g.target)}<div class="goal-note"><span>${money(g.saved)} saved</span><span>of ${money(g.target)}</span></div></div>`).join(''):empty('Something to look forward to','Create your first savings goal.','add-goal','Create goal')}</section>`;}
function filtersHTML(){return `<form class="filters" id="filters-form"><input name="q" placeholder="Search merchant, category or notes…" value="${esc(state.filters.q||'')}" aria-label="Search transactions"><select name="category" aria-label="Filter category"><option value="">All categories</option>${state.categories.map(c=>`<option ${state.filters.category===c.name?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select name="kind" aria-label="Filter transaction type"><option value="">All types</option><option value="expense" ${state.filters.kind==='expense'?'selected':''}>Expenses</option><option value="income" ${state.filters.kind==='income'?'selected':''}>Income</option></select><select name="classification" aria-label="Filter classification"><option value="">${state.workspace.kind==='Business'?'All patterns':'All spending'}</option>${(state.workspace.kind==='Business'?BUSINESS_PATTERNS.map(p=>p[0]):SPENDING_PATTERNS).map(c=>`<option ${state.filters.classification===c?'selected':''}>${c}</option>`).join('')}</select>${businessFilters()}<button class="btn" type="submit">${icon('search')} Apply</button>${Object.keys(state.filters).length?'<button class="btn ghost" type="button" data-action="clear-filters">Clear</button>':''}</form>`;}
function transactionsPage(){return `${toolbar()}${filtersHTML()}<div class="panel"><div class="panel-head table-head"><h2>Transaction ledger</h2>${badge(state.overview.count+' records','gray')}</div>${transactionTable(state.overview.transactions)}<div class="table-foot"><span>Expenses ${exactMoney(state.overview.spend)} · Income ${exactMoney(state.overview.income)}</span><span>All amounts in ${state.workspace.currency}</span></div></div>`;}
function budgetsPage(){const o=state.overview;return `${toolbar()}<div class="stats-grid">${stat('Monthly budget',o.budget?money(o.budget):'—','wallet','','Your overall plan for this month')}${stat('Actual spend',money(o.spend),'arrows','','Posted expense transactions')}${stat('Remaining',o.remaining===null?'—':money(o.remaining),'target','green','Budget minus actual expenses')}${stat('Month-end estimate',o.forecast===null?'—':money(o.forecast),'trend','blue','Regular daily run rate + exceptional spend')}</div><p class="small muted" style="margin-bottom:20px;line-height:1.8">${esc(o.forecast_basis)}</p>${o.budgets.length?`<div class="records-grid">${o.budgets.map(b=>`<article class="panel record-card"><div class="record-card-top"><span class="stat-icon">${icon(catIcon(b.category))}</span>${badge(budgetStatus(b),budgetTone(b))}</div><h2>${esc(b.category==='Overall'?'Overall monthly budget':b.category)}</h2><p>${esc(monthLabel())}</p><div class="big-money">${money(b.spent)} <span class="small muted">/ ${money(b.amount)}</span></div>${progress(b.spent,b.amount,budgetTone(b))}<p>${money(Math.abs(b.amount-b.spent))} ${b.spent>b.amount?'over budget':'remaining'} · ${Math.round(b.spent/b.amount*100)}% used</p><div class="card-actions"><button class="text-btn" data-action="drill-category" data-category="${b.category==='Overall'?'':esc(b.category)}">View expenses ${icon('arrow')}</button>${editable()?`<button class="icon-btn" data-action="edit-budget" data-id="${b.id}" aria-label="Edit ${esc(b.category)} budget">${icon('edit')}</button><button class="icon-btn" data-action="delete" data-resource="budgets" data-id="${b.id}" data-name="${esc(b.category)} budget" aria-label="Delete budget">${icon('trash')}</button>`:''}</div></article>`).join('')}</div>`:empty('Make your first spending plan','Create an overall budget, then set category limits.','add-budget','Create budget')}`;}
function subscriptionsPage(){const active=state.subscriptions.filter(s=>s.status==='active'),monthly=Math.round(active.reduce((sum,s)=>sum+s.amount/(s.cadence==='yearly'?12:s.cadence==='quarterly'?3:1),0));return `<div class="stats-grid">${stat('Monthly equivalent',money(monthly),'repeat','','Active plans normalized to a month')}${stat('Annual equivalent',money(monthly*12),'calendar','blue','Estimate at current plan prices')}${stat('Active subscriptions',active.length,'check','green','Your current recurring commitments')}${stat('Next renewal',active.length?dateLabel([...active].sort((a,b)=>a.renewal.localeCompare(b.renewal))[0].renewal):'—','clock','amber','Scheduled renewal, not a posted expense')}</div>${state.subscriptions.length?`<div class="records-grid">${state.subscriptions.map(s=>`<article class="panel record-card"><div class="record-card-top"><span class="service-logo ${serviceClass(s.name)}">${esc(s.name[0])}</span>${badge(s.status,s.status==='active'?'green':'gray')}</div><h2>${esc(s.name)}</h2><p>${esc(s.category)} · ${esc(s.owner)}</p><div class="big-money">${money(s.amount)} <span class="small muted">/ ${s.cadence==='yearly'?'year':s.cadence==='quarterly'?'quarter':'month'}</span></div><p>Renewal: ${dateLabel(s.renewal)}, ${s.renewal.slice(0,4)}${s.renewal<localDate()?' · Review overdue date':''}</p>${editable()?`<div class="card-actions">${s.status==='active'?`<button class="btn" data-action="pay-subscription" data-id="${s.id}" data-occurrence="${s.renewal}">${icon('check')} Record payment</button>`:''}<button class="btn" data-action="edit-subscription" data-id="${s.id}">${icon('edit')} Manage plan</button><button class="icon-btn" data-action="delete" data-resource="subscriptions" data-id="${s.id}" data-name="${esc(s.name)}" aria-label="Delete ${esc(s.name)}">${icon('trash')}</button></div>`:''}</article>`).join('')}</div>`:empty('Bring your recurring costs together','Add subscriptions to track costs and upcoming renewals.','add-subscription','Add subscription')}`;}
function goalsPage(){return `${state.goals.length?`<div class="records-grid">${state.goals.map(g=>{const remaining=Math.max(g.target-g.saved,0), months=Math.max(1,Math.ceil((new Date(g.due+'T12:00:00')-new Date())/86400000/30.44));return `<article class="panel record-card"><div class="record-card-top"><span class="stat-icon">${icon('target')}</span>${badge(g.saved>=g.target?'Goal reached':`${Math.round(g.saved/g.target*100)}% there`,g.saved>=g.target?'green':'')}</div><h2>${esc(g.name)}</h2><p><span class="goal-type">${esc(goalTypeLabel(g.goal_type))}</span></p><p>Target: ${dateLabel(g.due)}, ${g.due.slice(0,4)}</p><div class="big-money">${money(g.saved)}</div><p>saved toward ${money(g.target)}</p>${progress(g.saved,g.target)}<p>${money(remaining)} left to save</p><p>${g.due<localDate()&&remaining?'Target date passed. Update your plan.':remaining?`About ${money(Math.ceil(remaining/months))}/month to reach your target.`:'A milestone worth celebrating.'}</p>${editable()?`<div class="card-actions"><button class="btn" data-action="edit-goal" data-id="${g.id}">${icon('plus')} Update savings</button><button class="icon-btn" data-action="delete" data-resource="goals" data-id="${g.id}" data-name="${esc(g.name)}" aria-label="Delete ${esc(g.name)}">${icon('trash')}</button></div>`:''}</article>`;}).join('')}</div><p class="small muted" style="margin-top:20px">Savings balances are tracked manually. Monthly contributions are estimates using remaining amount and time to target.</p>`:empty('What are you saving for?','An emergency fund, a big adventure, or a place to call home.','add-goal','Create goal')}`;}
function memberSpendingPanel(){
  const o=state.overview,m=o.member_spending;
  const rows=[...m.members.map(x=>({name:x.name+(x.id===state.user.id?' (you)':''),sub:x.username?'@'+x.username:'',amount:x.amount})),
    ...(m.private?[{name:'Private details',sub:'Amount-only records; member hidden',amount:m.private}]:[]),
    ...(m.unattributed?[{name:'Unassigned',sub:`${m.unassigned_count} expense${m.unassigned_count===1?'':'s'} without a current member`,amount:m.unattributed,unassigned:true}]:[])];
  return `<section class="panel member-spending"><div class="panel-head"><div><h2>Member spending</h2><p>By "Spent by" · ${esc(monthLabel())}</p></div></div><div class="owner-bars">${rows.map(r=>`<div class="member-row"><div class="budget-item-top"><span>${esc(r.name)} <small class="muted">${esc(r.sub)}</small></span><span>${money(r.amount)}</span></div>${progress(r.amount,o.spend)}${r.unassigned&&editable()?`<button type="button" class="text-btn" data-action="review-unassigned">Review and assign ${icon('arrow')}</button>`:''}</div>`).join('')}</div><div class="chart-foot">${icon('shield')} Includes every current member. Other members' private records are not counted.</div></section>`;
}
function ownersPanel(){if(state.workspace.kind==='Household')return memberSpendingPanel();const o=state.overview;return `<section class="panel"><div class="panel-head"><h2>${state.workspace.kind==='Business'?'Department spending':state.workspace.kind==='Household'?'Member spending':'Spending ownership'}</h2></div>${o.owners.length?`<div class="owner-bars">${o.owners.map(r=>`<div><div class="budget-item-top"><span>${esc(r.name)}</span><span>${money(r.amount)}</span></div>${progress(r.amount,o.spend)}</div>`).join('')}</div>`:empty('No spending yet','Assigned expenses will appear here.')}</section>`;}
function analyticsPage(){const o=state.overview;return `${toolbar()}${filtersHTML()}${stats()}${state.workspace.kind==='Business'?`<div style="margin-bottom:20px">${trendPanel('revenue')}</div>`:''}${state.workspace.kind==='Personal'?`<div style="margin-bottom:20px">${trendPanel()}</div>`:`<div class="two-panels" style="margin-bottom:20px">${trendPanel()}${ownersPanel()}</div>`}<div class="two-panels"><section class="panel"><div class="panel-head"><h2>Category breakdown</h2><span class="small muted">Click to explore</span></div><div class="owner-bars">${o.categories.length?o.categories.map((c,i)=>`<div><button class="category-row" style="font-size:12px;margin-bottom:10px" data-action="drill-category" data-category="${esc(c.name)}"><span class="dot" style="background:${colors[i%colors.length]}"></span><span>${esc(c.name)}</span><b>${exactMoney(c.amount)}</b>${icon('chevron')}</button>${progress(c.amount,o.spend)}</div>`).join(''):empty('No matching expenses','Try another period or clear your filters.')}</div></section><section class="panel"><div class="panel-head"><h2>The shape of your spending</h2></div><div class="owner-bars"><div><div class="budget-item-top"><span>Regular spending</span><span>${money(o.regular)}</span></div>${progress(o.regular,o.spend)}</div><div><div class="budget-item-top"><span>Exceptional spending</span><span>${money(o.exceptional)}</span></div>${progress(o.exceptional,o.spend,'amber')}</div><div><div class="budget-item-top"><span>Essential spending</span><span>${money(o.essential)}</span></div>${progress(o.essential,o.spend,'green')}</div><div><div class="budget-item-top"><span>Discretionary spending</span><span>${money(o.discretionary)}</span></div>${progress(o.discretionary,o.spend)}</div></div><div class="chart-foot">${icon('info')} These are separate classifications. Amount-only private records are excluded from classifications when details are hidden.</div><details class="report-definitions"><summary>How these numbers are calculated</summary><p>Expenses = sum of expense records matching every active filter. Income = sum of matching income records. ${state.workspace.kind==='Household'?'Net income':'Net cash flow'} = income − expenses; this is not a bank balance. Regular spend excludes one-time, event, emergency, gift, travel and major purchase classifications. Savings rate = (income − expenses) ÷ income; unavailable when income is zero. Prior-period comparison uses the same elapsed days in the previous month. Forecasts are estimates and exclude future commitments. Budgets stay fixed when transaction filters change.</p></details></section></div>`;}
function insightsPage(){return `${toolbar()}<div class="ai-hero">${icon('spark')}<h2>Your numbers have a story.</h2><p>Ask about spending, your budget, income or the month ahead.<br>Every answer comes from this workspace’s records.</p><form class="ask-form" id="ask-form"><input name="question" placeholder="Where did I spend the most this month?" maxlength="500" required aria-label="Ask a question"><button class="btn primary" type="submit">Ask Trikosh ${icon('arrow')}</button></form><div class="suggestions">${['Summarize my spending','How is my budget?','What is my forecast?'].map(q=>`<button data-action="ask-suggestion" data-question="${q}">${q}</button>`).join('')}</div><p style="font-size:10px;margin-top:18px">Local analysis · Deterministic, server-side insights. No external AI model connected.</p></div>${state.answer?`<section class="panel answer-box"><h3>${icon('spark')}From your ${esc(monthLabel())} records</h3><p>${esc(state.answer.answer)}</p><button class="text-btn" data-action="answer-evidence">View ${state.answer.evidence.length} source records ${icon('arrow')}</button></section>`:''}<div class="insights-grid">${state.insights.map(insightCard).join('')}</div>`;}
function settingsPage(){return `<div class="settings-grid"><section class="panel"><h2>Workspace details</h2><p>${esc(state.workspace.name)} · ${esc(state.workspace.currency)} · Your role: ${esc(state.workspace.role)}</p><form id="workspace-settings" class="form-grid">${field('Workspace name','name',state.workspace.name,'text','full')}${state.workspace.kind!=='Business'?field('Members','members',state.workspace.settings.members,'text','full','Comma-separated member labels for assigning expenses. Shared records are visible to workspace members; creators control transaction privacy.'):state.workspace.kind==='Business'?field('Departments','departments',state.workspace.settings.departments,'text','full','Comma-separated department labels.')+field('Industry','industry',state.workspace.settings.industry,'text','full'):''}<div class="full">${state.workspace.role==='owner'?'<button class="btn primary" type="submit">Save workspace</button>':''}</div><div class="form-error full" id="settings-error" role="alert"></div></form></section>
  <section class="panel"><h2>Workspace access</h2>${state.workspace.kind==='Personal'?`<p>Personal workspaces are private to you. To share money with family, use your Household workspace.</p>${state.accountType==='personal_household'?`<button class="btn" data-action="switch-view" data-view="Household">${icon('users')} Go to Household</button>`:''}`:`<p>Owners manage access. Members edit shared records. Viewers can browse and export. Add someone by username or email after they have created a ${state.workspace.kind==='Business'?'Business':'Personal / Household'} account.</p>${state.workspace.role==='owner'?`<button class="btn" data-action="members">${icon('users')} Manage access</button>`:badge('Managed by your workspace owner','gray')}`}<h2 style="margin-top:25px">Appearance</h2><p>Choose the theme that feels right. Saved on this browser.</p><button class="btn" data-action="theme">${icon('moon')} Toggle light / dark</button></section>
  <section class="panel"><h2>Categories</h2><p>Keep your spending organized. Renaming a category also updates its linked records.</p>${editable()?'<button class="btn" data-action="add-category">'+icon('plus')+' Add category</button>':''}<div class="settings-list">${state.categories.map(c=>`<span class="category-chip">${esc(c.name)}${editable()?`<button class="icon-btn" data-action="edit-category" data-id="${c.id}" aria-label="Rename ${esc(c.name)}">${icon('edit')}</button>`:''}</span>`).join('')}</div></section>
  <section class="panel"><h2>${state.workspace.demo?'Demo workspace':'Workspace activity'}</h2><p>${state.workspace.demo?'Six months of synthetic transactions, budgets and recurring costs. Reset restores this workspace’s financial sample data.':'Financial changes are recorded in the workspace audit trail.'}</p><button class="btn" data-action="audit">${icon('clock')} View audit trail</button>${state.workspace.demo&&state.workspace.role==='owner'?`<button class="btn danger" data-action="reset" style="margin:10px 0">${icon('repeat')} Reset demo data</button>`:''}<p style="margin-top:15px;font-size:10px">For assistance, contact admin@trikosh.com.</p></section></div>`;}

function field(label,name,value='',type='text',classes='',hint=''){return `<label class="field ${classes}">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" max="1000000000" step="0.01"':''} ${name==='password'?'minlength="10" maxlength="256" autocomplete="new-password"':''} ${name==='date'?`max="${localDate()}"`:''} ${['notes','saved','budget'].includes(name)?'':'required'} maxlength="${name==='name'?160:500}">${hint?`<small>${esc(hint)}</small>`:''}</label>`;}
function selectField(label,name,options,value,classes=''){return `<label class="field ${classes}">${esc(label)}<select name="${name}">${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`;}).join('')}</select></label>`;}
function openModal(title,content,{wide=false,onSubmit}={}){
  lastFocus=document.activeElement;
  modalRoot.innerHTML=`<div class="modal-overlay"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${content}</div></section></div>`;
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>modalRoot.querySelector('input,select,textarea,button')?.focus());
  if(onSubmit)modalRoot.querySelector('form').addEventListener('submit',onSubmit);
}
function closeModal(){modalRoot.innerHTML='';document.body.style.overflow='';lastFocus?.focus();}
function formFooter(label){return `<div class="form-error" role="alert"></div><div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">${esc(label)}</button></div>`;}
function recordForm(resource,title,fields,record){openModal(title,`<form><div class="form-grid">${fields}</div>${formFooter(record?'Save changes':'Create '+title.replace(/^Add |^Create /,'').toLowerCase())}</form>`,{onSubmit:async e=>{
  e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form));if(resource==='transactions'){const missing=householdChoiceMissing(form);if(missing){form.querySelector('.form-error').textContent=missing;return;}data.essential=form.elements.essential.checked;businessFormPayload(form,data);}
  const submitApproval=resource==='transactions'&&form.elements.submit_approval?.checked;delete data.submit_approval;
  await submitForm(form,async()=>{const saved=await api(endpoint(resource)+(record?'/'+record.id:''),record?'PUT':'POST',data);if(submitApproval)await api(endpoint('approval-submissions'),'POST',{transaction_id:record?record.id:saved.id});closeModal();await load();toast(submitApproval?'Saved and submitted for approval.':record?'Changes saved.':'Added to your workspace.');});
}});}
async function submitForm(form,fn,busyLabel){const button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;const label=button.innerHTML;if(busyLabel){button.innerHTML=`<span class="spinner" aria-hidden="true"></span>${esc(busyLabel)}`;}form.setAttribute('aria-busy','true');const error=form.querySelector('.form-error');if(error)error.textContent='';try{await fn();}catch(e){if(error)error.textContent=e.message;else toast(e.message);}finally{button.disabled=false;form.removeAttribute('aria-busy');if(busyLabel&&button.isConnected)button.innerHTML=label;}}
function transactionForm(id){
  if(!id&&state.workspace.kind!=='Business'){simpleEntry();return;}
  return advancedTransactionForm(id);
}
function advancedTransactionForm(id){
  const r=state.overview.transactions.find(t=>t.id===id);
  const owners=state.workspace.kind!=='Business'?[...new Set(['Me','Shared',...state.workspace.settings.members.split(',').map(s=>s.trim()).filter(Boolean)])]:state.workspace.kind==='Business'?state.workspace.settings.departments.split(',').map(s=>s.trim()).filter(Boolean):['Me'];
  if(r&&!owners.includes(r.owner))owners.push(r.owner);
  const fields=selectField('Transaction type','kind',[['expense','Expense'],['income','Income']],r?.kind||'expense')+field(`Amount (${state.workspace.currency})`,'amount',r?r.amount/100:'','number')+field(state.workspace.kind==='Business'?'Vendor / merchant':'Merchant / description','merchant',r?.merchant||'','text','full')+field('Date','date',r?.date||localDate(),'date')+selectField('Category','category',state.categories.map(c=>c.name),r?.category||state.categories[0]?.name)+selectField('Payment method','payment',['UPI','Cash','Debit card','Credit card','Bank transfer','Wallet','Other'],r?.payment||'UPI')+patternField(r)+selectField(state.workspace.kind==='Business'?'Department':'Assigned to','owner',owners,r?.owner||owners[0])+`<label class="check-field"><input name="essential" type="checkbox" ${r?.essential?'checked':''}> Essential expense</label><label class="field full">Notes<textarea name="notes" maxlength="2000" placeholder="A little context for later…">${esc(r?.notes||'')}</textarea></label>`;
  recordForm('transactions',r?'Edit transaction':'Add transaction',fields+transactionExtraFields(r),r);wireBusinessFields();
}
function budgetForm(id){const r=state.overview.budgets.find(b=>b.id===id);recordForm('budgets',r?'Edit budget':'Create budget',selectField('Category','category',['Overall',...state.categories.map(c=>c.name)],r?.category||'Overall','full')+field('Month','month',r?.month||state.month,'month')+field(`Budget (${state.workspace.currency})`,'amount',r?r.amount/100:'','number'),r);}
function subscriptionForm(id){const r=state.subscriptions.find(s=>s.id===id);recordForm('subscriptions',r?'Manage subscription':'Add subscription',field('Subscription name','name',r?.name||'','text','full')+field(`Cost per billing cycle (${state.workspace.currency})`,'amount',r?r.amount/100:'','number')+selectField('Billing cycle','cadence',['monthly','quarterly','yearly'],r?.cadence||'monthly')+field('Next renewal','renewal',r?.renewal||localDate(),'date')+selectField('Category','category',state.categories.map(c=>c.name),r?.category||(state.workspace.kind==='Business'?'Software':'Subscriptions'))+field('Owner','owner',r?.owner||'Me')+selectField('Status','status',['active','paused','cancelled'],r?.status||'active'),r);}
// Text input for money so formatted values such as 24,000 or 1,00,000 are accepted, not silently dropped.
function amountField(label,name,value='',classes='',hint='',optional=false){return `<label class="field ${classes}">${esc(label)}<input name="${name}" type="text" inputmode="decimal" autocomplete="off" maxlength="20" value="${esc(value)}" ${optional?'':'required'} placeholder="0">${hint?`<small>${esc(hint)}</small>`:''}</label>`;}
function parseAmount(raw,label,{allowZero=false,optional=false}={}){
  const text=String(raw??'').replace(/[₹$€£,\s]/g,'');
  if(!text){if(optional)return '0';throw new Error(`Enter ${label}.`);}
  if(!/^\d+(\.\d{1,2})?$/.test(text))throw new Error(`${label[0].toUpperCase()+label.slice(1)} must be a number with up to 2 decimal places, for example 25000 or 1,00,000.`);
  const number=Number(text);
  if(number>1000000000)throw new Error(`${label[0].toUpperCase()+label.slice(1)} is too large.`);
  if(!allowZero&&number===0)throw new Error(`${label[0].toUpperCase()+label.slice(1)} must be more than zero.`);
  return text;
}
const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(new Date(value+'T12:00:00').getTime());
const SPENDING_PATTERNS=['regular','one-time','event','emergency','gift','travel','major purchase'];
const BUSINESS_PATTERNS=[['one-time','One Time'],['recurring','Recurring'],['event','Event'],['travel','Travel'],['monthly','Monthly'],['purchase','Purchase'],['other','Other']];
const patternLabel=v=>(BUSINESS_PATTERNS.find(p=>p[0]===v)||[v,v?v[0].toUpperCase()+v.slice(1):''])[1];
function patternField(r){
  if(state.workspace.kind!=='Business')return selectField('Spending pattern','classification',SPENDING_PATTERNS,r?.classification||'regular');
  const value=r?.classification||'one-time',options=[...BUSINESS_PATTERNS];
  if(!options.some(o=>o[0]===value))options.push([value,patternLabel(value)+' (earlier value)']);
  return selectField('Transaction Pattern','classification',options,value);
}
const GOAL_TYPES=[['savings','Savings goal'],['fd','Fixed Deposit (FD)'],['rd','Recurring Deposit (RD)']];
const goalTypeLabel=type=>(GOAL_TYPES.find(g=>g[0]===type)||GOAL_TYPES[0])[1];
function goalForm(id){
  const r=state.goals.find(g=>g.id===id),currency=state.workspace.currency;
  const fields=field('Goal name','name',r?.name||'','text','full')+selectField('Goal type','goal_type',GOAL_TYPES,r?.goal_type||'savings','full')+amountField(`Target (${currency})`,'target',r?r.target/100:'')+amountField(`Already saved (${currency})`,'saved',r?r.saved/100:0,'','',true)+field('Target date','due',r?.due||localDate(new Date(Date.now()+180*86400000)),'date','full');
  openModal(r?'Update savings goal':'Create goal',`<form novalidate><div class="form-grid">${fields}</div><p class="feature-explainer">FD and RD goals use the same target, saved amount and date tracking. Interest is not calculated.</p>${formFooter(r?'Save changes':'Create goal')}</form>`,{onSubmit:async e=>{
    e.preventDefault();
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),error=form.querySelector('.form-error');
    try{
      if(!data.name.trim())throw new Error('Enter a goal name.');
      data.target=parseAmount(data.target,'the target amount');
      data.saved=parseAmount(data.saved,'the amount already saved',{allowZero:true,optional:true});
      if(!isoDate(data.due))throw new Error('Choose a target date.');
    }catch(err){error.textContent=err.message;return;}
    await submitForm(form,async()=>{await api(endpoint('goals')+(r?'/'+r.id:''),r?'PUT':'POST',data);closeModal();await load();toast(r?'Goal updated.':'Goal created.');},'Saving…');
  }});
}
function categoryForm(id){const r=state.categories.find(c=>c.id===id);recordForm('categories',r?'Rename category':'Add category',field('Category name','name',r?.name||'','text','full'),r);}
function confirmDialog(title,description,action,label='Confirm'){openModal(title,`<form><p class="dialog-copy">${esc(description)}</p>${formFooter(label)}</form>`,{onSubmit:async e=>{e.preventDefault();await submitForm(e.currentTarget,async()=>{await action();closeModal();await load();toast('Done. Your workspace is up to date.');});}});}
function showEvidence(ids,basis='',category=''){const rows=state.overview.transactions.filter(t=>ids.includes(t.id));openModal('The records behind the insight',`<p class="modal-desc">${esc(basis||'These records belong to the selected workspace and reporting period.')}<br>${rows.length} records · ${esc(monthLabel())}</p>${rows.length?transactionTable(rows,false):'<p class="feature-empty">No matching records for this period.</p>'}<div class="modal-footer"><button type="button" class="btn" data-action="close-modal">Close</button><button type="button" class="btn primary" data-action="drill-category" data-category="${esc(category)}">Open in Transactions ${icon('arrow')}</button></div>`,{wide:true});}
async function ask(question){const form=document.getElementById('ask-form'),button=form?.querySelector('button');if(button)button.disabled=true;const wid=state.workspace.id,month=state.month;try{const answer=await api(endpoint('insights')+'?'+query(),'POST',{question});if(wid!==state.workspace.id||month!==state.month)return;state.answer=answer;render();}finally{if(button)button.disabled=false;}}

const ACCOUNT_OPTIONS=[['personal_household','Personal / Household'],['business','Business']];
const USERNAME_PATTERN='[a-zA-Z0-9][a-zA-Z0-9._\\-]{1,28}[a-zA-Z0-9]';
const USERNAME_HELP='Usernames use 3–30 letters, numbers, dots, dashes or underscores, and start and end with a letter or number.';
function accountTypeCards(selected){
  const info={personal_household:['users','Personal / Household','Your private money plus a shared family space.'],business:['building','Business','Operating costs, departments, approvals and projects.']};
  return `<fieldset class="account-type-cards"><legend>Account type</legend>${ACCOUNT_OPTIONS.map(([value])=>{const [symbol,label,text]=info[value];return `<label class="account-type-card"><input type="radio" name="account_type" value="${value}" ${value===selected?'checked':''} required><span>${icon(symbol)}<strong>${label}</strong><small>${text}</small></span></label>`;}).join('')}</fieldset>`;
}
function usernameInput(){return `<label class="field">Username<input name="username" required minlength="3" maxlength="30" pattern="${USERNAME_PATTERN}" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. priya.sharma"><small>3–30 characters: letters, numbers, dots, dashes or underscores. People you share a Household or Business with can find you by it.</small></label>`;}
// ---- Workspace invitations: /invite?token=… returns here after sign-in or sign-up ----
const INVITE_KEY='trikosh-invite';
let inviteToken=null,invitePreview=null;
function persistInvite(){if(inviteToken)sessionStorage.setItem(INVITE_KEY,JSON.stringify({token:inviteToken,preview:invitePreview}));else sessionStorage.removeItem(INVITE_KEY);}
function inviteNotice(){const p=invitePreview;return p?`${p.inviter} has invited you to join ${p.workspace_name} on Trikosh. Sign in or create an account with ${p.email} to accept the invitation.`:'';}
async function loadInvite(){
  if(location.pathname==='/invite'){inviteToken=new URLSearchParams(location.search).get('token');history.replaceState(null,'','/');}
  else{try{const saved=JSON.parse(sessionStorage.getItem(INVITE_KEY)||'null');if(saved){inviteToken=saved.token;invitePreview=saved.preview;}}catch{}}
  if(inviteToken&&!invitePreview){
    try{invitePreview=await api('/api/invites/preview?token='+encodeURIComponent(inviteToken));}
    catch(error){inviteToken=null;persistInvite();return error.message;}
  }
  persistInvite();
  return '';
}
async function acceptPendingInvite(){
  const token=inviteToken,preview=invitePreview;
  inviteToken=null;invitePreview=null;persistInvite();
  let result;
  try{result=await api('/api/invites/accept','POST',{token});}
  catch(error){await bootstrap();openModal('Invitation not accepted',`<p class="modal-desc">${esc(error.message)}</p><div class="modal-footer"><button type="button" class="btn primary" data-action="close-modal">OK</button></div>`);return;}
  if(result.switch_account_type){
    // The workspace belongs to the other account type: sign in again with the same email and password.
    try{await api('/api/auth/logout','POST',{});}catch{}
    clearClientState();
    sessionStorage.setItem('opsmind-last-account',result.account_type);
    renderAuth('login',`You joined ${result.workspace_name}. Sign in again with ${result.kind==='Business'?'Business':'Personal / Household'} selected to open it.`);
    return;
  }
  state.view=result.kind;state.page='overview';state.overview=null;
  await bootstrap(result.workspace_id);
  toast(`You joined ${result.workspace_name}${preview?' · invited by '+preview.inviter:''}.`);
}
function renderAuth(mode='login',notice=''){
  state.overview=null;
  setPath('/login');
  const signup=mode==='signup';
  notice=notice||inviteNotice();
  const formFields=signup
    ?`${accountTypeCards(invitePreview?.account_type||'personal_household')}${field('Your name','name','','text')}${usernameInput()}${field('Email address','email',invitePreview?.email||'','email')}<label class="field">Password<input type="password" name="password" required minlength="10" maxlength="256" autocomplete="new-password" placeholder="At least 10 characters"></label>`
    :`${selectField('Account type','account_type',ACCOUNT_OPTIONS,invitePreview?.account_type||sessionStorage.getItem('opsmind-last-account')||'personal_household','full')}<label class="field">Email or username<input name="identifier" required maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@example.com or username"></label><label class="field">Password<input type="password" name="password" required maxlength="256" autocomplete="current-password" placeholder="Enter your password"></label>`;
  app.innerHTML=`<div class="auth-page"><section class="auth-story"><div class="auth-brand"><img src="/Trikosh_mark.png" width="60" height="60" alt=""><div><strong>Trikosh</strong><span>Every Saving has a Story</span></div></div><div><h1>A clearer picture.<br>A little more<br><em>peace of mind.</em></h1><p>From everyday expenses to your next big goal. One thoughtful space to understand your money.</p><div class="auth-proof"><div class="auth-proof-top"><span>Your financial story</span>${icon('spark')}</div><strong>More than numbers.</strong><span class="small muted">Personal. Household. Business.</span><div class="mini-bars">${[32,49,38,66,54,75,61,89,74,95,85,100].map(h=>`<span style="height:${h}%"></span>`).join('')}</div><span class="badge green">Clarity starts here</span></div></div><footer>TRIKOSH · YOUR FINANCIAL WORKSPACE</footer></section><section class="auth-main"><div class="auth-form-wrap"><h2>${signup?'Make space for financial clarity.':'Welcome to your money space.'}</h2><p>${signup?'Choose your account type and a unique username.':'Choose your account type, then sign in.'}</p>${notice?`<div class="auth-notice" role="status">${icon('info')}<span>${esc(notice)}</span></div>`:''}<form id="auth-form" novalidate>${formFields}<div class="form-error" role="alert"></div><button class="btn primary" type="submit">${signup?'Create account':'Sign in'} ${icon('arrow')}</button></form>${signup?'':'<div class="auth-forgot" id="auth-forgot" hidden><button type="button" class="text-btn" data-action="forgot-password">Forgot password?</button></div>'}<div class="auth-bottom">${signup?'Already have an account?':'New here?'} <button class="text-btn" data-action="auth-toggle" data-mode="${signup?'login':'signup'}">${signup?'Sign in':'Create an account'}</button></div></div></section></div>`;
  const form=document.getElementById('auth-form');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    const problem=validateAuth(data,signup);
    if(problem){form.querySelector('.form-error').textContent=problem;return;}
    await submitForm(form,async()=>{
      const result=await api('/api/auth/'+mode,'POST',data);
      sessionStorage.clear();
      persistInvite();
      sessionStorage.setItem('opsmind-last-account',result.account_type);
      Object.assign(state,{csrf:result.csrf,workspace:null,view:null,page:'overview',filters:{},overview:null,dashboard:null});
      await bootstrap();
    },signup?'Creating account…':'Signing in…');
  });
  // Show "Forgot password?" only when the server can send reset emails, so the link is never dead.
  if(!signup)passwordResetEnabled().then(on=>{const slot=document.getElementById('auth-forgot');if(on&&slot)slot.hidden=false;});
}
let resetEnabledPromise=null;
function passwordResetEnabled(){return resetEnabledPromise||(resetEnabledPromise=api('/api/auth/config').then(c=>!!c.password_reset,()=>{resetEnabledPromise=null;return false;}));}
// Reuses the login page layout: swaps only the form column.
function authPanel(title,text,body){
  renderAuth('login');
  document.querySelector('.auth-form-wrap').innerHTML=`<h2>${esc(title)}</h2><p>${esc(text)}</p>${body}<div class="auth-bottom"><button class="text-btn" data-action="auth-toggle" data-mode="login">${icon('arrow')} Back to sign in</button></div>`;
}
function renderForgotPassword(){
  authPanel('Forgot your password?','Enter the email or username for your account. We will email you a link to choose a new password.',`<form id="forgot-form" novalidate><label class="field">Email or username<input name="identifier" required maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you@example.com or username"></label><div class="form-error" role="alert"></div><button class="btn primary" type="submit">Email me a reset link ${icon('arrow')}</button></form>`);
  const form=document.getElementById('forgot-form');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const identifier=String(new FormData(form).get('identifier')||'').trim();
    if(!identifier){form.querySelector('.form-error').textContent='Enter your email or username.';return;}
    await submitForm(form,async()=>{const r=await api('/api/auth/forgot','POST',{identifier});renderAuth('login',r.message);},'Sending…');
  });
}
function renderResetPassword(token){
  authPanel('Choose a new password','Use at least 10 characters. You will be signed out on all devices.',`<form id="reset-form" novalidate><label class="field">New password<input type="password" name="password" required minlength="10" maxlength="256" autocomplete="new-password" placeholder="At least 10 characters"></label><label class="field">Confirm new password<input type="password" name="confirm" required minlength="10" maxlength="256" autocomplete="new-password"></label><div class="form-error" role="alert"></div><button class="btn primary" type="submit">Save new password ${icon('arrow')}</button></form>`);
  history.replaceState(null,'','/reset');  // keep the token out of the address bar and history
  const form=document.getElementById('reset-form');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const {password,confirm}=Object.fromEntries(new FormData(form));
    const error=form.querySelector('.form-error');
    if((password||'').length<10){error.textContent='Use a password with at least 10 characters.';return;}
    if(password!==confirm){error.textContent='The two passwords do not match.';return;}
    await submitForm(form,async()=>{await api('/api/auth/reset','POST',{token,password});renderAuth('login','Password updated. Sign in with your new password.');},'Saving…');
  });
}
function validateAuth(data,signup){
  if(!data.account_type)return 'Choose Personal / Household or Business.';
  if(signup){
    if(!data.name?.trim())return 'Enter your name.';
    if(!new RegExp('^'+USERNAME_PATTERN+'$').test(data.username||''))return USERNAME_HELP;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||''))return 'Enter a valid email address.';
    if((data.password||'').length<10)return 'Use a password with at least 10 characters.';
  }else{
    if(!data.identifier?.trim())return 'Enter your email or username.';
    if(!data.password)return 'Enter your password.';
  }
  return '';
}
// The login page no longer shows a demo button; the demo API remains for automated UI tests.
async function openDemo(){const result=await api('/api/auth/demo','POST',{account_type:selectedAccountType()});sessionStorage.clear();Object.assign(state,{csrf:result.csrf,workspace:null,view:null,page:'overview',filters:{},overview:null,dashboard:null});await bootstrap();}
function selectedAccountType(){const form=document.getElementById('auth-form');return form?(new FormData(form).get('account_type')||'personal_household'):'personal_household';}
function renderUsernameSetup(){
  app.innerHTML=`<div class="onboarding">${setupHeader()}<section class="panel"><h1>Choose your username.</h1><p>Usernames are new. Pick one to finish setting up your account.</p><form id="username-form" novalidate>${usernameInput()}<div class="form-error" role="alert"></div><button class="btn primary" type="submit">Save username ${icon('arrow')}</button></form></section></div>`;
  const form=document.getElementById('username-form');
  form.addEventListener('submit',async e=>{e.preventDefault();const value=String(new FormData(form).get('username')||'');if(!new RegExp('^'+USERNAME_PATTERN+'$').test(value)){form.querySelector('.form-error').textContent=USERNAME_HELP;return;}await submitForm(form,async()=>{await api('/api/auth/username','POST',{username:value});await bootstrap();toast('Username saved.');},'Saving…');});
}
function workspaceFields(kind){return field('Workspace name','name',defaultWorkspaceName(kind),'text','full')+selectField('Currency','currency',[['INR','INR · Indian rupee'],['USD','USD · US dollar'],['EUR','EUR · Euro'],['GBP','GBP · British pound']],'INR')+field('Monthly budget (optional)','budget','','number')+(kind==='Household'?field('Household members','members','Me','text','full','Names used to assign expenses, separated by commas. To give someone their own login, add their username later in Settings.'):kind==='Personal'?'':field('Departments','departments','Engineering, Marketing, Operations','text','full')+field('Industry','industry','','text','full'));}
function workspaceTypeButtons(kind){
  if(state.kinds.length<2)return `<div class="workspace-types single"><span class="workspace-type selected">${icon(wsIcon(kind))}${kind}</span></div>`;
  return `<div class="workspace-types" role="group" aria-label="Workspace type" style="grid-template-columns:repeat(${state.kinds.length},1fr)">${state.kinds.map(k=>`<button type="button" class="workspace-type ${k===kind?'selected':''}" data-action="workspace-kind" data-kind="${k}" aria-pressed="${k===kind}">${icon(wsIcon(k))}${k}</button>`).join('')}</div>`;
}
const defaultWorkspaceName=kind=>kind==='Personal'?'My personal space':kind==='Household'?'Our household':'Our business';
function onboardingForm(kind,inModal){return `<form id="onboarding-form" data-kind="${kind}" data-modal="${inModal}">${inModal?workspaceTypeButtons(kind):''}<div class="form-grid">${workspaceFields(kind)}</div><div class="form-error" role="alert"></div><button class="btn primary" style="margin-top:22px" type="submit">Create ${kind.toLowerCase()} workspace ${icon('arrow')}</button></form>`;}
function wireOnboarding(kind){
  document.getElementById('onboarding-form').addEventListener('submit',async e=>{e.preventDefault();await submitForm(e.currentTarget,async()=>{const values=Object.fromEntries(new FormData(e.currentTarget));const result=await api('/api/workspaces','POST',{...values,kind,settings:{members:values.members||'Me',departments:values.departments||'Operations',industry:values.industry||'Other'}});closeModal();state.overview=null;state.filters={};state.page='overview';await bootstrap(result.id);toast('Your '+kind.toLowerCase()+' workspace is ready.');},'Creating…');});
}
function renderOnboarding(kind=state.view||'Personal',inModal=false){
  if(!state.kinds.includes(kind))kind=state.kinds[0];
  const copy={Personal:['Set up your personal space.','Your private money: salary, spending, budgets and goals. Only you can see it.'],Household:['Set up your household.','Shared family spending and goals.'],Business:['Set up your business workspace.','Operating costs, departments, approvals and projects for your team.']}[kind];
  if(inModal){openModal('Create a '+kind.toLowerCase()+' workspace',onboardingForm(kind,true));}
  else{state.overview=null;app.innerHTML=`<div class="onboarding">${setupHeader()}<section class="panel"><h1>${copy[0]}</h1><p>${copy[1]}</p>${onboardingForm(kind,false)}</section></div>`;}
  wireOnboarding(kind);
}
// Shown when a Personal / Household account has not created or joined a household yet.
function renderHouseholdSetup(){
  state.overview=null;
  app.innerHTML=`<div class="onboarding household-setup">${setupHeader()}<div class="setup-grid"><section class="panel"><span class="stat-icon">${icon('users')}</span><h1>Create a household</h1><p>A shared space for family spending, bills and goals. Your Personal workspace stays private.</p>${onboardingForm('Household',false)}</section>
    <section class="panel"><span class="stat-icon">${icon('home')}</span><h1>Join a household</h1><p>Ask the household owner to open <strong>Settings → Manage access</strong> and add your username:</p><div class="username-chip">@${esc(state.user.username)}</div><p class="small muted">Members see shared household records. Records a member marks private stay private, and nobody in the household can see your Personal workspace.</p><button type="button" class="btn" data-action="refresh-household">${icon('repeat')} I have been added — check again</button></section></div></div>`;
  wireOnboarding('Household');
}
async function searchDialog(){openModal('Find something in your workspace',`<label class="field">Search transactions<input id="global-search" placeholder="Merchant, category or notes…" autocomplete="off"></label><div class="search-results" id="search-results"><p class="small muted">Searches all dates in the current workspace.</p></div><div class="modal-footer"><button class="btn" data-action="close-and-add">${icon('plus')} Add transaction</button><button class="btn" data-action="close-and-ask">${icon('spark')} Ask Trikosh</button></div>`);document.getElementById('global-search').addEventListener('input',e=>{clearTimeout(searchTimer);const value=e.target.value;const wid=state.workspace.id;searchTimer=setTimeout(async()=>{const results=document.getElementById('search-results');if(!results)return;if(!value.trim()){results.innerHTML='<p class="small muted">Searches all dates in the current workspace.</p>';return;}try{const rows=await api(`/api/workspaces/${wid}/transactions?q=`+encodeURIComponent(value));if(document.getElementById('global-search')?.value!==value||state.workspace.id!==wid)return;results.innerHTML=rows.length?rows.slice(0,10).map(r=>`<button data-action="search-select" data-month="${r.date.slice(0,7)}" data-merchant="${esc(r.merchant)}">${icon(catIcon(r.category))}${esc(r.merchant)}<small>${dateLabel(r.date)} · ${exactMoney(r.amount)}</small></button>`).join(''):empty('No matches','Try a different merchant or category.');}catch(err){results.textContent=err.message;}},250);});}
function validContactEmail(v){return !v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());}
function validContactPhone(v){if(!v)return true;if(!/^\+?[\d\s().-]{7,25}$/.test(v.trim()))return false;const n=v.replace(/\D/g,'').length;return n>=7&&n<=15;}
// Members join Household and Business workspaces only by email invitation (see accounts.py).
// Older saved contacts (no access) are still listed so owners can remove them.
function inviteBadge(m){
  if(m.status==='expired')return badge('Invitation expired','amber');
  if(m.last_error)return badge('Email not sent','red');
  return badge('Invitation sent');
}
async function manageMembers(status='',tone='info'){
  const members=await api(endpoint('members'));
  const household=state.workspace.kind==='Household';
  const contactLine=m=>[m.contact?.email,m.contact?.phone].filter(Boolean).map(esc).join(' · ');
  const row=m=>m.invite
    ?`<div class="list-row member-row-item"><div><strong>${esc(m.email)}</strong><small>${esc(m.role)} · ${m.status==='expired'?'expired':'expires '+esc(dateLabel(m.expires.slice(0,10)))}${m.last_error?` · <span class="negative">${esc(m.last_error)}</span>`:''}</small></div><div class="row-end">${inviteBadge(m)}<button type="button" class="btn" data-action="resend-invite" data-id="${m.id}">${icon('repeat')} Resend</button><button type="button" class="icon-btn" data-action="remove-member" data-pending="1" data-invite="1" data-id="${m.id}" data-name="${esc(m.email)}" aria-label="Cancel invitation to ${esc(m.email)}">${icon('trash')}</button></div></div>`
    :m.pending
    ?`<div class="list-row member-row-item"><div><strong>${esc(m.name||m.contact.email||m.contact.phone)}</strong><small>${contactLine(m)}</small></div><div class="row-end">${badge('Saved contact · no access','gray')}<button type="button" class="icon-btn" data-action="remove-member" data-pending="1" data-id="${m.id}" data-name="${esc(m.name||m.contact.email||m.contact.phone)}" aria-label="Remove saved contact">${icon('trash')}</button></div></div>`
    :`<div class="list-row member-row-item"><div><strong>${esc(m.name)}</strong><small>@${esc(m.username||'—')}${m.email?' · '+esc(m.email):''}${contactLine(m)?' · '+contactLine(m):''}</small></div><div class="row-end">${badge(m.role,'gray')}${m.role!=='owner'?`<button type="button" class="icon-btn" data-action="remove-member" data-id="${m.id}" data-name="${esc(m.username||m.name)}" aria-label="Remove ${esc(m.username||m.name)}">${icon('trash')}</button>`:''}</div></div>`;
  const notice=status?`<div class="auth-notice member-status ${tone==='error'?'is-error':''}" role="${tone==='error'?'alert':'status'}">${icon('info')}<span>${esc(status)}</span></div>`:'';
  openModal('Workspace access',`${notice}<p class="modal-desc">Invite someone by email. They get an email with an Accept invitation link and join only after they sign in, or create an account, with that same email address. Members can edit shared records; viewers have read-only access.${household?' Private records stay with their creator.':''}</p><div class="list-rows">${members.map(row).join('')}</div><form style="margin-top:20px" novalidate><div class="form-grid"><label class="field full">Email address<input name="email" type="email" inputmode="email" required maxlength="254" autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="name@example.com"></label>${selectField('Role','role',[['member','Member · can edit'],['viewer','Viewer · read only']],'member','full')}</div>${formFooter('Send invitation')}</form>`,{onSubmit:async e=>{
    e.preventDefault();
    const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),error=form.querySelector('.form-error');
    data.email=(data.email||'').trim();
    if(!data.email){error.textContent="Enter the email address of the person you're inviting.";return;}
    if(!validContactEmail(data.email)){error.textContent='Enter a valid email address.';return;}
    await submitForm(form,async()=>{
      try{
        const result=await api(endpoint('members'),'POST',data);
        await manageMembers(result.role_updated?`Role updated to ${result.role}.`:`Invitation sent to ${result.invite.email}. They get access after they accept.`);
      }catch(err){
        // Saved but not delivered: reopen with the invitation listed so the owner can Resend.
        if(/Use Resend/.test(err.message)){await manageMembers(err.message,'error');return;}
        throw err;
      }
    },'Sending…');
  }});
}
async function resendInvite(id,button){
  if(button){button.disabled=true;button.innerHTML='<span class="spinner" aria-hidden="true"></span>Sending…';}
  try{const r=await api(endpoint('members')+'/'+id,'POST',{});await manageMembers(`Invitation sent again to ${r.invite.email}. Earlier links no longer work.`);}
  catch(err){await manageMembers(err.message,'error');}
}

document.addEventListener('click',async e=>{
  if(!e.target.closest('.profile-menu'))closeProfileMenu();
  // Phones: tapping outside the open sidebar closes it.
  const openSidebar=document.querySelector('.sidebar.open');
  if(openSidebar&&!e.target.closest('.sidebar')&&!e.target.closest('[data-action="menu"]')){openSidebar.classList.remove('open');document.querySelector('.mobile-menu')?.setAttribute('aria-expanded','false');}
  const target=e.target.closest('[data-action],[data-page]');
  if(!target)return;
  try{
    if(target.dataset.page){closeModal();state.page=target.dataset.page;state.answer=null;if(Object.keys(state.filters).length){state.filters={};await load();}else render();window.scrollTo(0,0);return;}
    const action=target.dataset.action,id=target.dataset.id;
    if(await handleDashboardAction(action,target))return;
    switch(action){
      case 'auth-toggle':renderAuth(target.dataset.mode);break;
      case 'forgot-password':renderForgotPassword();break;
      case 'logout':closeProfileMenu();await logout();break;
      case 'profile-menu':{const panel=target.parentElement.querySelector('.profile-panel');const open=panel.hidden;closeProfileMenu();panel.hidden=!open;target.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('button')?.focus();break;}
      case 'switch-view':closeModal();await switchView(target.dataset.view);break;
      case 'refresh-household':{target.disabled=true;try{await bootstrap();if(!state.workspace)toast('No household yet. Ask the owner to add @'+state.user.username+'.');}finally{if(target.isConnected)target.disabled=false;}break;}
      case 'resend-invite':resendInvite(id,target);break;
      case 'remove-member':confirmDialog(target.dataset.invite?'Cancel this invitation?':target.dataset.pending?'Remove saved contact?':'Remove this member?',target.dataset.invite?`The invitation to ${target.dataset.name} will stop working.`:target.dataset.pending?`The saved contact details for ${target.dataset.name} will be deleted.`:`@${target.dataset.name} will lose access to this workspace. Records they created stay in the workspace.`,()=>api(endpoint('members')+'/'+id,'DELETE'),'Remove member');break;
      case 'theme':setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');break;
      case 'menu':{const open=document.getElementById('sidebar').classList.toggle('open');target.setAttribute('aria-expanded',String(open));break;}
      case 'add-transaction':transactionForm();break;case 'edit-transaction':transactionForm(id);break;
      case 'add-budget':budgetForm();break;case 'edit-budget':budgetForm(id);break;
      case 'add-subscription':subscriptionForm();break;case 'edit-subscription':subscriptionForm(id);break;
      case 'add-goal':goalForm();break;case 'edit-goal':goalForm(id);break;
      case 'add-category':categoryForm();break;case 'edit-category':categoryForm(id);break;
      case 'add-workspace':renderOnboarding(state.view,true);break;
      case 'workspace-kind':{const form=document.getElementById('onboarding-form'),before=Object.fromEntries(new FormData(form)),previous=form.dataset.kind;renderOnboarding(target.dataset.kind,form.dataset.modal==='true');const next=document.getElementById('onboarding-form');for(const [key,value] of Object.entries(before)){const input=next.elements[key];if(input&&!(key==='name'&&value===defaultWorkspaceName(previous)))input.value=value;}break;}
      case 'switch-workspace':openModal('Switch workspace',`<div class="list-rows workspace-list">${state.workspaces.map(ws=>`<button type="button" class="list-row workspace-option ${ws.id===state.workspace?.id?'current':''}" data-action="pick-workspace" data-id="${ws.id}" ${ws.id===state.workspace?.id?'aria-current="true"':''}><span class="workspace-icon">${icon(wsIcon(ws.kind))}</span><strong>${esc(ws.name)}</strong>${ws.id===state.workspace?.id?icon('check'):''}</button>`).join('')}</div>`);break;
      case 'pick-workspace':closeModal();Object.assign(state,{filters:{},answer:null,overview:null,page:'overview',periodMode:'calendar'});await bootstrap(id);break;
      case 'close-modal':closeModal();break;
      case 'delete':confirmDialog('Delete this record?',`“${target.dataset.name}” will be permanently removed from this workspace.`,()=>api(endpoint(target.dataset.resource)+'/'+id,'DELETE'),'Delete record');break;
      case 'reset':confirmDialog('Reset this demo workspace?','Transactions, budgets, subscriptions and goals in this demo workspace will be replaced with the synthetic baseline. Other workspaces are not affected.',()=>api(endpoint('reset'),'POST',{}),'Reset demo');break;
      case 'export':{const a=document.createElement('a');a.href=endpoint('export')+'?'+query();a.download='trikosh-transactions.csv';a.click();toast('Exporting the current month and filters to CSV.');break;}
      case 'clear-filters':state.filters={};await load();break;
      case 'trend-mode':{const cfg=TRENDS[target.dataset.chart||'spend'];if(target.dataset.mode!==(state[cfg.mode]||'month')){state[cfg.mode]=target.dataset.mode;await refreshTrend(target.dataset.chart||'spend');}break;}
      case 'trend-week':{const key=target.dataset.chart||'spend',cfg=TRENDS[key];const next=addDays(state[cfg.week]||defaultWeekStart(),7*Number(target.dataset.step));if(next>localDate())break;state[cfg.week]=next;await refreshTrend(key);break;}
      case 'submit-approval':{target.disabled=true;try{await api(endpoint('approval-submissions'),'POST',{transaction_id:id});await load();toast('Submitted for approval. It is not counted in spending until the owner approves it.');}finally{if(target.isConnected)target.disabled=false;}break;}
      case 'drill-category':closeModal();state.filters={...state.filters,kind:'expense'};if(target.dataset.category)state.filters.category=target.dataset.category;else delete state.filters.category;state.page='transactions';await load();window.scrollTo(0,0);break;
      case 'evidence':{const i=state.insights[Number(target.dataset.index)];if(!i){toast('This insight has changed. Showing the latest insights.');await load();break;}showEvidence(i.evidence,i.basis,i.category);break;}
      case 'answer-evidence':showEvidence(state.answer.evidence);break;
      case 'explain':state.page='insights';state.answer=null;render();await ask('Explain my spending this month');break;
      case 'ask-suggestion':await ask(target.dataset.question);break;
      case 'search':await searchDialog();break;
      case 'search-select':state.month=target.dataset.month;state.filters={q:target.dataset.merchant};state.page='transactions';closeModal();await load();break;
      case 'close-and-add':closeModal();transactionForm();break;
      case 'close-and-ask':closeModal();state.page='insights';render();break;
      case 'renewals':openModal('Upcoming subscription renewals',`<p class="modal-desc">Scheduled commitments from active subscriptions. These are not posted expenses.</p>${renewalsPanel()}`);break;
      case 'members':await manageMembers();break;
      case 'audit':{const entries=await api(endpoint('audit'));openModal('Workspace audit trail',entries.length?`<div class="list-rows">${entries.map(a=>`<div class="list-row"><div><strong>${esc(a.action)}</strong><small>Record ${esc(a.record_id)}</small></div><span class="small muted row-end">${new Date(a.timestamp).toLocaleString()}</span></div>`).join('')}</div>`:empty('No activity yet','Future changes will be recorded here.'),{wide:true});break;}
    }
  }catch(error){toast(error.message);}
});
document.addEventListener('change',async e=>{
  try{
    if(e.target.id==='period'&&e.target.value){state.month=e.target.value;state.weekStart=null;state.revenueWeekStart=null;state.answer=null;await load();}
  }catch(error){toast(error.message);}
});
document.addEventListener('submit',async e=>{
  if(!['filters-form','ask-form','workspace-settings'].includes(e.target.id))return;
  e.preventDefault();
  try{
    if(e.target.id==='filters-form'){state.filters=Object.fromEntries([...new FormData(e.target)].filter(([,v])=>v));await load();}
    if(e.target.id==='ask-form')await ask(new FormData(e.target).get('question'));
    if(e.target.id==='workspace-settings'){await submitForm(e.target,async()=>{await api(endpoint('settings'),'PUT',{...state.workspace.settings,...Object.fromEntries(new FormData(e.target))});await bootstrap();toast('Workspace settings saved.');});}
  }catch(error){toast(error.message);}
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&state.workspace){e.preventDefault();searchDialog();}
  if(e.key==='Escape'){const menuOpen=document.querySelector('.profile-panel:not([hidden])');closeProfileMenu();if(menuOpen){document.querySelector('.profile-trigger')?.focus();return;}closeModal();document.getElementById('sidebar')?.classList.remove('open');}
  if(e.key==='Tab'&&modalRoot.children.length){const focusable=[...modalRoot.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled);const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
// A page restored from the back/forward cache may show data from before logout. Re-check the session.
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
const resetToken=location.pathname==='/reset'?new URLSearchParams(location.search).get('token'):null;
if(resetToken)renderResetPassword(resetToken);
else loadInvite().then(inviteError=>bootstrap().then(()=>{if(inviteError)toast(inviteError);},error=>{if(!state.user)renderAuth('login',inviteError);else app.innerHTML=`<div class="page-error">${esc(error.message)} Reload the page to try again.</div>`;}));
