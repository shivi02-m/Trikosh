// Browser check: Household "Spent by", School Fees (dependent) and event links, relinking, refresh persistence.
// Run: node tests/household-links.cjs   (isolated test database)
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
const db = path.join(output, `household-links-${Date.now()}.db`);
const base = 'http://127.0.0.1:8021';
let logs = '';
const outbox = path.join(output, `household-links-mail-${Date.now()}.jsonl`);
const server = spawn(python, ['server.py', '--port', '8021'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db, MAIL_OUTBOX_FILE: outbox, PUBLIC_URL: base }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', d => { logs += d; });
server.stderr.on('data', d => { logs += d; });

let lastEmail = '';
async function signup(page, name) {
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  await page.goto(base + '/login');
  await page.locator('[data-action="auth-toggle"][data-mode="signup"]').click();
  await page.locator('#auth-form [name="name"]').fill(name);
  await page.locator('#auth-form [name="username"]').fill(name.toLowerCase() + stamp);
  lastEmail = `${name.toLowerCase()}-${stamp}@example.com`;
  await page.locator('#auth-form [name="email"]').fill(lastEmail);
  await page.locator('#auth-form [name="password"]').fill('a long password');
  await page.locator('#auth-form [type="submit"]').click();
  await page.locator('#onboarding-form').waitFor();
  return name.toLowerCase() + stamp;
}

(async () => {
  let browser;
  const errors = [];
  try {
    for (let i = 0; i < 80 && !(await fetch(base + '/api/health').then(r => r.ok, () => false)); i++) await new Promise(r => setTimeout(r, 100));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    // Second member: just needs an account.
    const other = await (await browser.newContext()).newPage();
    const partnerUsername = await signup(other, 'Ravi');
    const partnerEmail = lastEmail;

    const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errors.push(m.text()); });
    const dialog = () => page.locator('[role="dialog"]');
    const closed = () => dialog().waitFor({ state: 'detached' });
    await signup(page, 'Meera');
    await page.locator('#onboarding-form [type="submit"]').click();               // Personal
    await page.locator('#main-content[data-workspace-kind="Personal"]').waitFor();
    await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
    await page.locator('#onboarding-form [type="submit"]').click();               // Household
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    // Set up: balance, partner membership, a dependent item and an event (₹30,000) via the existing APIs.
    const ids = await page.evaluate(async partner => {
      const w = state.workspace;
      await api(endpoint('settings'), 'PUT', { name: w.name, ...w.settings, tracking_start: localDate(), tracking_balance: 0 });
      await api(endpoint('members'), 'POST', { email: partner, role: 'member' });
      const future = new Date(Date.now() + 40 * 864e5); const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      const school = await api(endpoint('planning'), 'POST', { type: 'dependent', name: 'School Fees', amount: 0, date: localDate(), owner: 'Shared' });
      const diwali = await api(endpoint('planning'), 'POST', { type: 'event', name: 'Diwali', amount: '30000', date: iso, owner: 'Shared', category: 'Shopping' });
      await bootstrap();
      return { school: school.id, diwali: diwali.id, me: state.user.id };
    }, partnerEmail);
    // The partner accepts through the emailed link (written to the outbox file in tests).
    const invite = JSON.parse(fs.readFileSync(outbox, 'utf8').trim().split(/\r?\n/).pop());
    assert.equal(invite.to, partnerEmail);
    await other.goto(invite.text.match(/Accept invitation: (\S+)/)[1]);
    await other.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    await page.reload();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();

    // Member spending on Overview lists both members, including zero-spend.
    const members = page.locator('.personal-money .member-spending');
    await members.waitFor();
    let text = await members.innerText();
    assert.match(text, /Meera \(you\)[\s\S]*Ravi/);
    assert.equal((text.match(/₹0/g) || []).length >= 2, true, 'zero-spend members shown');

    // Quick "Add expense": Spent by defaults to me; link to the event.
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    assert.equal(await dialog().locator('[name="spent_by"]').inputValue(), ids.me);
    await dialog().locator('[name="amount"]').fill('14500');
    await dialog().locator('[name="merchant"]').fill('Festival shopping');
    await dialog().locator('[name="event_id"]').selectOption(ids.diwali);
    await dialog().locator('[type="submit"]').click();
    await closed();
    // School fees recorded for the partner, linked to School Fees.
    await page.locator('.heading-actions [data-action="add-transaction"]').click();
    await dialog().locator('[name="amount"]').fill('8000');
    await dialog().locator('[name="merchant"]').fill('Term fees');
    const raviId = await page.evaluate(() => state.dashboard.household_members.find(m => m.name === 'Ravi').id);
    await dialog().locator('[name="spent_by"]').selectOption(raviId);
    await dialog().locator('[name="dependent_id"]').selectOption(ids.school);
    await dialog().locator('[type="submit"]').click();
    await closed();
    // Wait for both saves to finish reloading (not just the first), so the checks below read a settled screen.
    await page.waitForFunction(() => state.dashboard.events[0].spent === 1450000
      && state.overview.member_spending.members.some(m => m.name === 'Ravi' && m.amount === 800000));
    await page.waitForTimeout(300);

    const check = async () => {
      await page.locator('.simple-more').evaluate(d => { d.open = true; });
      const events = await page.locator('section.panel', { hasText: 'Events & festivals' }).innerText();
      assert.match(events, /₹14,500 spent/);
      assert.match(events, /₹15,500 remaining/);
      assert.match(events, /View 1 linked record\b/);
      const deps = await page.locator('section.panel', { hasText: 'Children & dependent costs' }).innerText();
      assert.match(deps, /School Fees[\s\S]*1 linked record[\s\S]*₹8,000/);
      text = await page.locator('.personal-money .member-spending').innerText();
      assert.match(text, /Meera \(you\)[\s\S]*₹14,500[\s\S]*Ravi[\s\S]*₹8,000/);
    };
    await check();
    await page.screenshot({ path: path.join(output, 'household-links.png'), fullPage: true });
    // Linked-records dialog lists the original expense (no duplicate).
    await page.locator('[data-action="event-records"]').click();
    await dialog().locator('tbody tr').first().waitFor();
    assert.equal(await dialog().locator('tbody tr').count(), 1);
    assert.match(await dialog().innerText(), /Festival shopping/);
    await page.keyboard.press('Escape');

    // Refresh: everything persists.
    await page.reload();
    await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
    await check();

    // Relink through editing: move the festival expense to School Fees and unlink it from the event.
    await page.locator('.sidebar .nav-item[data-page="transactions"]').click();
    const txId = await page.evaluate(() => state.overview.transactions.find(t => t.merchant === 'Festival shopping').id);
    await page.locator(`[data-action="edit-transaction"][data-id="${txId}"]`).click();
    await dialog().locator('[name="event_id"]').selectOption('');
    await dialog().locator('[name="dependent_id"]').selectOption(ids.school);
    await dialog().locator('[type="submit"]').click();
    await closed();
    const after = await page.evaluate(async () => { await load(); return { count: state.overview.count, ev: state.dashboard.events[0], dep: state.dashboard.dependent_costs[0] }; });
    assert.equal(after.count, 2, 'relinking did not create a transaction');
    assert.equal(after.ev.spent, 0);
    assert.equal(after.ev.remaining, 3000000);
    assert.equal(after.dep.amount, 2250000);
    assert.equal(after.dep.evidence.length, 2);

    assert.deepEqual(errors, []);
    console.log('PASS: two members listed incl. zero spend; Spent by defaults to you and can be another member; ₹14,500 event shows ₹15,500 remaining and 1 linked record; School Fees updates; linked-records dialog; refresh persistence; relinking via edit recalculates without duplicating.');
  } catch (error) {
    console.error(error);
    try { for (const p of browser.contexts().flatMap(c => c.pages())) console.error('PAGE', p.url(), JSON.stringify((await p.locator('body').innerText()).slice(0, 400))); } catch {}
    console.error(logs.slice(-2000));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
