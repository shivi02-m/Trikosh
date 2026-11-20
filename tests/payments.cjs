// Browser check: bill payments, subscriptions from Overview, sync between views, refresh persistence.
// Run: node tests/payments.cjs
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
const db = path.join(output, `payments-${Date.now()}.db`);
const base = 'http://127.0.0.1:8014';
let logs = '';
const server = spawn(python, ['server.py', '--port', '8014'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', d => { logs += d; });
server.stderr.on('data', d => { logs += d; });

(async () => {
  let browser;
  const errors = [];
  try {
    for (let i = 0; i < 80 && !(await fetch(base + '/api/health').then(r => r.ok, () => false)); i++) await new Promise(r => setTimeout(r, 100));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/40[134]/.test(m.text())) errors.push(m.text()); });
    const modal = () => page.locator('[role="dialog"]');
    const state = (expr, arg) => page.evaluate(expr, arg);
    const linked = prefix => state(p => api(endpoint('transactions')).then(rows => rows.filter(r => r.source_ref.startsWith(p)).length), prefix);

    await page.goto(base);
    await page.evaluate(() => openDemo());
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    const personalId = await page.locator('#main-content').getAttribute('data-workspace-id');
    await state(async () => { const w = state.workspace; await api(endpoint('settings'), 'PUT', { name: w.name, ...w.settings, tracking_start: localDate(), tracking_balance: 50000 }); await bootstrap(); });
    assert.equal(await state(() => state.dashboard.cash_tracker.configured), true);
    const spendBefore = await state(() => state.overview.spend);
    const balanceBefore = await state(() => state.dashboard.cash_tracker.available);
    const recentBefore = await state(() => state.overview.count);

    // 1-2. Mark a bill paid with a rapid double click: exactly one expense, everything updates.
    const bill = await state(() => state.dashboard.upcoming.find(r => r.source === 'bill'));
    const payBill = page.locator(`.feature-row [data-action="pay-bill"][data-id="${bill.id}"]`);
    await payBill.dblclick();
    await page.waitForFunction(id => !state.dashboard.upcoming.some(r => r.id === id), bill.id);
    assert.equal(await linked('bill:' + bill.id), 1);
    // Paid today, so it lands in the current month regardless of the bill's due date.
    assert.equal(await state(() => state.overview.spend), spendBefore + bill.amount);
    assert.equal(await state(() => state.overview.count), recentBefore + 1);
    assert.equal(await state(() => state.dashboard.cash_tracker.available), balanceBefore - bill.amount);
    assert.ok(await page.locator('.personal-money').getByText(bill.name, { exact: true }).count() > 0, 'recent transactions shows the bill');
    await page.locator('.sidebar .nav-item[data-page="analytics"]').click();
    assert.equal(await state(() => state.overview.spend), spendBefore + bill.amount);
    await page.reload();
    await page.locator('#main-content').waitFor();
    assert.equal(await linked('bill:' + bill.id), 1);
    assert.equal(await state(() => state.overview.spend), spendBefore + bill.amount);

    // 3. Add a subscription from Overview (Upcoming > Manage) and see it on the Subscriptions page.
    await page.locator('.sidebar .nav-item[data-page="overview"]').click();
    await page.locator('[data-action="manage-bills"]').first().click();
    await modal().locator('[data-action="add-subscription"]').click();
    await modal().locator('[name="name"]').fill('Overview Cloud Storage');
    await modal().locator('[name="amount"]').fill('199');
    await modal().locator('[type="submit"]').click();
    await page.waitForFunction(() => state.subscriptions.some(s => s.name === 'Overview Cloud Storage') && state.dashboard.upcoming.some(r => r.name === 'Overview Cloud Storage'));
    const sub = await state(() => state.subscriptions.find(s => s.name === 'Overview Cloud Storage'));
    assert.ok(sub, 'saved to subscriptions table');
    assert.ok(await state(id => state.dashboard.upcoming.some(r => r.id === id), sub.id), 'shown in upcoming');
    // 4. Creating it recorded no expense.
    assert.equal(await linked('subscription:' + sub.id), 0);
    await page.locator('.sidebar .nav-item[data-page="subscriptions"]').click();
    await page.getByRole('heading', { name: 'Overview Cloud Storage' }).waitFor();
    // Edit from the Subscriptions page; Overview reflects it.
    await page.locator(`[data-action="edit-subscription"][data-id="${sub.id}"]`).click();
    await modal().locator('[name="amount"]').fill('249');
    await modal().locator('[type="submit"]').click();
    await page.waitForFunction(id => state.dashboard.upcoming.find(r => r.id === id).amount === 24900, sub.id);
    assert.equal(await state(id => state.dashboard.upcoming.find(r => r.id === id).amount, sub.id), 24900);
    // Edit from Overview; Subscriptions page reflects it.
    await page.locator('.sidebar .nav-item[data-page="overview"]').click();
    await page.locator(`.feature-row [data-action="edit-subscription"][data-id="${sub.id}"]`).click();
    await modal().locator('[name="amount"]').fill('299');
    await modal().locator('[type="submit"]').click();
    await page.waitForFunction(id => state.subscriptions.find(s => s.id === id).amount === 29900, sub.id);
    assert.equal(await state(id => state.subscriptions.find(s => s.id === id).amount, sub.id), 29900);

    // 4. Record the renewal payment twice quickly: one expense; renewal advances; next renewal still payable.
    const pay = page.locator(`.feature-row [data-action="pay-subscription"][data-id="${sub.id}"]`);
    await pay.dblclick();
    await page.waitForFunction(([id, r]) => state.subscriptions.find(s => s.id === id).renewal > r, [sub.id, sub.renewal]);
    assert.equal(await linked('subscription:' + sub.id), 1);
    await page.locator('.sidebar .nav-item[data-page="subscriptions"]').click();
    await page.locator(`.record-card [data-action="pay-subscription"][data-id="${sub.id}"]`).click();
    await page.waitForFunction(async ([id]) => (await api(endpoint('transactions'))).filter(r => r.source_ref.startsWith('subscription:' + id)).length === 2, [sub.id]);
    await page.reload();
    await page.locator('#main-content').waitFor();
    assert.equal(await linked('subscription:' + sub.id), 2);
    await page.screenshot({ path: path.join(output, 'payments-overview.png'), fullPage: true });

    // Isolation: the Household workspace saw none of this.
    await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    assert.equal(await state(() => state.subscriptions.some(s => s.name === 'Overview Cloud Storage')), false);
    assert.equal(await linked('bill:' + bill.id), 0);
    const crossStatus = await page.evaluate(id => fetch(endpoint('subscription-payments'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf }, body: JSON.stringify({ subscription_id: id }) }).then(r => r.status), sub.id);
    assert.equal(crossStatus, 404, 'cannot pay a Personal subscription through the Household workspace');
    assert.equal(await state(pid => state.workspaces.some(w => w.id === pid), personalId), true);

    assert.deepEqual(errors, []);
    console.log('PASS: bill paid once (double click), spend/recent/balance/analytics updated, refresh persistence, subscription added from Overview appears on Subscriptions page, edits sync both ways, no expense on creation, one expense per renewal occurrence, next renewal payable, workspace isolation.');
  } catch (error) {
    console.error(error);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
