// Real-browser verification of account types, workspace routing, isolation, logout and restart persistence.
// Run: node tests/auth-flows.cjs   (uses an isolated database under test-results/)
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
const db = path.join(output, `auth-flows-${Date.now()}.db`);
const port = 8012, base = `http://127.0.0.1:${port}`;
let server, logs = '';
const shot = name => path.join(output, `auth-${name}.png`);

function startServer() {
  server = spawn(python, ['server.py', '--port', String(port)], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', d => { logs += d; });
  server.stderr.on('data', d => { logs += d; });
  return waitForServer();
}
async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Server exited: ' + logs);
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not start: ' + logs);
}
async function stopServer() {
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill();
  await exited;
}

(async () => {
  let browser;
  const errors = [];
  const passed = [];
  try {
    await startServer();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const stamp = Date.now();
    const ph = { name: 'Priya Sharma', username: `priya${stamp}`, email: `priya-${stamp}@example.com`, password: 'household password 1' };
    const biz = { name: 'Arjun Mehta', username: `arjun${stamp}`, email: `arjun-${stamp}@example.com`, password: 'business password 1' };

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/40[134]/.test(m.text())) errors.push(m.text()); });
    const apiCall = (p, method = 'GET', body) => page.evaluate(([p, method, body]) => api(p, method, body).then(d => ({ ok: true, d }), e => ({ ok: false, e: e.message })), [p, method, body]);
    const rawStatus = p => page.evaluate(p => fetch(p, { credentials: 'same-origin' }).then(r => r.status), p);
    const signUp = async (user, type) => {
      await page.goto(base + '/login');
      await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
      await page.locator(`.account-type-card input[value="${type}"]`).check();
      await page.locator('#auth-form [name="name"]').fill(user.name);
      await page.locator('#auth-form [name="username"]').fill(user.username);
      await page.locator('#auth-form [name="email"]').fill(user.email);
      await page.locator('#auth-form [name="password"]').fill(user.password);
      await page.locator('#auth-form [type="submit"]').click();
    };
    const signIn = async (identifier, password, type) => {
      await page.locator('#auth-form [name="account_type"]').selectOption(type);
      await page.locator('#auth-form [name="identifier"]').fill(identifier);
      await page.locator('#auth-form [name="password"]').fill(password);
      await page.locator('#auth-form [type="submit"]').click();
    };
    const openProfile = async () => {
      await page.locator('.topbar .profile-trigger, .setup-header .profile-trigger').first().click();
      const panel = page.locator('.profile-panel:not([hidden])');
      await panel.waitFor();
      return panel;
    };
    const logoutViaMenu = async () => {
      const panel = await openProfile();
      await panel.locator('[data-action="logout"]').click();
      await page.locator('#auth-form [name="identifier"]').waitFor();
    };
    const merchants = async () => {
      await page.locator('.sidebar .nav-item[data-page="transactions"]').click();
      await page.locator('.panel .table-wrap, .panel .empty-state').first().waitFor();
      return page.locator('tbody .merchant-cell strong').allInnerTexts();
    };

    // 1. Personal / Household sign-up, validation and onboarding.
    await page.goto(base + '/login');
    await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
    await page.locator('#auth-form [name="username"]').fill('a b');
    await page.locator('#auth-form [type="submit"]').click();
    assert.match(await page.locator('#auth-form .form-error').innerText(), /name|Username/i);
    await page.screenshot({ path: shot('signup-validation'), fullPage: true });
    await signUp(ph, 'personal_household');
    await page.locator('#onboarding-form[data-kind="Personal"]').waitFor();
    await page.screenshot({ path: shot('personal-onboarding'), fullPage: true });
    await page.locator('#onboarding-form [name="name"]').fill('Priya personal');
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    let panel = await openProfile();
    const profileText = await panel.innerText();
    for (const expected of ['@' + ph.username, ph.email, 'Personal / Household', 'Priya personal', 'Log out']) assert.ok(profileText.includes(expected), 'profile shows ' + expected);
    await page.screenshot({ path: shot('profile-menu') });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.profile-panel:not([hidden])').count(), 0);
    const me1 = (await apiCall('/api/auth/me')).d;
    const personalId = me1.workspaces.find(w => w.kind === 'Personal').id;
    assert.ok((await apiCall(`/api/workspaces/${personalId}/transactions`, 'POST', { date: new Date().toISOString().slice(0, 10), amount: '120', kind: 'expense', merchant: 'Personal coffee', category: 'Dining' })).ok);
    await logoutViaMenu();
    await signIn(ph.username, ph.password, 'personal_household');
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    assert.equal(await page.locator('.view-switch [aria-pressed="true"]').innerText(), 'Personal');
    passed.push('1 Personal / Household sign-up and login (opens Personal by default)');

    // 4. Switch to Household: setup screen, create, switch back.
    await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
    await page.getByRole('heading', { name: 'Create a household' }).waitFor();
    await page.getByRole('heading', { name: 'Join a household' }).waitFor();
    assert.ok((await page.locator('.username-chip').innerText()).includes(ph.username));
    await page.screenshot({ path: shot('household-setup'), fullPage: true });
    await page.locator('#onboarding-form [name="name"]').fill('Sharma household');
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    const householdId = await page.locator('#main-content').getAttribute('data-workspace-id');
    assert.ok((await apiCall(`/api/workspaces/${householdId}/transactions`, 'POST', { date: new Date().toISOString().slice(0, 10), amount: '900', kind: 'expense', merchant: 'Household groceries', category: 'Groceries' })).ok);
    assert.ok((await apiCall(`/api/workspaces/${householdId}/goals`, 'POST', { name: 'Family trip', target: '5000', saved: '0', due: '2027-12-01' })).ok);
    await page.locator('.topbar [data-action="switch-view"][data-view="Personal"]').click();
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    await page.screenshot({ path: shot('household-dashboard') });
    passed.push('4 Switching between Personal and Household (setup screen when none exists)');

    // 5. Isolation between Personal and Household records, budgets and goals.
    assert.deepEqual(await merchants(), ['Household groceries']);
    await page.locator('.topbar [data-action="switch-view"][data-view="Personal"]').click();
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    assert.deepEqual(await merchants(), ['Personal coffee']);
    const personalGoals = (await apiCall(`/api/workspaces/${personalId}/goals`)).d.map(g => g.name);
    assert.ok(!personalGoals.includes('Family trip'));
    await logoutViaMenu();

    // 2. Business sign-up and login.
    await signUp(biz, 'business');
    await page.locator('#onboarding-form[data-kind="Business"]').waitFor();
    assert.equal(await page.locator('.view-switch').count(), 0);
    await page.locator('#onboarding-form [name="name"]').fill('Mehta Studio');
    await page.locator('#onboarding-form [name="industry"]').fill('Design');
    await page.locator('#onboarding-form [type="submit"]').click();
    await page.locator('#main-content[data-workspace-kind="Business"]').waitFor();
    const businessId = await page.locator('#main-content').getAttribute('data-workspace-id');
    assert.ok((await apiCall(`/api/workspaces/${businessId}/transactions`, 'POST', { date: new Date().toISOString().slice(0, 10), amount: '2000', kind: 'expense', merchant: 'Cloud invoice', category: 'Software' })).ok);
    panel = await openProfile();
    assert.ok((await panel.innerText()).includes('Business'));
    await page.keyboard.press('Escape');
    // 6. Unauthorized workspace requests from a signed-in Business session.
    for (const id of [personalId, householdId]) for (const resource of ['transactions', 'overview', 'budgets', 'goals', 'export', 'dashboard']) assert.equal(await rawStatus(`/api/workspaces/${id}/${resource}`), 404, `business -> ${resource}`);
    const blocked = await apiCall('/api/workspaces', 'POST', { name: 'Sneaky', kind: 'Household' });
    assert.equal(blocked.ok, false);
    await logoutViaMenu();
    await signIn(biz.email, biz.password, 'business');
    await page.locator('#main-content[data-workspace-kind="Business"]').waitFor();
    assert.deepEqual(await merchants(), ['Cloud invoice']);
    await logoutViaMenu();
    passed.push('2 Business sign-up and login');

    // 3. Incorrect account type at login: helpful error, no session.
    await signIn(biz.email, biz.password, 'personal_household');
    await page.locator('#auth-form .form-error:not(:empty)').waitFor();
    assert.match(await page.locator('#auth-form .form-error').innerText(), /registered as Business/);
    assert.equal(await rawStatus('/api/auth/me'), 401);
    await page.screenshot({ path: shot('wrong-account-type'), fullPage: true });
    await signIn(ph.email, ph.password, 'business');
    await page.locator('#auth-form .form-error:not(:empty)').waitFor();
    assert.match(await page.locator('#auth-form .form-error').innerText(), /registered as Personal \/ Household/);
    assert.equal(await rawStatus('/api/auth/me'), 401);
    passed.push('3 Incorrect account-type selection rejected with guidance, no session');

    // 6 (cont). Personal / Household session cannot read Business records.
    await signIn(ph.email, ph.password, 'personal_household');
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    for (const resource of ['transactions', 'overview', 'planning', 'export']) assert.equal(await rawStatus(`/api/workspaces/${businessId}/${resource}`), 404);
    assert.equal(await page.evaluate(() => state.workspaces.some(w => w.kind === 'Business')), false);
    passed.push('5 Isolation between Personal, Household and Business records');
    passed.push('6 Unauthorized workspace requests rejected by the server (404/403)');

    // 7. Logout, then back button, saved URL and direct API access.
    // Two history entries that both showed the signed-in dashboard (bfcache candidates).
    assert.equal(new URL(page.url()).pathname, '/');
    await page.goto(base + '/login');  // signed in: the app shows the dashboard and rewrites the URL to /
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    await page.locator('.sidebar .nav-item[data-page="budgets"]').click();
    await logoutViaMenu();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), []);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'opsmind-theme')), []);
    assert.equal(await page.evaluate(() => state.user === null && state.workspaces.length === 0 && state.overview === null && state.trend === null && state.dashboard === null), true);
    await page.goBack();
    assert.notEqual(page.url(), 'about:blank');
    await page.locator('#auth-form').waitFor();
    assert.equal(await page.locator('#main-content').count(), 0, 'back button must not show the dashboard');
    assert.equal(await page.getByText('Personal coffee').count(), 0);
    await page.goto(base + '/');
    await page.locator('#auth-form [name="identifier"]').waitFor();
    assert.equal(await page.locator('#main-content').count(), 0);
    for (const p of ['/api/auth/me', `/api/workspaces/${personalId}/transactions`, `/api/workspaces/${householdId}/overview`, `/api/workspaces/${personalId}/export`]) assert.equal(await rawStatus(p), 401, p);
    await page.screenshot({ path: shot('after-logout'), fullPage: true });
    passed.push('7 Logout clears session/cache; back button, saved URL and APIs require sign-in');

    // 8. Restart the server against the same database file; data and accounts persist.
    await stopServer();
    await startServer();
    await page.goto(base + '/login');
    await signIn(ph.username, ph.password, 'personal_household');
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    assert.deepEqual(await merchants(), ['Personal coffee']);
    await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    assert.deepEqual(await merchants(), ['Household groceries']);
    await logoutViaMenu();
    await signIn(biz.username, biz.password, 'business');
    await page.locator('#main-content[data-workspace-kind="Business"]').waitFor();
    assert.deepEqual(await merchants(), ['Cloud invoice']);
    passed.push('8 Accounts, usernames and records persist after server restart');

    // Responsive checks for the new screens.
    const mobile = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await mobile.goto(base + '/login');
    await mobile.locator('#auth-form').waitFor();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'login overflow');
    await mobile.screenshot({ path: shot('login-mobile'), fullPage: true });
    await mobile.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'signup overflow');
    await mobile.screenshot({ path: shot('signup-mobile'), fullPage: true });
    await mobile.close();

    assert.deepEqual(errors, [], 'browser runtime errors');
    console.log('PASS\n - ' + passed.sort().join('\n - '));
  } catch (error) {
    console.error('Passed before failure:', passed);
    console.error(error);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) server.kill();
  }
})();
