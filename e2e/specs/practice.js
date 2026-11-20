const { chromium } = require('playwright');
const S = (process.env.E2E_OUT || '/tmp/mockview-e2e');
const BASE = 'http://localhost:3000', API = 'http://localhost:8000/api/v1';
let fails = 0; const ok = (n, c) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
const cfg = { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', duration_min: 30, mode: 'text', personality: 'friendly', interviewer_experience: 'senior', avatar_id: 'noor' };
const api = async (t, p, m = 'GET', b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) }; };
async function complete(t, id) { let v = (await api(t, `/interviews/${id}`)).j, n = 0; while (!v.ready_to_finish && n++ < 30) { await api(t, `/interviews/${id}/answers`, 'POST', n === 1 ? { text: '', skipped: true, source: 'text' } : { text: 'I would explain with an example and trade-offs.', skipped: false, source: 'text' }); v = (await api(t, `/interviews/${id}`)).j; } return (await api(t, `/interviews/${id}/finish`, 'POST')).s; }
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); const bad = []; p.on('response', r => { if (r.status() >= 400 && /avatars/.test(r.url())) bad.push(r.url()); });
  await p.goto(BASE + '/login'); await p.fill('#email', 't@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.getByRole('button', { name: /log in/i }).click(); await p.waitForURL(/dashboard/);
  const tok = await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token/.test(k)) return JSON.parse(localStorage.getItem(k)).access_token; });
  // avatars in the wizard
  await p.goto(BASE + '/interview/new');
  await p.evaluate(() => sessionStorage.setItem('mockview:new-interview', JSON.stringify({ step: 3, specializationName: 'Web Development', draft: { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', mode: 'text', duration_min: 30, personality: 'friendly', interviewer_experience: 'experienced', avatar_id: 'noor' } })));
  await p.reload(); await p.waitForSelector('text=Appearance');
  await p.waitForFunction(() => [...document.images].filter(i => /avatars/.test(i.src)).every(i => i.complete && i.naturalWidth > 0));
  const srcs = await p.$$eval('img', is => is.map(i => i.getAttribute('src')).filter(s => /avatars/.test(s)));
  const names = new Set(srcs.map(s => decodeURIComponent(s).match(/avatars\/(\w+)\.webp/)?.[1]));
  ok('four portrait avatars load as .webp', names.size === 4 && !names.has(undefined));
  await p.screenshot({ path: `${S}/shots/wizard-avatars.png` });
  // practice flow
  const first = (await api(tok, '/interviews', 'POST', cfg)).j.id; ok('first interview completes', (await complete(tok, first)) === 200);
  await p.goto(`${BASE}/interview/${first}/report`); await p.waitForSelector('text=Interview report');
  ok('no retry banner on an original report', await p.locator('text=practice interview on the weak areas').count() === 0);
  await p.getByRole('button', { name: 'Practice my weak areas' }).click();
  await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const second = p.url().split('/').pop(); ok('lands in a new interview room', second !== first);
  await p.waitForSelector('text=Introduction'); await p.screenshot({ path: `${S}/shots/room-avatar.png` });
  ok('room shows interviewer portrait', await p.locator('img[src$=".webp"]').count() >= 1);
  ok('second interview completes', (await complete(tok, second)) === 200);
  await p.goto(`${BASE}/interview/${second}/report`); await p.waitForSelector('text=practice interview on the weak areas');
  await p.getByRole('link', { name: 'Compare with that attempt' }).click(); await p.waitForURL(/\/compare\?/); await p.waitForSelector('text=Compare interviews');
  await p.waitForSelector('tbody tr'); const rows = await p.locator('tbody tr').count(); console.log('compare rows', rows);
  ok('compare page opens from the practice report', rows >= 1);
  ok('avatar files all returned 200', bad.length === 0);
  ok('no page errors', errs.length === 0);
  await br.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
