const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const python = process.env.PYTHON_BIN || (process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313', 'python.exe') : 'python3');
const executablePath = process.env.BROWSER_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined);
const db = path.join(output, `browser-${Date.now()}.db`);
const server = spawn(python, ['server.py', '--port', '8011'], {
  cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe']
});
let serverLogs = '';
server.stdout.on('data', data => { serverLogs += data; });
server.stderr.on('data', data => { serverLogs += data; });
const base = 'http://127.0.0.1:8011';

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Python server exited: ' + serverLogs);
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start: ' + serverLogs);
}

(async () => {
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('401')) errors.push(message.text()); });
    const visible = async selector => page.locator(selector).first().waitFor({ state: 'visible' });
    const nav = async name => { await page.locator(`.sidebar .nav-item[data-page="${name}"]`).click(); };
    const modal = () => page.locator('[role="dialog"]');
    const noModal = () => page.locator('[role="dialog"]').waitFor({ state: 'detached' });
    await page.goto(base);
    await visible('#auth-form');
    await page.screenshot({ path: path.join(output, 'sign-in-desktop.png'), fullPage: true });
    await page.evaluate(() => openDemo());
    await visible('.dashboard-columns');
    assert.equal(await page.locator('#workspace-name').innerText(), 'Personal');
    await page.evaluate(async()=>{for(const w of state.workspaces.filter(w=>w.kind!=='Business'))await api('/api/workspaces/'+w.id+'/settings','PUT',{name:w.name,...w.settings,tracking_start:localDate(),tracking_balance:0});await bootstrap();});
    await page.screenshot({ path: path.join(output, 'dashboard-desktop.png'), fullPage: true });

    assert.equal(await page.locator('.simple-more').count(),0,'Personal hides People & shared plans');
    await page.getByRole('button',{name:'Record salary',exact:true}).click();
    assert.equal(await modal().locator('input').count(),2);
    await modal().locator('[name="amount"]').fill('50000');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.reload();
    await visible('.mode-stats');

    // Real backend transaction creation and persisted edit.
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    await modal().locator('[name="merchant"]').fill('Browser test grocery');
    await modal().locator('[name="amount"]').fill('123.45');
    await modal().locator('[name="category"]').selectOption('Groceries');

    await modal().locator('[type="submit"]').click();
    await noModal();
    await nav('transactions');
    await page.locator('#filters-form [name="q"]').fill('Browser test grocery');
    await page.locator('#filters-form [type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    assert.match(await page.locator('tbody').innerText(), /123\.45/);
    await page.locator('[data-action="edit-transaction"]').click();
    await modal().locator('[name="amount"]').fill('234.56');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.waitForFunction(() => document.querySelector('tbody')?.textContent.includes('234.56'));
    await page.reload();
    await visible('.dashboard-columns');
    await nav('transactions');
    await page.locator('#filters-form [name="q"]').fill('Browser test grocery');
    await page.locator('#filters-form [type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    assert.match(await page.locator('tbody').innerText(), /234\.56/);
    const download = page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    const csv = await download;
    await csv.saveAs(path.join(output, 'filtered-export.csv'));
    const csvText = fs.readFileSync(path.join(output, 'filtered-export.csv'), 'utf8');
    assert.match(csvText, /Browser test grocery/);
    assert.match(csvText, /234.56/);
    assert.equal(csvText.trim().split(/\r?\n/).length, 2);

    // Budget, subscription and goal workflows.
    await nav('budgets');
    await page.locator('.heading-actions [data-action="add-budget"]').click();
    await modal().locator('[name="category"]').selectOption('Health');
    await modal().locator('[name="amount"]').fill('5000');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.getByRole('heading', { name: 'Health', exact: true }).waitFor();
    await nav('subscriptions');
    await page.locator('.heading-actions [data-action="add-subscription"]').click();
    await modal().locator('[name="name"]').fill('Browser test music');
    await modal().locator('[name="amount"]').fill('99');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.getByRole('heading', { name: 'Browser test music', exact: true }).waitFor();
    await nav('goals');
    await page.locator('.heading-actions [data-action="add-goal"]').click();
    await modal().locator('[name="name"]').fill('Browser test goal');
    await modal().locator('[name="target"]').fill('10000');
    await modal().locator('[name="saved"]').fill('2500');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.getByRole('heading', { name: 'Browser test goal', exact: true }).waitFor();

    await nav('insights');
    await page.locator('[data-question="How is my budget?"]').click();
    await visible('.answer-box');
    assert.match(await page.locator('.answer-box').innerText(), /budget/i);
    await page.locator('[data-action="answer-evidence"]').click();
    assert.ok(await modal().locator('tbody tr').count() > 0);
    await page.keyboard.press('Escape');
    await nav('analytics');
    await page.screenshot({ path: path.join(output, 'analytics-desktop.png'), fullPage: true });
    await nav('settings');
    await page.locator('#workspace-settings [name="name"]').fill('Verified demo workspace');
    await page.locator('#workspace-settings [type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#workspace-name')?.textContent==='Verified demo workspace');

    // Workspace types are selected at sign-in, never switched inside a session.
    const signInDemo = async kind => {
      await page.evaluate(async () => { await logout(); });
      await page.goto(base);
      await page.locator('[name="account_type"]').selectOption(kind==='Business'?'business':'personal_household');
      await page.evaluate(() => openDemo());
      if(kind==='Household'){await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();}
      await page.locator('#main-content[data-workspace-kind="'+kind+'"]').waitFor();
      assert.equal(await page.locator('#workspace-name').innerText(),kind);
      assert.equal(await page.locator('.mode-card').count(),0);
      await page.reload();
      await page.locator('#main-content[data-workspace-kind="'+kind+'"]').waitFor();
      if(kind!=='Business')await page.evaluate(async()=>{
        const w=state.workspace;
        await api('/api/workspaces/'+w.id+'/settings','PUT',{name:w.name,...w.settings,tracking_start:localDate(),tracking_balance:0});
        await bootstrap();
      });
    };
    await nav('overview');
    await visible('.dashboard-columns');
    // Workspace-specific UX, editable planning records and server-backed decisions.
    assert.equal(await page.locator('.mode-switcher .mode-card').count(), 0);
    await page.locator('[data-action="manage-bills"]').click();
    await modal().locator('[data-action="add-plan"]').click();
    await modal().locator('[name="name"]').fill('Browser planned bill');
    await modal().locator('[name="amount"]').fill('250');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.getByText('Browser planned bill', {exact:true}).waitFor();

    await signInDemo('Household');
    await page.locator('.simple-more > summary').click();
    await page.getByRole('heading', { name:'Member contributions', exact:true }).waitFor();
    await page.getByRole('heading', { name:'Children & dependent costs', exact:true }).waitFor();
    await page.getByRole('heading', { name:'Events & festivals', exact:true }).waitFor();
    await page.locator('[data-action="manage-contributions"]').click();
    await modal().locator('[data-action="add-plan"]').click();
    await modal().locator('[name="name"]').fill('Browser household funding');
    await modal().locator('[name="amount"]').fill('500');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.getByText(/Browser household funding/).waitFor();
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    await modal().locator('[data-action="advanced-entry"]').click();
    assert.equal(await modal().locator('[name="visibility"] option').count(),3);
    assert.ok(await modal().locator('[name="event_id"] option').count()>1);
    await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(output,'household-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Household mobile overflow');
    await page.screenshot({path:path.join(output,'household-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1050});

    await signInDemo('Business');
    await page.getByRole('heading',{name:'Department budgets',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Policy flags',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Project & client cost allocation',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Business expense tracking',exact:true}).waitFor();
    await page.locator('[data-action="business-categories"]').first().click();
    await modal().locator('[data-category="Insurance"]').click();
    await modal().locator('[name="merchant"]').fill('Browser business insurance');
    await modal().locator('[name="amount"]').fill('118');
    await modal().locator('[name="biz_tax_amount"]').fill('18');
    await modal().locator('[name="biz_invoice_reference"]').fill('UI-INV-42');
    await modal().locator('[name="biz_business_purpose"]').fill('Annual business cover');
    await modal().locator('[name="biz_cost_center"]').fill('CC-OPS');
    await modal().locator('[name="biz_paid_by"]').selectOption('employee');
    await modal().locator('[name="biz_employee"]').fill('Alex');
    await modal().locator('[name="biz_reimbursement"]').selectOption('pending');
    await modal().locator('[name="biz_billable"]').check();
    await modal().locator('[name="biz_billable_client"]').fill('Acme');
    await page.screenshot({path:path.join(output,'business-expense-form.png'),fullPage:true});
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.waitForFunction(()=>document.querySelector('[data-action="business-reimbursements"] strong')?.textContent.includes('118'));
    await page.locator('[data-action="business-reimbursements"]').click();
    await page.getByRole('heading',{name:'Transaction ledger',exact:true}).waitFor();
    await page.getByText('Browser business insurance',{exact:true}).waitFor();
    assert.match(await page.locator('tbody').innerText(),/UI-INV-42/);
    const businessDownload=page.waitForEvent('download');
    await page.locator('[data-action="export"]').click();
    await (await businessDownload).saveAs(path.join(output,'business-export.csv'));
    const businessCsv=fs.readFileSync(path.join(output,'business-export.csv'),'utf8');
    assert.match(businessCsv,/tax_amount,net_amount/);
    assert.match(businessCsv,/18.00,100.00/);
    await page.locator('[data-action="edit-transaction"]').click();
    assert.equal(await modal().locator('[name="biz_invoice_reference"]').inputValue(),'UI-INV-42');
    assert.equal(await modal().locator('[name="biz_tax_amount"]').inputValue(),'18');
    await page.keyboard.press('Escape');
    await nav('overview');
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    await modal().locator('[name="merchant"]').fill('Browser equipment');
    await modal().locator('[name="amount"]').fill('500');
    await modal().locator('[name="category"]').selectOption('Equipment & hardware');
    await modal().locator('[name="biz_accounting_type"]').selectOption('capital');
    assert.equal(await modal().locator('[name="biz_reimbursement"]').isDisabled(),true);
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.waitForFunction(()=>document.querySelector('.business-buckets')?.textContent.includes('500'));
    const beforeApproval=await page.locator('[data-action="approval-decision"][data-status="approved"]').count();
    await page.locator('[data-action="approval-decision"][data-status="approved"]').first().click();
    await page.waitForFunction(n=>document.querySelectorAll('[data-action="approval-decision"][data-status="approved"]').length===n-1,beforeApproval);
    await page.locator('[data-action="toggle-pipeline"]').click();
    await page.locator('[data-action="manage-opportunities"]').waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,'business-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Business mobile overflow');
    await page.screenshot({path:path.join(output,'business-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1050});
    await signInDemo('Personal');
    await page.locator('.personal-money').waitFor();
    assert.equal(await page.locator('[data-action="business-categories"]').count(),0);
    await page.locator('.top-tools [data-action="theme"]').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.screenshot({ path: path.join(output, 'dashboard-dark.png'), fullPage: true });
    await page.locator('.top-tools [data-action="theme"]').click();

    // Responsive overflow, usable navigation and mobile transaction entry.
    for (const width of [768, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Horizontal overflow at ${width}px`);
      await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
    }
    await page.locator('.mobile-menu').click();
    await nav('transactions');
    await visible('.table-wrap');
    await page.screenshot({ path: path.join(output, 'transactions-mobile.png'), fullPage: true });
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) {
      console.log(await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth && !e.closest('.table-wrap')).map(e => ({tag:e.tagName, cls:e.className, right:e.getBoundingClientRect().right})).slice(0,20)})));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    await modal().locator('[name="merchant"]').fill('Mobile entry');
    await modal().locator('[name="amount"]').fill('45');
    await modal().locator('[type="submit"]').click();
    await noModal();
    await page.getByText('Mobile entry', { exact: true }).waitFor();

    // Sign-up/onboarding starts empty and survives sign-in again.
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const account = await fresh.newPage();
    account.on('pageerror', error => errors.push(error.message));
    await account.goto(base);
    await account.locator('[data-action="auth-toggle"]').click();
    const email = `browser-${Date.now()}@example.com`;
    await account.locator('#auth-form [name="name"]').fill('Browser Owner');
    await account.locator('#auth-form [name="username"]').fill('browser'+Date.now());
    await account.locator('#auth-form [name="email"]').fill(email);
    await account.locator('#auth-form [name="password"]').fill('a browser test password');
    await account.locator('#auth-form [type="submit"]').click();
    await account.locator('#onboarding-form').waitFor();
    await account.locator('#onboarding-form [name="name"]').fill('Real empty workspace');
    await account.locator('#onboarding-form [type="submit"]').click();
    await account.locator('.dashboard-columns').first().waitFor();
    assert.equal(await account.locator('.demo-banner').count(), 0);
    assert.match(await account.locator('.primary-column').first().innerText(), /Nothing here just yet/);
    await account.locator('.sidebar [data-action="logout"]').click();
    await account.locator('#auth-form [name="identifier"]').fill(email);
    await account.locator('#auth-form [name="password"]').fill('a browser test password');
    await account.locator('#auth-form [type="submit"]').click();
    await account.locator('.dashboard-columns').first().waitFor();
    assert.equal(await account.locator('#workspace-name').innerText(), 'Real empty workspace');
    assert.deepEqual(errors, [], 'Browser console/runtime errors');
    console.log('PASS: desktop/mobile demo, transaction create/edit/persistence/export, budgets, subscriptions, goals, insights/evidence, settings, isolated Personal, Household and Business sign-ins, running balance setup, bill creation, household contributions/privacy controls, business approval/pipeline, theme, empty-account signup/onboarding/login. No browser runtime errors.');
  } catch (error) {
    console.error(error);
    console.error(serverLogs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();

