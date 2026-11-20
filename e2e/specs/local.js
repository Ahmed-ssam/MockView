// Local mode: no login, Settings page with the person's own Gemini key, demo banner, nothing leaks the key.
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const BASE = 'http://localhost:3000', API = 'http://localhost:8000/api/v1';
let fails = 0; const ok = (n, c, extra = '') => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (extra ? '\n      ' + extra : '')); };
const cfg = { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', duration_min: 30, mode: 'text', personality: 'friendly', interviewer_experience: 'senior', avatar_id: 'alex' };
const KEY = 'AIzaSyFakeKeyForTestingOnly1234567890';
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const csp = []; p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
  await p.goto(BASE + '/'); await p.waitForSelector('a[href="/settings"]');
  ok('header offers Settings and no Log in / Get Started', await p.locator('a[href="/login"], a[href="/signup"]').count() === 0);
  await p.goto(BASE + '/login'); await p.waitForURL(/dashboard/);
  ok('/login sends you straight to the dashboard', true);
  await p.waitForSelector('text=Welcome back');
  ok('dashboard has no log-out button', await p.getByRole('button', { name: /log out/i }).count() === 0);
  ok('demo-mode banner is shown without a key', await p.locator('text=Add your Gemini API key').count() === 1);
  // a real interview works without any login
  const r = await fetch(API + '/interviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer local' }, body: JSON.stringify(cfg) });
  const iv = await r.json(); ok('interview starts with no account (201, demo)', r.status === 201 && iv.demo_mode === true);
  await p.goto(`${BASE}/interview/${iv.id}`); await p.waitForSelector('text=Introduction');
  ok('interview room opens without login', true);
  // wizard still reachable and starts an interview from the UI path (no "please log in")
  await p.goto(BASE + '/interview/new'); await p.waitForSelector('text=What are you interviewing for');
  await p.waitForSelector('text=Add your Gemini API key'); ok('wizard shows the demo banner too', true);
  // settings
  await p.goto(BASE + '/settings'); await p.waitForSelector('text=Demo mode · no key yet');
  await p.route('**/settings/models', r => r.request().postData().includes('"api_key":"AIza') || r.request().postData() === '{}'
    ? r.fulfill({ json: { ok: true, models: ['gemini-2.5-flash', 'gemini-2.5-pro'], method: 'listed', message: '2 usable model(s) found.' } }) : r.continue());
  ok('Save is disabled until a model is chosen', await p.getByRole('button', { name: 'Save', exact: true }).isDisabled());
  await p.fill('#key', 'short'); await p.getByRole('button', { name: /Check key/ }).click();
  await p.waitForSelector('main [role=alert]'); ok('a malformed key is rejected with a clear message', /Paste your Gemini API key/.test(await p.locator('main [role=alert]').innerText()));
  await p.fill('#key', KEY); await p.getByRole('button', { name: /Check key/ }).click();
  await p.waitForFunction(() => document.querySelectorAll('#model option').length === 2);
  ok('model dropdown lists the models the key can use, recommended first', (await p.locator('#model option').allInnerTexts()).join('|') === 'gemini-2.5-flash (recommended)|gemini-2.5-pro');
  await p.selectOption('#model', 'gemini-2.5-pro');
  await p.getByRole('button', { name: 'Test key' }).click();
  await p.waitForFunction(() => /./.test(document.querySelector('main [role=alert], main [role=status]')?.textContent || '') && !/Testing/.test(document.body.innerText), null, { timeout: 30000 });
  const testMsg = await p.locator('main').innerText();
  ok('Test key gives feedback and never prints the key', !testMsg.includes(KEY));
  await p.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForSelector('text=Real AI on · key …7890 · gemini-2.5-pro');
  ok('saving shows real-AI status with only the last 4 characters', !(await p.content()).includes(KEY) && (await p.inputValue('#key')) === '');
  const s = await (await fetch(API + '/settings')).text(); ok('API never returns the key', !s.includes(KEY));
  await p.goto(BASE + '/dashboard'); await p.waitForSelector('text=Welcome back'); await p.waitForTimeout(500);
  ok('banner disappears once a key is saved', await p.locator('text=Add your Gemini API key').count() === 0);
  const h = await (await fetch('http://localhost:8000/health')).json(); ok('backend now uses the gemini provider', h.ai_provider === 'gemini' && h.demo_mode === false);
  await p.goto(BASE + '/settings'); await p.waitForSelector('text=Real AI on');
  const ax = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  ok('a11y: settings page', ax.violations.length === 0, ax.violations.map(v => v.id + ' ' + v.nodes[0].target.join(' ')).join('; '));
  await p.getByRole('button', { name: 'Remove key' }).click(); await p.waitForSelector('text=Demo mode · no key yet');
  ok('removing the key returns to demo mode', (await (await fetch('http://localhost:8000/health')).json()).demo_mode === true);
  ok('no Content-Security-Policy violations', csp.length === 0, csp.join(' | '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await br.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
