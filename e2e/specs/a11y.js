// Accessibility (axe-core, WCAG 2.1 A/AA) over every screen, in light and with a phone viewport for the key ones.
// Also fails on any Content-Security-Policy violation, so the strict CSP is proven not to break a page.
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const BASE = 'http://localhost:3000', API = 'http://localhost:8000/api/v1';
const OUT = process.env.E2E_OUT || '/tmp/mockview-e2e';
let fails = 0; const ok = (n, c, extra = '') => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (extra ? '\n      ' + extra : '')); };
const cfg = { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', duration_min: 30, mode: 'text', personality: 'friendly', interviewer_experience: 'senior', avatar_id: 'dana' };
const api = async (t, p, m = 'GET', b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) }; };
const draft = (step, extra = {}) => ({ step, specializationName: 'Web Development', draft: { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', mode: 'text', duration_min: 30, personality: 'friendly', interviewer_experience: 'experienced', avatar_id: 'dana', ...extra } });

(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const csp = []; p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let total = 0;
  async function audit(name, setup) {
    if (setup) await setup();
    await p.waitForLoadState('networkidle').catch(() => {});
    const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = r.violations.filter(v => ['serious', 'critical', 'moderate', 'minor'].includes(v.impact));
    total += bad.length;
    ok(`a11y: ${name}`, bad.length === 0, bad.map(v => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x) e.g. ${v.nodes.slice(0,3).map(n => n.target.join(" ") + " :: " + (n.any[0]?.message||"").slice(0,110)).join(" | ")}`).join('\n      '));
  }

  await audit('home', () => p.goto(BASE + '/'));
  await audit('login', () => p.goto(BASE + '/login'));
  await audit('signup', () => p.goto(BASE + '/signup'));
  await audit('reset password', () => p.goto(BASE + '/reset-password'));
  await audit('privacy', () => p.goto(BASE + '/privacy'));
  await audit('terms', () => p.goto(BASE + '/terms'));
  await audit('404', () => p.goto(BASE + '/definitely-not-a-page'));

  await p.goto(BASE + '/login'); await p.fill('#email', 'a@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.getByRole('button', { name: /log in/i }).click(); await p.waitForURL(/dashboard/);
  const tok = await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token/.test(k)) return JSON.parse(localStorage.getItem(k)).access_token; });
  await audit('dashboard (empty)', async () => { await p.goto(BASE + '/dashboard'); await p.waitForSelector('text=No interviews yet'); });

  for (const [step, label, extra] of [[1, 'wizard step 1 (field)', {}], [2, 'wizard step 2 (configuration)', {}], [3, 'wizard step 3 (interviewer)', {}]]) {
    await audit(label, async () => {
      await p.goto(BASE + '/interview/new');
      await p.evaluate(([d]) => sessionStorage.setItem('mockview:new-interview', JSON.stringify(d)), [draft(step, extra)]);
      await p.reload(); await p.waitForSelector(['text=What are you interviewing for', 'text=Configure your interview', 'text=Customize your interviewer'][step - 1]);
    });
  }

  // data for the remaining screens
  const make = async () => { let v = (await api(tok, '/interviews', 'POST', cfg)).j; return v; };
  const complete = async (id) => { let v = (await api(tok, `/interviews/${id}`)).j, n = 0; while (!v.ready_to_finish && n++ < 30) { await api(tok, `/interviews/${id}/answers`, 'POST', n === 1 ? { text: '', skipped: true, source: 'text' } : { text: 'I would explain with an example and trade-offs.', skipped: false, source: 'text' }); v = (await api(tok, `/interviews/${id}`)).j; } return (await api(tok, `/interviews/${id}/finish`, 'POST')).s; };
  const a = (await make()).id; await complete(a);
  const b = (await make()).id; await complete(b);
  const live = (await make()).id;

  await audit('dashboard (with history)', async () => { await p.goto(BASE + '/dashboard'); await p.waitForSelector('text=Interview history'); });
  await audit('interview room (text mode, intro)', async () => { await p.goto(`${BASE}/interview/${live}`); await p.waitForSelector('text=Introduction'); });
  await audit('report', async () => { await p.goto(`${BASE}/interview/${a}/report`); await p.waitForSelector('text=Interview report'); });
  await audit('report (all question reviews expanded)', async () => { await p.locator('details').evaluateAll(ds => ds.forEach(d => d.open = true)); });
  await audit('compare', async () => { await p.goto(`${BASE}/compare?base=${a}&other=${b}`); await p.waitForSelector('text=Compare interviews'); });
  await audit('admin', async () => { await p.goto(BASE + '/admin'); await p.waitForSelector('text=Catalog health'); });

  // phone viewport: the pages people actually use on a phone
  await p.setViewportSize({ width: 390, height: 800 });
  for (const [n, path, wait] of [['home (phone)', '/', null], ['room (phone)', `/interview/${live}`, 'text=Introduction'], ['report (phone)', `/interview/${a}/report`, 'text=Interview report']]) {
    await audit(n, async () => { await p.goto(BASE + path); if (wait) await p.waitForSelector(wait); });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(`no horizontal page scroll: ${n}`, !overflow);
  }

  ok('no Content-Security-Policy violations on any page', csp.length === 0, csp.slice(0, 3).join('\n      '));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  // headers
  const res = await fetch(BASE + '/'); const h = res.headers;
  ok('frontend sends CSP, frame and permissions headers', /default-src 'self'/.test(h.get('content-security-policy') || '') && h.get('x-frame-options') === 'DENY' && /microphone=\(self\)/.test(h.get('permissions-policy') || ''));
  ok('frontend does not advertise Next.js', !h.get('x-powered-by'));
  await br.close(); console.log(fails ? `\n${fails} FAILED (${total} accessibility violations)` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
