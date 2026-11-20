// Browser check: Business Transaction Pattern, Income/Revenue cards, Revenue chart, approvals, Vendor & SaaS.
// Run: node tests/business.cjs   (isolated test database)
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
const db = path.join(output, `business-${Date.now()}.db`);
const base = 'http://127.0.0.1:8022';
let logs = '';
const server = spawn(python, ['server.py', '--port', '8022'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', d => { logs += d; });
server.stderr.on('data', d => { logs += d; });

(async () => {
  let browser;
  const errors = [];
  try {
    for (let i = 0; i < 80 && !(await fetch(base + '/api/health').then(r => r.ok, () => false)); i++) await new Promise(r => setTimeout(r, 100));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/40[19]/.test(m.text())) errors.push(m.text()); });
    const dialog = () => page.locator('[role="dialog"]');
    const closed = () => dialog().waitFor({ state: 'detached' });
    const nav = name => page.locator(`.sidebar .nav-item[data-page="${name}"]`).click();
    const stamp = Date.now();
    await page.goto(base + '/login');
    await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
    await page.locator('.account-type-card input[value="business"]').check();
    await page.locator('#auth-form [name="name"]').fill('Owner');
    await page.locator('#auth-form [name="username"]').fill('owner' + stamp);
    await page.locator('#auth-form [name="email"]').fill(`owner-${stamp}@example.com`);
    await page.locator('#auth-form [name="password"]').fill('a long password');
    await page.locator('#auth-form [type="submit"]').click();
    await page.locator('#onboarding-form [name="industry"]').fill('Design');
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('#main-content[data-workspace-kind="Business"]').waitFor();

    // Empty data: revenue chart and Vendor/SaaS panel handle zero.
    await nav('analytics');
    const revenue = page.locator('.trend-panel[data-chart="revenue"]');
    await revenue.waitFor();
    assert.match(await revenue.innerText(), /Revenue[\s\S]*Daily revenue received[\s\S]*No revenue in either period/);

    // Set up: a vendor (UI), a subscription and income (API), then an expense through the form.
    await nav('overview');
    await page.locator('[data-action="manage-vendors"]').click();
    await dialog().locator('[data-action="add-plan"]').click();
    await dialog().locator('[name="name"]').fill('Acme Hosting');
    assert.equal(await dialog().locator('[name="amount"]').count(), 0, 'vendors have no amount');
    await dialog().locator('[type="submit"]').click();
    await closed();
    await page.evaluate(async () => {
      await api(endpoint('subscriptions'), 'POST', { name: 'Design tool', amount: '30', cadence: 'monthly', renewal: localDate(), category: 'Software' });
      await api(endpoint('transactions'), 'POST', { date: localDate(), amount: '5000', kind: 'income', merchant: 'Client receipt', category: 'Revenue', classification: 'recurring' });
      await load();
    });
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    const pattern = dialog().locator('[name="classification"]');
    assert.equal(await dialog().locator('label', { hasText: 'Transaction Pattern' }).count(), 1);
    assert.deepEqual(await pattern.locator('option').allInnerTexts(), ['One Time', 'Recurring', 'Event', 'Travel', 'Monthly', 'Purchase', 'Other']);
    assert.match(await dialog().locator('.approval-note').innerText(), /not automatic[\s\S]*not counted/);
    await dialog().locator('[name="amount"]').fill('70');
    await dialog().locator('[name="merchant"]').fill('Hosting invoice');
    await dialog().locator('[name="category"]').selectOption('Cloud hosting');
    await pattern.selectOption('monthly');
    await dialog().locator('[name="vendor_id"]').selectOption({ label: 'Acme Hosting' });
    await dialog().locator('[name="subscription_id"]').selectOption({ label: 'Design tool' });
    await dialog().locator('[name="submit_approval"]').check();
    await dialog().locator('[type="submit"]').click();
    await closed();
    await page.waitForFunction(() => state.overview.transactions.some(t => t.merchant === 'Hosting invoice' && t.approval_status === 'pending'));

    // Income/Revenue cards match each other and Analytics; pending expense not counted; queue shows it.
    const kpis = await page.locator('.mode-stats').first().innerText();
    assert.match(kpis, /Income\s*₹5,000[\s\S]*Revenue\s*₹5,000[\s\S]*Same records as Income/);
    let s = await page.evaluate(() => ({ spend: state.overview.spend, actual: state.dashboard.vendor_costs.actual, pending: state.dashboard.approvals.filter(a => a.status === 'pending').length }));
    assert.deepEqual(s, { spend: 0, actual: 0, pending: 1 });
    assert.match(await page.locator('section.panel', { hasText: 'Expense approval queue' }).innerText(), /Hosting invoice/);

    // Owner approves using the existing action: counted, no new transaction, no duplicate submit.
    const count = await page.evaluate(() => state.overview.count);
    await page.locator('section.panel', { hasText: 'Expense approval queue' }).locator('[data-action="approval-decision"][data-status="approved"]').click();
    await page.waitForFunction(() => state.overview.spend === 7000);
    s = await page.evaluate(() => ({ count: state.overview.count, actual: state.dashboard.vendor_costs.actual, linked: state.dashboard.vendor_costs.count, status: state.overview.transactions.find(t => t.merchant === 'Hosting invoice').approval_status }));
    assert.deepEqual(s, { count, actual: 7000, linked: 1, status: 'approved' });
    const vendorPanel = await page.locator('section.panel', { hasText: 'Vendor & SaaS costs' }).innerText();
    assert.match(vendorPanel, /Actual spend[\s\S]*₹70[\s\S]*Scheduled, not paid: ₹30/);
    await page.locator('[data-action="vendor-records"][data-link="linked"]').click();
    await dialog().locator('tbody tr').first().waitFor();
    assert.match(await dialog().innerText(), /1 record[\s\S]*total ₹70/);
    await page.keyboard.press('Escape');
    await nav('transactions');
    assert.equal(await page.locator('[data-action="submit-approval"]').count(), 0, 'approved expense cannot be resubmitted');
    assert.match(await page.locator('tbody').innerText(), /Approved/);

    // Revenue chart Month/Week with zero-value days.
    await nav('analytics');
    await revenue.locator('[data-action="trend-mode"][data-mode="week"]').click();
    await page.waitForFunction(() => state.revenueTrend.mode === 'week');
    const rt = await page.evaluate(() => state.revenueTrend);
    assert.equal(rt.curDays.length, 7);
    assert.equal(rt.cur.reduce((a, b) => a + b, 0), 500000);
    assert.ok(rt.cur.filter(v => v === 0).length >= 1, 'zero-value days present');
    assert.equal(await page.evaluate(() => state.trend.mode), 'month', 'charts have independent toggles');
    assert.match(await page.locator('.stats-grid').first().innerText(), /Recorded revenue\s*₹5,000/);
    await page.screenshot({ path: path.join(output, 'business-analytics-revenue.png'), fullPage: true });

    // Persistence after refresh.
    await page.reload();
    await page.locator('#main-content[data-workspace-kind="Business"]').waitFor();
    s = await page.evaluate(() => ({ income: state.overview.income, actual: state.dashboard.vendor_costs.actual, pattern: state.overview.transactions.find(t => t.merchant === 'Hosting invoice').classification }));
    assert.deepEqual(s, { income: 500000, actual: 7000, pattern: 'monthly' });

    assert.deepEqual(errors, []);
    console.log('PASS: Transaction Pattern label/order/save; Income & Revenue cards match Analytics; Revenue chart Month/Week with zero days and empty state; submit → pending (not counted) → owner approves (counted once, no new transaction, no resubmit); Vendor & SaaS actual vs scheduled and linked list total; refresh persistence.');
  } catch (error) {
    console.error(error);
    console.error(logs.slice(-2000));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
