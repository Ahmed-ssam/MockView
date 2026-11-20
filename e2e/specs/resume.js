const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
const q = (sql) => execFileSync('python3', ['-c', 'import sqlite3,sys; c=sqlite3.connect("/tmp/e2e.db"); [print("|".join(map(str,r))) for r in c.execute(sys.argv[1])]', sql]).toString().trim().split('\n');
const S = (process.env.E2E_OUT || '/tmp/mockview-e2e');
let fails = 0; const ok = (n, c) => { if (!c) fails++; console.log((c ? 'PASS' : 'FAIL') + '  ' + n); };
(async () => {
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 1000 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3000/login'); await p.fill('#email', 't@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.getByRole('button', { name: /log in/i }).click(); await p.waitForURL(/dashboard/);
  await p.goto('http://localhost:3000/interview/new');
  await p.evaluate(() => sessionStorage.setItem('mockview:new-interview', JSON.stringify({ step: 2, specializationName: 'Web Development',
    draft: { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', mode: 'text', duration_min: 30, personality: 'friendly', interviewer_experience: 'experienced', avatar_id: 'alex' } })));
  await p.reload(); await p.waitForSelector('text=Resume (PDF)');
  const file = p.getByLabel('Upload resume PDF');
  await file.setInputFiles(S + '/cv.pdf');
  await p.waitForSelector('text=Please tick the consent box first');
  ok('upload blocked until consent is ticked', true);
  await p.getByRole('checkbox', { name: /I agree that MockView may read/ }).check();
  await file.setInputFiles(S + '/notpdf.pdf');
  await p.waitForSelector('text=Please upload a PDF file');
  ok('non-PDF rejected with a clear message', true);
  await file.setInputFiles(S + '/scan.pdf');
  await p.waitForSelector('text=No readable text was found');
  ok('image-only PDF rejected with a clear message', true);
  await file.setInputFiles(S + '/cv.pdf');
  await p.waitForSelector('text=Resume added');
  ok('valid resume accepted', await p.locator('text=characters read').count() === 1);
  await p.screenshot({ path: S + '/shots/resume.png', fullPage: true });
  await p.getByRole('button', { name: 'Continue to interviewer' }).click();
  await p.getByRole('button', { name: 'Start interview' }).click();
  await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = p.url().split('/').pop();
  const row = [q("select resume_id is not null from interview_sessions where id='" + id + "'")[0], q('select count(*) from uploaded_resumes')[0], q('select storage_path from uploaded_resumes')[0]];
  ok('interview is linked to the resume', row[0] === '1');
  ok('exactly one resume stored, and the file itself is not', row[1] === '1' && row[2] === 'not-stored');
  // remove flow
  await p.goto('http://localhost:3000/interview/new');
  await p.evaluate(() => sessionStorage.setItem('mockview:new-interview', JSON.stringify({ step: 2, specializationName: 'Web Development',
    draft: { specialization_slug: 'web-development', level: 'junior', difficulty: 'adaptive', language: 'en', mode: 'text', duration_min: 30, personality: 'friendly', interviewer_experience: 'experienced', avatar_id: 'alex' } })));
  await p.reload(); await p.getByRole('checkbox', { name: /I agree/ }).check();
  await p.getByLabel('Upload resume PDF').setInputFiles(S + '/cv.pdf'); await p.waitForSelector('text=Resume added');
  await p.getByRole('button', { name: /Remove and delete/ }).click(); await p.getByLabel('Upload resume PDF').waitFor({ state: 'attached' });
  const left = q('select count(*) from uploaded_resumes')[0];
  ok('removing deletes the stored text (only the first resume remains)', left === '1');
  ok('no page errors', errs.length === 0);
  await br.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL CHECKS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
