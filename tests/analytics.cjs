// Browser check: Month/Week spending comparison, Household member spending + Net income, insight navigation.
// Run: node tests/analytics.cjs
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
const db = path.join(output, `analytics-${Date.now()}.db`);
const base = 'http://127.0.0.1:8018';
let logs = '';
const server = spawn(python, ['server.py', '--port', '8018'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', d => { logs += d; });
server.stderr.on('data', d => { logs += d; });

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

(async () => {
  let browser;
  const errors = [];
  try {
    for (let i = 0; i < 80 && !(await fetch(base + '/api/health').then(r => r.ok, () => false)); i++) await new Promise(r => setTimeout(r, 100));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text()); });
    const nav = name => page.locator(`.sidebar .nav-item[data-page="${name}"]`).click();
    const trend = () => page.evaluate(() => state.trend);
    const stamp = Date.now();

    await page.goto(base + '/login');
    await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
    await page.locator('#auth-form [name="name"]').fill('Chart Tester');
    await page.locator('#auth-form [name="username"]').fill('chart' + stamp);
    await page.locator('#auth-form [name="email"]').fill(`chart-${stamp}@example.com`);
    await page.locator('#auth-form [name="password"]').fill('a long password');
    await page.locator('#auth-form [type="submit"]').click();
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();

    // Expenses today, earlier this week, last week (inside and outside the elapsed window) and last month.
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const weekday = (today.getDay() + 6) % 7;              // 0 = Monday
    const monday = shift(today, -weekday);
    const prevMonthSameDay = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate()), 12);
    const prevMonthLast = new Date(today.getFullYear(), today.getMonth(), 0, 12);
    const records = [
      [iso(today), '100'], [iso(shift(today, -7)), '40'], [iso(shift(monday, -1)), '7'],
      [iso(prevMonthSameDay), '60'], [iso(prevMonthLast), '25'], [iso(shift(monday, -14)), '3'],
    ];
    await page.evaluate(async rows => { for (const [date, amount] of rows) await api(endpoint('transactions'), 'POST', { date, amount, kind: 'expense', merchant: 'Chart ' + date, category: 'Groceries' }); await load(); }, records);
    const sumRange = (from, to) => records.filter(([d]) => d >= from && d <= to).reduce((t, [, a]) => t + Number(a) * 100, 0);

    // Month mode (default): month to date vs the same elapsed days of last month.
    let t = await trend();
    assert.equal(t.mode, 'month');
    const monthStart = iso(new Date(today.getFullYear(), today.getMonth(), 1, 12));
    const prevMonthStart = iso(new Date(today.getFullYear(), today.getMonth() - 1, 1, 12));
    assert.equal(t.curTotal, sumRange(monthStart, iso(today)));
    assert.equal(t.prevTotal, sumRange(prevMonthStart, iso(prevMonthSameDay)), 'previous month counted only up to the same elapsed day');
    let panel = page.locator('.trend-panel').first();
    let text = await panel.innerText();
    assert.match(text, /so far/);
    assert.match(text, /Compared over the same \d+ elapsed day/);
    assert.match(text, /Previous:/);
    assert.equal(await panel.locator('.previous-line').count(), 1);
    await page.screenshot({ path: path.join(output, 'trend-month.png') });

    // Week mode: this week so far vs the same elapsed days of last week.
    await panel.locator('[data-action="trend-mode"][data-mode="week"]').click();
    await page.waitForFunction(() => state.trend.mode === 'week');
    t = await trend();
    assert.equal(t.curDays[0], iso(monday));
    assert.equal(t.curTotal, sumRange(iso(monday), iso(today)));
    assert.equal(t.prevTotal, sumRange(iso(shift(monday, -7)), iso(shift(today, -7))));
    panel = page.locator('.trend-panel').first();
    text = await panel.innerText();
    assert.match(text, /Week of .* so far/);
    assert.ok(await panel.locator('[data-action="trend-week"][data-step="1"]').isDisabled(), 'cannot move into the future');
    await page.screenshot({ path: path.join(output, 'trend-week.png') });

    // Previous (complete) week compared whole-to-whole.
    await panel.locator('[data-action="trend-week"][data-step="-1"]').click();
    await page.waitForFunction(m => state.trend.curDays[0] === m, iso(shift(monday, -7)));
    t = await trend();
    assert.equal(t.status, 'complete');
    assert.equal(t.curTotal, sumRange(iso(shift(monday, -7)), iso(shift(monday, -1))));
    assert.equal(t.prevTotal, sumRange(iso(shift(monday, -14)), iso(shift(monday, -8))));
    assert.doesNotMatch(await page.locator('.trend-panel').first().innerText(), /so far/);

    // Empty data: a week long ago.
    for (let i = 0; i < 6; i++) { await page.locator('.trend-panel [data-action="trend-week"][data-step="-1"]').first().click(); await page.waitForFunction(n => state.trend.curDays[0] === n, iso(shift(monday, -7 * (i + 2)))); }
    assert.match(await page.locator('.trend-panel').first().innerText(), /No spending in either period/);

    // Switching back to Month restores the month comparison; week choice survives navigation.
    await page.locator('.trend-panel [data-action="trend-mode"][data-mode="month"]').first().click();
    await page.waitForFunction(() => state.trend.mode === 'month');
    await nav('analytics');
    assert.equal(await page.evaluate(() => state.trend.mode), 'month');
    assert.equal(await page.getByRole('heading', { name: /Spending ownership|Member spending/ }).count(), 0, 'Personal has no ownership chart');
    assert.ok((await page.locator('.stats-grid').first().innerText()).includes('Net cash flow'), 'Personal keeps its label');

    // 4. Insights: supporting records modal opens Transactions; sidebar link opens the insights page.
    await nav('overview');
    const card = page.locator('.insight-card').first();
    await card.waitFor();
    await card.locator('[data-action="evidence"]').click();
    const dialog = page.locator('[role="dialog"]');
    assert.ok(await dialog.locator('tbody tr').count() > 0);
    await dialog.locator('[data-action="drill-category"]').click();
    await dialog.waitFor({ state: 'detached' });
    await page.getByRole('heading', { name: 'Transaction ledger' }).waitFor();
    assert.equal(await page.evaluate(() => state.filters.category), 'Groceries');
    await page.locator('.side-promo [data-page="insights"]').click();
    await page.locator('.ai-hero').waitFor();
    assert.match(await page.locator('.ai-hero').innerText(), /No external AI model connected/);

    // 2 + 3. Household: Net income + member spending with zero-spend members.
    await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    await nav('analytics');
    const stats = await page.locator('.stats-grid').first().innerText();
    assert.ok(stats.includes('Net income') && stats.includes('Income minus expenses') && !stats.includes('Net cash flow'));
    const members = page.locator('.member-spending');
    await members.waitFor();
    assert.match(await members.innerText(), /Chart Tester \(you\)[\s\S]*₹0/);
    assert.match(await members.innerText(), /Includes every current member/);
    await page.screenshot({ path: path.join(output, 'household-analytics.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile overflow');
    assert.deepEqual(errors, []);
    console.log('PASS: Month/Week toggle with labelled periods, elapsed-portion comparison, complete-week comparison, empty data, no future weeks; Household Net income + member spending incl. zero-spend member; insight records modal opens Transactions; Explore insights opens the rule-based insights page.');
  } catch (error) {
    console.error(error);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
