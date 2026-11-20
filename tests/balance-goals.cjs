// Browser check: balance setup/edit, goal creation (dashboard + mobile Goals page), FD/RD goal types, refresh persistence.
// Run: node tests/balance-goals.cjs
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
const db = path.join(output, `balance-goals-${Date.now()}.db`);
const base = 'http://127.0.0.1:8016';
let logs = '';
const server = spawn(python, ['server.py', '--port', '8016'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    page.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text()); });
    const dialog = () => page.locator('[role="dialog"]');
    const closed = () => dialog().waitFor({ state: 'detached' });
    const stamp = Date.now();

    await page.goto(base + '/login');
    await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
    await page.locator('#auth-form [name="name"]').fill('Balance Tester');
    await page.locator('#auth-form [name="username"]').fill('balance' + stamp);
    await page.locator('#auth-form [name="email"]').fill(`balance-${stamp}@example.com`);
    await page.locator('#auth-form [name="password"]').fill('a long password');
    await page.locator('#auth-form [type="submit"]').click();
    await page.locator('#onboarding-form').waitFor();
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('.personal-money').waitFor();

    // 1. Set up my balance: opens, validates, saves (formatted amount), refreshes the balance.
    const balanceButton = page.locator('[data-action="personal-settings"]');
    assert.equal(await balanceButton.innerText(), 'Set up my balance');
    await balanceButton.click();
    await dialog().locator('[name="tracking_balance"]').fill('abc');
    await dialog().locator('[type="submit"]').click();
    assert.match(await dialog().locator('.form-error').innerText(), /must be a number/);
    await dialog().locator('[name="tracking_balance"]').fill('24,000');
    await dialog().locator('[type="submit"]').click();
    await closed();
    await page.waitForFunction(() => document.querySelector('.safe-number')?.textContent.includes('24,000.00'));

    // 2. Label becomes "Edit balance"; editing creates no income transaction.
    assert.equal(await balanceButton.innerText(), 'Edit balance');
    await balanceButton.click();
    assert.equal(await dialog().locator('#dialog-title').innerText(), 'Edit balance');
    assert.equal(await dialog().locator('[name="tracking_balance"]').inputValue(), '24000');
    await dialog().locator('[name="tracking_balance"]').fill('30,500.50');
    await dialog().locator('[type="submit"]').click();
    await closed();
    await page.waitForFunction(() => document.querySelector('.safe-number')?.textContent.includes('30,500.50'));
    assert.equal(await page.evaluate(() => api(endpoint('transactions')).then(r => r.length)), 0);
    assert.equal(await page.evaluate(() => state.overview.income), 0);

    // 3 + 4. Dashboard "Create goal" opens the form, validates, saves an FD goal with a formatted target.
    await page.locator('.secondary-column [data-action="add-goal"]').click();
    await dialog().locator('[name="name"]').fill('Bank FD');
    await dialog().locator('[type="submit"]').click();
    assert.match(await dialog().locator('.form-error').innerText(), /target amount/);
    await dialog().locator('[name="goal_type"]').selectOption('fd');
    await dialog().locator('[name="target"]').fill('1,00,000');
    await dialog().locator('[name="saved"]').fill('25,000');
    await dialog().locator('[type="submit"]').click();
    await closed();
    await page.waitForFunction(() => state.goals.some(g => g.name === 'Bank FD' && g.goal_type === 'fd' && g.target === 10000000 && g.saved === 2500000));
    assert.ok(await page.locator('.mini-goal').getByText('FD', { exact: true }).count() > 0);

    // Mobile: left-aligned "Create goal" on the Goals page heading creates an RD goal.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.mobile-menu').click();
    await page.locator('.sidebar .nav-item[data-page="goals"]').click();
    await page.locator('.heading-actions [data-action="add-goal"]').click();
    await dialog().locator('[name="name"]').fill('Monthly RD');
    await dialog().locator('[name="goal_type"]').selectOption('rd');
    await dialog().locator('[name="target"]').fill('60,000');
    await dialog().locator('[type="submit"]').click();
    await closed();
    await page.getByRole('heading', { name: 'Monthly RD' }).waitFor();
    await page.screenshot({ path: path.join(output, 'goals-fd-rd-mobile.png'), fullPage: true });

    // Edit a goal's type and saved amount.
    const fdId = await page.evaluate(() => state.goals.find(g => g.name === 'Bank FD').id);
    await page.locator(`[data-action="edit-goal"][data-id="${fdId}"]`).click();
    assert.equal(await dialog().locator('[name="goal_type"]').inputValue(), 'fd');
    await dialog().locator('[name="saved"]').fill('40000');
    await dialog().locator('[type="submit"]').click();
    await closed();

    // Persistence after refresh.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await page.locator('.personal-money').waitFor();
    assert.ok((await page.locator('.safe-number').innerText()).includes('30,500.50'));
    assert.equal(await balanceButton.innerText(), 'Edit balance');
    await page.locator('.sidebar .nav-item[data-page="goals"]').click();
    const cards = await page.locator('.record-card').allInnerTexts();
    assert.ok(cards.some(t => t.includes('Bank FD') && t.includes('Fixed Deposit (FD)') && t.includes('40,000')), 'FD persisted');
    assert.ok(cards.some(t => t.includes('Monthly RD') && t.includes('Recurring Deposit (RD)')), 'RD persisted');
    assert.equal(await page.evaluate(() => api(endpoint('transactions')).then(r => r.length)), 0);

    assert.deepEqual(errors, []);
    console.log('PASS: balance setup validates/saves/refreshes, "Edit balance" label, edit creates no income, Create goal (dashboard + mobile Goals page) saves, FD/RD types persist and edit, refresh persistence.');
  } catch (error) {
    console.error(error);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
