// Phone responsiveness audit at 360px and 390px: pages, sidebar navigation and dialogs.
// Run: node tests/mobile.cjs        (fails on overflow, off-screen controls, tiny tap targets or unreachable nav)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results', 'mobile');
fs.mkdirSync(output, { recursive: true });
const python = process.env.PYTHON_BIN || (process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313', 'python.exe') : 'python3');
const executablePath = process.env.BROWSER_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined);
const db = path.join(root, 'test-results', `mobile-${Date.now()}.db`);
const base = 'http://127.0.0.1:8019';
let logs = '';
const server = spawn(python, ['server.py', '--port', '8019'], { cwd: root, windowsHide: true, env: { ...process.env, OPSMIND_DB: db }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', d => { logs += d; });
server.stderr.on('data', d => { logs += d; });
const SHOTS = process.env.SHOTS === '1';

// Runs in the page: horizontal overflow, controls off-screen, tap targets under 32px.
function inspect(scope) {
  const vw = document.documentElement.clientWidth, problems = [];
  if (document.documentElement.scrollWidth > vw + 1) problems.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px > ${vw}px)`);
  const root = scope ? document.querySelector(scope) : document.body;
  if (!root) return [`missing ${scope}`];
  const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0; };
  const inScroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (['auto', 'scroll'].includes(s.overflowX) && p.scrollWidth > p.clientWidth) return true; if (p.classList?.contains('sidebar') && !p.classList.contains('open')) return true; } return false; };
  const describe = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className.baseVal ?? el.className).split(' ').filter(Boolean).slice(0, 2).join('.')}${el.dataset?.action ? `[${el.dataset.action}]` : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`;
  for (const el of root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, h1, h2, h3, p, strong, .stat-number, svg.chart')) {
    if (!visible(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) problems.push(`off-screen ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)})`);
    if (el.matches('button, a[href], select, input:not([type=checkbox]):not([type=radio])') && (r.height < 32 || r.width < 32)) problems.push(`small tap target ${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const el of root.querySelectorAll('h1, h2, h3, .stat-number, strong, .btn, label')) {
    if (visible(el) && !inScroller(el) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && getComputedStyle(el).textOverflow !== 'ellipsis') problems.push(`clipped text ${describe(el)}`);
  }
  return [...new Set(problems)];
}

(async () => {
  let browser;
  const report = [];
  const errors = [];
  try {
    for (let i = 0; i < 80 && !(await fetch(base + '/api/health').then(r => r.ok, () => false)); i++) await new Promise(r => setTimeout(r, 100));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    for (const width of [360, 390]) {
      for (const account of ['personal_household', 'business']) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        const check = async (label, scope) => {
          await page.waitForTimeout(150);
          const problems = await page.evaluate(inspect, scope || null);
          if (problems.length) report.push(`[${width}px ${account}] ${label}:\n    - ` + problems.join('\n    - '));
          if (SHOTS) await page.screenshot({ path: path.join(output, `${width}-${account}-${label.replace(/\W+/g, '-')}.png`), fullPage: !scope });
        };
        const dialog = page.locator('[role="dialog"]');
        const closeDialog = async () => { await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }).catch(() => {}); };
        const openNav = async name => {
          await page.locator('.mobile-menu').click();
          const item = page.locator(`.sidebar .nav-item[data-page="${name}"]`);
          await item.waitFor({ state: 'visible' });
          await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().left >= 0);  // slide-in finished
          const box = await item.boundingBox();
          if (!box || box.x < 0 || box.x + box.width > width) report.push(`[${width}px ${account}] sidebar item ${name} not reachable`);
          await item.click();
          await page.locator('#main-content').waitFor();
          if (await page.locator('.sidebar.open').count()) report.push(`[${width}px ${account}] sidebar stays open over content after choosing ${name}`);
        };
        await page.goto(base + '/login');
        await check('login');
        await page.locator('#auth-form [name="account_type"]').selectOption(account);
        await page.evaluate(() => openDemo());
        await page.locator('#main-content').waitFor();
        await check('overview');
        await page.locator('.mobile-menu').click();
        await page.locator('.sidebar.open').waitFor();
        await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().left >= 0);
        await check('sidebar open', '.sidebar');
        await page.mouse.click(width - 10, 400);
        await page.waitForFunction(() => !document.querySelector('.sidebar.open'));
        await page.locator('.topbar .profile-trigger').click();
        await check('profile menu', '.profile-panel');
        await page.keyboard.press('Escape');

        await page.locator('.heading-actions [data-action="add-transaction"]').first().click();
        await dialog.waitFor();
        await check('add expense dialog', '[role="dialog"]');
        if (account !== 'business') {
          const advanced = dialog.locator('[data-action="advanced-entry"]');
          if (await advanced.count()) { await advanced.click(); await check('advanced transaction dialog', '[role="dialog"]'); }
        }
        await closeDialog();
        await page.locator('[data-action="manage-bills"]').first().click();
        await check('bills dialog', '[role="dialog"]');
        await dialog.locator('[data-action="add-plan"]').click();
        await check('bill form', '[role="dialog"]');
        await closeDialog();
        const payBill = page.locator('[data-action="pay-bill"]').first();
        if (await payBill.count()) await check('upcoming bills panel', '.secondary-column');

        for (const name of ['transactions', 'budgets', 'subscriptions', ...(account === 'business' ? [] : ['goals']), 'analytics', 'insights', 'settings']) {
          await openNav(name);
          await check(name);
          if (name === 'transactions') { await page.locator('[data-action="edit-transaction"]').first().click(); await check('edit transaction dialog', '[role="dialog"]'); await closeDialog(); }
          if (name === 'subscriptions') { await page.locator('[data-action="edit-subscription"]').first().click(); await check('subscription dialog', '[role="dialog"]'); await closeDialog(); }
          if (name === 'goals') { await page.locator('.heading-actions [data-action="add-goal"]').click(); await check('goal dialog', '[role="dialog"]'); await closeDialog(); }
          if (name === 'analytics') {
            await page.locator('.trend-panel[data-chart="spend"] [data-action="trend-mode"][data-mode="week"]').click();
            await page.waitForFunction(() => state.trend.mode === 'week');
            await check('analytics week');
          }
        }
        if (account !== 'business') {
          await page.locator('.topbar [data-action="switch-view"][data-view="Household"]').click();
          await page.locator('#main-content[data-workspace-kind="Household"]').waitFor();
          await check('household overview');
          await openNav('settings');
          await page.locator('[data-action="members"]').click();
          await check('members dialog', '[role="dialog"]');
          await closeDialog();
          await page.locator('.mobile-menu').click();
          await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().left >= 0);
          await page.locator('[data-action="switch-workspace"]').click();
          await check('switch workspace dialog', '[role="dialog"]');
          await closeDialog();
          await page.locator('.heading-actions [data-action="add-workspace"]').click();
          await check('new workspace dialog', '[role="dialog"]');
          await closeDialog();
          await openNav('overview');
          await page.locator('[data-action="personal-settings"]').click();
          await check('balance dialog', '[role="dialog"]');
          await closeDialog();
        }
        await context.close();
      }
    }
    if (errors.length) report.push('Browser errors:\n    - ' + errors.join('\n    - '));
    if (report.length) { console.log('ISSUES\n' + report.join('\n')); process.exitCode = 1; }
    else console.log('PASS: 360px and 390px — login, overview, sidebar navigation, profile menu, transactions, budgets, bills, subscriptions, goals, analytics (month + week), insights, settings, household and all checked dialogs: no horizontal overflow, off-screen controls, clipped text or tap targets under 32px.');
  } catch (error) {
    console.error('Report so far:\n' + report.join('\n'));
    console.error(error);
    console.error(logs.slice(-2000));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})();
