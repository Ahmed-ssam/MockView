const { chromium } = require('playwright'); const fs = require('fs');
const BASE = 'http://localhost:3000', API = 'http://localhost:8000/api/v1';
let fails = 0; const ok = (n, c) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
const cfg = { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', duration_min: 30, mode: 'text', personality: 'friendly', interviewer_experience: 'senior', avatar_id: 'alex' };
const api = async (t, p, m = 'GET', b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) }; };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ acceptDownloads: true })).newPage();
  await p.goto(BASE + '/login'); await p.fill('#email', 't@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.getByRole('button', { name: /log in/i }).click(); await p.waitForURL(/dashboard/);
  const tok = await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token/.test(k)) return JSON.parse(localStorage.getItem(k)).access_token; });
  let v = (await api(tok, '/interviews', 'POST', cfg)).j; let n = 0;
  while (!v.ready_to_finish && n++ < 30) { await api(tok, `/interviews/${v.id}/answers`, 'POST', n === 1 ? { text: '', skipped: true, source: 'text' } : { text: 'I would explain with an example and trade-offs.', skipped: false, source: 'text' }); v = (await api(tok, `/interviews/${v.id}`)).j; }
  await api(tok, `/interviews/${v.id}/finish`, 'POST');
  await p.goto(`${BASE}/interview/${v.id}/report`); await p.waitForSelector('text=Interview report');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Download PDF' }).click()]);
  const path = await dl.path(); const buf = fs.readFileSync(path);
  ok('download is a real PDF', buf.slice(0, 4).toString() === '%PDF');
  ok('filename is sensible', /^mockview-report-[0-9a-f]{8}\.pdf$/.test(dl.suggestedFilename()));
  ok('Print button present', await p.getByRole('button', { name: 'Print' }).count() === 1);
  await p.emulateMedia({ media: 'print' });
  ok('site header and action buttons hidden in print', !(await p.getByRole('button', { name: 'Download PDF' }).isVisible()));
  await br.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
