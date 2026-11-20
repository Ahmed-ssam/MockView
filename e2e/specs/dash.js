const { chromium } = require('playwright');
const out = (process.env.E2E_OUT || '/tmp/mockview-e2e') + '/shots';
const BASE = 'http://localhost:3000', API = 'http://localhost:8000/api/v1';
let fails = 0;
const ok = (n, c) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
const cfg = { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', duration_min: 30,
  mode: 'text', personality: 'friendly', interviewer_experience: 'senior', avatar_id: 'alex' };

async function api(tok, path, method = 'GET', body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: r.status === 204 ? null : await r.json() };
}
async function fullInterview(tok, text) {
  let v = (await api(tok, '/interviews', 'POST', cfg)).json;
  const id = v.id; let guard = 0;
  while (!v.ready_to_finish && guard++ < 30) {
    const r = await api(tok, `/interviews/${id}/answers`, 'POST', guard === 1 ? { text: '', skipped: true, source: 'text' } : { text, skipped: false, source: 'text' });
    if (r.status !== 200) throw new Error('answer failed ' + r.status + JSON.stringify(r.json));
    v = (await api(tok, `/interviews/${id}`)).json;
  }
  const f = await api(tok, `/interviews/${id}/finish`, 'POST');
  if (f.status !== 200) throw new Error('finish failed ' + JSON.stringify(f.json));
  return id;
}
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/login'); await p.fill('#email', 'tester@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.getByRole('button', { name: /log in/i }).click(); await p.waitForURL(/dashboard/);
  await p.waitForSelector('text=No interviews yet');
  ok('empty dashboard shows the no-interviews state', true);
  const tok = await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token/.test(k)) return JSON.parse(localStorage.getItem(k)).access_token; });
  ok('got a session token', !!tok);
  const a = await fullInterview(tok, 'short answer');
  const c = await fullInterview(tok, 'I would explain the core idea with a concrete example and discuss security, caching, testing and trade-offs in detail.');
  await p.reload(); await p.waitForSelector('text=Interview history');
  ok('two history rows', await p.locator('ul li.card').count() === 2);
  ok('demo notice: progress excludes demo reports', await p.locator('text=Demo-mode reports are excluded').count() === 1);
  ok('trend explains it needs real reports or two points', await p.locator('text=Complete at least two interviews').count() === 1);
  await p.screenshot({ path: `${out}/dashboard.png`, fullPage: true });
  const cmp = p.getByRole('link', { name: /Compare selected/ });
  ok('compare disabled until two picked', (await cmp.getAttribute('aria-disabled')) === 'true');
  const boxes = p.locator('ul li.card input[type=checkbox]'); await boxes.nth(0).check(); await boxes.nth(1).check();
  ok('compare enabled with two picked', (await cmp.getAttribute('aria-disabled')) === 'false');
  await cmp.click(); await p.waitForURL(/\/compare\?/); await p.waitForSelector('text=Compare interviews');
  await p.waitForSelector('tbody tr');   ok('compare shows demo warning', await p.locator('text=demo-mode').count() >= 1);
  ok('compare radar rendered', await p.locator('svg.recharts-surface').count() >= 1);
  ok('compare table has 6 skills', await p.locator('tbody tr').count() === 6);
  await p.screenshot({ path: `${out}/compare.png`, fullPage: true });
  await p.goBack(); await p.waitForSelector('text=Interview history');
  await p.waitForSelector('ul li.card'); await p.getByRole('button', { name: /^Delete .+ interview$/ }).first().click();
  await p.getByRole('button', { name: 'Yes, delete' }).click();
  await p.waitForFunction(() => document.querySelectorAll('ul li.card').length === 1);
  ok('delete removes one row', true);
  ok('deleted interview is gone for the API', [a, c].filter(async () => true).length === 2 && ((await api(tok, `/interviews/${a}`)).status === 404 || (await api(tok, `/interviews/${c}`)).status === 404));
  const bad = await api(tok, `/history/compare?base=${a}&other=${c}`);
  ok('compare of a deleted interview is rejected', bad.status === 404);
  ok('no page errors', errs.length === 0);
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
