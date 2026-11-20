// Browser check: Personal vs Household features, new-workspace type choice, name-only display,
// compact workspace switching, renaming and persistence after refresh.
// Run: node tests/workspaces.cjs
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
const db = path.join(output, `workspaces-${Date.now()}.db`);
const base = 'http://127.0.0.1:8017';
let logs = '';
const server = spawn(python, ['server.py', '--port', '8017'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const nav = name => page.locator(`.sidebar .nav-item[data-page="${name}"]`).click();
    const current = async (kind, name) => {
      await page.locator(`#main-content[data-workspace-kind="${kind}"]`).waitFor();
      await page.waitForFunction(n => document.getElementById('workspace-name')?.textContent === n, name);
    };
    // Name-only display: sidebar, breadcrumb and profile menu, with no type prefix, subtitle or dropdown arrow.
    const assertNameOnly = async name => {
      const control = page.locator('.workspace-control');
      assert.equal((await control.innerText()).trim(), name);
      assert.equal(await control.locator('select, label').count(), 0, 'no dropdown or subtitle');
      assert.equal(await control.locator(':scope > svg').count(), 0, 'no dropdown arrow');
      assert.equal(await page.locator('.breadcrumb span').first().innerText(), name);
      await page.locator('.topbar .profile-trigger').click();
      const workspaceRow = page.locator('.profile-panel:not([hidden]) dl div', { hasText: 'Current workspace' }).locator('dd');
      assert.equal(await workspaceRow.innerText(), name);
      await page.keyboard.press('Escape');
    };
    const createFromSettings = async (kind, name) => {
      await nav('settings');
      await page.locator('.heading-actions [data-action="add-workspace"]').click();
      const types = await dialog().locator('[data-action="workspace-kind"]').allInnerTexts();
      assert.deepEqual(types.map(t => t.trim()), ['Personal', 'Household']);
      await dialog().locator('[name="name"]').fill(name);
      await dialog().locator(`[data-action="workspace-kind"][data-kind="${kind}"]`).click();
      assert.equal(await dialog().locator('[name="name"]').inputValue(), name, 'typed name kept when switching type');
      assert.equal(await dialog().locator(`button[data-kind="${kind}"]`).getAttribute('aria-pressed'), 'true');
      await dialog().locator('[type="submit"]').click();
      await current(kind, name);
    };
    const rename = async name => {
      await nav('settings');
      await page.locator('#workspace-settings [name="name"]').fill(name);
      await page.locator('#workspace-settings [type="submit"]').click();
      await page.waitForFunction(n => document.getElementById('workspace-name')?.textContent === n, name);
    };
    const reloadAndCheck = async (kind, name) => {
      await page.reload();
      await current(kind, name);
      await assertNameOnly(name);
    };

    const stamp = Date.now();
    await page.goto(base + '/login');
    await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
    await page.locator('#auth-form [name="name"]').fill('Parth Rao');
    await page.locator('#auth-form [name="username"]').fill('parth' + stamp);
    await page.locator('#auth-form [name="email"]').fill(`parth-${stamp}@example.com`);
    await page.locator('#auth-form [name="password"]').fill('a long password');
    await page.locator('#auth-form [type="submit"]').click();
    await page.locator('#onboarding-form [name="name"]').fill("Parth's workspace");
    await page.locator('#onboarding-form [type="submit"]').click();
    await current('Personal', "Parth's workspace");
    await assertNameOnly("Parth's workspace");
    // Only one workspace: no switch control needed yet.
    assert.equal(await page.locator('[data-action="switch-workspace"]').count(), 0);

    // 1. Personal hides People & shared plans and the Spending ownership chart.
    assert.equal(await page.locator('.simple-more').count(), 0);
    await nav('analytics');
    await page.getByRole('heading', { name: 'Spending overview' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: /Spending ownership|Member spending/ }).count(), 0);

    // 2. Create a Household from Personal Settings; it opens with Household features.
    await createFromSettings('Household', 'Family home');
    await assertNameOnly('Family home');
    await page.locator('.simple-more > summary').click();
    await page.getByRole('heading', { name: 'Member contributions', exact: true }).waitFor();
    await nav('analytics');
    await page.getByRole('heading', { name: 'Member spending', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'workspace-household-name.png') });

    // ...and a second Personal workspace from the same dialog.
    await createFromSettings('Personal', 'Side savings');
    assert.equal(await page.locator('.simple-more').count(), 0);

    // 5. Compact switch control lists names only and switches across types.
    await page.locator('[data-action="switch-workspace"]').click();
    const options = (await dialog().locator('[data-action="pick-workspace"]').allInnerTexts()).map(t => t.trim());
    assert.deepEqual(options.sort(), ['Family home', "Parth's workspace", 'Side savings']);
    await dialog().locator('[data-action="pick-workspace"]', { hasText: "Parth's workspace" }).click();
    await current('Personal', "Parth's workspace");
    await page.locator('[data-action="switch-workspace"]').click();
    await dialog().locator('[data-action="pick-workspace"]', { hasText: 'Family home' }).click();
    await current('Household', 'Family home');
    assert.equal(await page.locator('.view-switch [aria-pressed="true"]').innerText(), 'Household');

    // Renaming + persistence after refresh, for both types.
    await rename('The Rao household');
    await reloadAndCheck('Household', 'The Rao household');
    await page.locator('.topbar [data-action="switch-view"][data-view="Personal"]').click();
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    await page.locator('[data-action="switch-workspace"]').click();
    await dialog().locator('[data-action="pick-workspace"]', { hasText: 'Side savings' }).click();
    await current('Personal', 'Side savings');
    await rename("Parth's FD fund");
    await reloadAndCheck('Personal', "Parth's FD fund");
    assert.equal(await page.locator('.simple-more').count(), 0);

    // Types persisted server-side.
    const kinds = await page.evaluate(() => api('/api/auth/me').then(me => Object.fromEntries(me.workspaces.map(w => [w.name, w.kind]))));
    assert.deepEqual(kinds, { "Parth's workspace": 'Personal', 'The Rao household': 'Household', "Parth's FD fund": 'Personal' });

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile overflow');
    await page.screenshot({ path: path.join(output, 'workspace-name-mobile.png'), fullPage: true });

    assert.deepEqual(errors, []);
    console.log('PASS: Personal hides shared plans + ownership chart; Household keeps them; new workspace offers Personal/Household and opens the right type; name-only display (sidebar, breadcrumb, profile); no subtitle/arrow; compact switching; rename + refresh persistence for both types.');
  } catch (error) {
    console.error(error);
    console.error(logs);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
