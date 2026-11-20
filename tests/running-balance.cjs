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


(async()=>{
 let browser;
 try {
  await waitForServer();
  browser=await chromium.launch({headless:true,executablePath});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.evaluate(() => openDemo());
  await page.locator('.personal-money').waitFor();
  const id=await page.evaluate(async()=>{const w=await api('/api/workspaces','POST',{name:'Simple balance test',kind:'Personal'});await bootstrap();return w.id;});
  await page.locator('[data-action="switch-workspace"]').click();await page.locator(`[data-action="pick-workspace"][data-id="${id}"]`).click();await page.locator(`#main-content[data-workspace-id="${id}"]`).waitFor();
  await page.getByRole('button',{name:'Set up my balance',exact:true}).click();
  const dialog=()=>page.locator('[role="dialog"]');
  await dialog().locator('[name="salary_day"]').fill('24');
  await dialog().locator('[name="tracking_balance"]').fill('20000');
  await dialog().locator('[type="submit"]').click();
  await dialog().waitFor({state:'detached'});
  assert.match(await page.locator('.personal-money .safe-number').innerText(),/20,000/);
  await page.getByRole('button',{name:'Record salary',exact:true}).click();
  await dialog().locator('[name="amount"]').fill('75000');await dialog().locator('[type="submit"]').click();await dialog().waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('.personal-money .safe-number')?.textContent.includes('95,000'));
  await page.locator('.heading-actions [data-action="add-transaction"]').click();
  await dialog().locator('[name="amount"]').fill('6000');await dialog().locator('[name="merchant"]').fill('Groceries');await dialog().locator('[type="submit"]').click();await dialog().waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('.personal-money .safe-number')?.textContent.includes('89,000'));
  await page.reload();await page.locator('.personal-money').waitFor();
  await page.waitForFunction(()=>document.querySelector('.personal-money .safe-number')?.textContent.includes('89,000'));
  await page.screenshot({path:path.join(output,'running-balance-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,'running-balance-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: 20000 + 75000 - 6000 = 89000; setup, persistence, mobile and no browser errors.');
 } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
