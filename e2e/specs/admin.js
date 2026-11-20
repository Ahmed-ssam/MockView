const { chromium } = require('playwright');
const S = (process.env.E2E_OUT || '/tmp/mockview-e2e');
const BASE = 'http://localhost:3000', API = 'http://localhost:8000/api/v1', MODE = process.argv[2];
let fails = 0; const ok = (n, c) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
const cfg = { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', duration_min: 30, mode: 'text', personality: 'friendly', interviewer_experience: 'senior', avatar_id: 'sam' };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/'); await p.getByRole('link', { name: 'Log in' }).waitFor();
  ok('signed-out header shows Log in / Get Started', await p.getByRole('link', { name: 'Get Started' }).count() === 1);
  await p.goto(BASE + '/login'); await p.fill('#email', 'a@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.getByRole('button', { name: /log in/i }).click(); await p.waitForURL(/dashboard/);
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Log out' }).waitFor();
  ok('signed-in header shows Dashboard + Log out, not Log in', await p.getByRole('link', { name: 'Log in' }).count() === 0 && await p.getByRole('link', { name: 'Dashboard' }).count() === 1);
  const tok = await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/auth-token/.test(k)) return JSON.parse(localStorage.getItem(k)).access_token; });
  const adminLink = await p.getByRole('link', { name: 'Admin' }).count();
  if (MODE === 'user') {
    ok('no Admin link for a normal user', adminLink === 0);
    await p.goto(BASE + '/admin'); await p.waitForSelector('text=Admin access required');
    ok('/admin page says access required', true);
    const r = await fetch(API + '/admin/stats', { headers: { Authorization: 'Bearer ' + tok } });
    ok('server returns 403 for the admin API (not just a hidden link)', r.status === 403);
  } else {
    ok('Admin link shown for admin', adminLink === 1);
    // generate some data
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok };
    const v = await (await fetch(API + '/interviews', { method: 'POST', headers: h, body: JSON.stringify(cfg) })).json();
    await fetch(`${API}/interviews/${v.id}/abandon`, { method: 'POST', headers: h });
    await p.getByRole('link', { name: 'Admin' }).click(); await p.waitForSelector('text=Catalog health');
    ok('stat tiles rendered', await p.locator('text=Completion rate').count() === 1);
    ok('demo-mode banner visible to admin', await p.locator('text=demo mode is ON').count() === 1);
    ok('catalog reports 64 fields with no problems', await p.locator('text=Catalog health (64 fields)').count() === 1 && await p.locator('text=No problems found').count() === 1);
    ok('daily chart rendered', await p.locator('svg.recharts-surface').count() >= 1);
    const html = await p.content();
    ok('no candidate content on the page', !/I would explain|Hello, and welcome/.test(html));
    await p.screenshot({ path: `${S}/shots/admin.png`, fullPage: true });
    // 1) the only user is the admin: erasing yourself must be refused
    await p.getByRole('button', { name: /^Erase data for user/ }).first().click();
    await p.getByRole('button', { name: 'Yes, erase' }).click();
    await p.waitForSelector("text=can't erase their own data");
    ok('admin cannot erase their own data', true);
    await p.getByRole('button', { name: 'Cancel' }).click();
    // 2) hand the interview to a different user, then erase that user
    require('child_process').execFileSync('python3', ['-c', `import sqlite3; c=sqlite3.connect('/tmp/e2e.db'); c.execute("insert into user_profiles(id,role,preferred_language,created_at) values('99999999-aaaa-4aaa-8aaa-999999999999','user','en','2030-01-01 00:00:00')"); c.execute("update interview_sessions set user_id='99999999-aaaa-4aaa-8aaa-999999999999'"); c.commit()`]);
    await p.reload(); await p.waitForSelector('text=Catalog health');
    await p.getByRole('button', { name: /^Erase data for user 99999999/ }).click();
    await p.getByRole('button', { name: 'Yes, erase' }).click();
    await p.waitForSelector('text=Erased 1 interviews');
    ok('erasing another user works and explains the Supabase login remains', await p.locator('text=still exists in Supabase').count() === 1);
    await p.waitForFunction(() => !document.getElementById('usr').parentElement.innerText.includes('99999999'));
    ok('erased user disappears from the users table', true);
    ok('the erase is recorded in the audit log', await p.locator('#aud').locator('xpath=..').locator('text=erase_user_data').count() >= 1);
  }
  ok('no page errors', errs.length === 0);
  await br.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
