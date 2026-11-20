const { chromium } = require('playwright');
const out = (process.env.E2E_OUT || '/tmp/mockview-e2e') + '/shots';
const BASE = 'http://localhost:3000';
let fails = 0;
const ok = (name, cond) => { if (!cond) fails++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); };

// Scripted browser speech features (the sandbox has no audio hardware).
function installMocks(o) {
  window.__spoken = []; window.__recStarts = 0; window.__transcript = 'I would explain the core idea with a concrete example and the main trade-offs.';
  window.__mic = o.mic; // 'ok' | 'denied' | 'none'
  if (o.tts) {
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    const synth = {
      getVoices: () => o.voices, addEventListener() {}, removeEventListener() {}, cancel() {},
      speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20); },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  } else { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); }
  if (o.stt) {
    class R {
      start() {
        window.__recStarts++;
        if (o.recError) { setTimeout(() => this.onerror && this.onerror({ error: o.recError }), 50); return; }
        const emit = (text, fin) => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: fin })] });
        this.a = setTimeout(() => emit(window.__transcript.slice(0, 12), false), 40);
        this.b = setTimeout(() => emit(window.__transcript, true), 120);
      }
      stop() { clearTimeout(this.a); setTimeout(() => this.onend && this.onend(), 20); }
      abort() { clearTimeout(this.a); clearTimeout(this.b); }
    }
    window.webkitSpeechRecognition = R; window.SpeechRecognition = R;
  } else { window.webkitSpeechRecognition = undefined; window.SpeechRecognition = undefined; }
  navigator.mediaDevices.getUserMedia = async () => {
    if (window.__mic === 'denied') throw new DOMException('no', 'NotAllowedError');
    if (window.__mic === 'none') throw new DOMException('no', 'NotFoundError');
    return { getTracks: () => [{ stop() {} }] };
  };
}
const defaults = { tts: true, stt: true, mic: 'ok', voices: [{ lang: 'en-US', name: 'Mock' }], recError: null };

async function newPage(b, opts = {}, viewport = { width: 1280, height: 900 }) {
  const ctx = await b.newContext({ viewport });
  await ctx.addInitScript(installMocks, { ...defaults, ...opts });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(String(e)));
  return p;
}
async function login(p) {
  await p.goto(BASE + '/login'); await p.fill('#email', 'tester@example.com'); await p.fill('#password', 'correct-horse-1');
  await p.click('button[type=submit]'); await p.waitForURL('**/dashboard');
}
async function wizard(p, { spec = 'Web Development', level = 'Junior', persona = 'Friendly Interviewer', arabic = false } = {}) {
  await p.goto(BASE + '/interview/new'); await p.waitForSelector('section[aria-live] button');
  await p.locator('section[aria-live] button', { hasText: new RegExp('^' + spec) }).first().click();
  await p.getByRole('button', { name: 'Continue to configuration' }).click();
  await p.locator('label').filter({ hasText: new RegExp('^' + level + '$') }).click();
  if (arabic) await p.locator('label').filter({ hasText: /^العربية/ }).click();
  await p.getByRole('button', { name: 'Continue to interviewer' }).click();
  await p.locator('label').filter({ hasText: new RegExp('^' + persona) }).click();
}
const spoken = p => p.evaluate(() => window.__spoken.slice());
async function speakAnswer(p, text, { edit } = {}) {
  await p.evaluate(t => { window.__transcript = t; }, text);
  await p.getByRole('button', { name: /Start answering|Continue answering/ }).click();
  await p.waitForFunction(t => document.querySelector('#answer')?.value === t, text, { timeout: 5000 });
  await p.getByRole('button', { name: 'Stop recording' }).click();
  if (edit) await p.fill('#answer', text + edit);
  await p.getByRole('button', { name: 'Send answer' }).click();
  await p.waitForFunction(() => !document.body.innerText.includes('is thinking'), null, { timeout: 15000 });
}

(async () => {
  const b = await chromium.launch();

  // ============ main spoken flow ============
  let p = await newPage(b); await login(p);
  await wizard(p);
  ok('voice is the default mode when the browser supports it (summary shows spoken mode)', await p.locator('aside[aria-label="Interview summary"]').innerText().then(t => t.includes('Spoken (microphone)')));
  await p.getByRole('button', { name: 'Start interview' }).click();
  await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/); const iid = p.url().split('/').pop();

  await p.waitForSelector('text=is ready to meet you');
  ok('join gate shown before any audio plays', (await spoken(p)).length === 0);
  ok('privacy notice names the speech service and says no audio is stored', await p.locator('main').innerText().then(t => /Google/.test(t) && /does not record or store audio/.test(t)));
  await p.screenshot({ path: `${out}/voice-join.png`, fullPage: true });
  await p.getByRole('button', { name: 'Preview voice' }).click(); await p.waitForTimeout(300);
  ok('Preview voice speaks a sample line', (await spoken(p)).some(t => t.includes('Can you hear me')));
  await p.getByRole('button', { name: 'Join interview' }).click();
  await p.waitForSelector('h1:has-text("Introduction")');
  await p.waitForFunction(() => window.__spoken.some(t => t.includes('tell me a little about yourself')));
  const s1 = await spoken(p);
  const iWelcome = s1.findIndex(t => t.includes('welcome')), iAsk = s1.findIndex(t => t.includes('tell me a little about yourself'));
  ok('interviewer speaks the warm welcome, then asks you to introduce yourself (in that order)', iWelcome >= 0 && iAsk > iWelcome);
  ok('welcome is warm and explains the structure', /nice to meet you/.test(s1.join(' ')) && /10 main questions/.test(s1.join(' ')));
  ok('mic button offered, typing box hidden in voice mode until needed', await p.getByRole('button', { name: 'Start answering' }).count() === 1 && await p.locator('#answer').count() === 0);

  // introduction answered by voice, with a manual edit
  await speakAnswer(p, 'I am a web developer with four years of experience building React and Node applications.', { edit: ' I also mentor juniors.' });
  await p.waitForSelector('h1:has-text("Question 1 of 10")');
  ok('after the introduction the first main question starts', true);
  ok('introduction does not count toward the 10', await p.locator('text=0 of 10 main questions answered').count() === 1);
  await p.waitForFunction(() => window.__spoken.some(t => /^Question number|^In Web Development|explain what/i.test(t)));
  const s2 = await spoken(p);
  ok('interviewer speaks a warm reply to the introduction, then the first question', s2.some(t => /Thank you for sharing/.test(t)) && s2.length > s1.length);
  ok('edited transcript is what was sent', await p.locator('[role=log]').innerText().then(t => t.includes('I also mentor juniors.')));
  await p.screenshot({ path: `${out}/voice-room-q1.png`, fullPage: true });

  // controls: repeat, mute, mic denied mid-way is covered elsewhere
  const before = (await spoken(p)).length;
  await p.getByRole('button', { name: 'Repeat question' }).click(); await p.waitForTimeout(300);
  ok('Repeat question speaks the current question again', (await spoken(p)).length === before + 1);
  await p.getByRole('button', { name: 'Mute interviewer' }).click();
  ok('mute toggles to Unmute', await p.getByRole('button', { name: 'Unmute interviewer' }).count() === 1);
  const mutedBefore = (await spoken(p)).length;
  await speakAnswer(p, 'It depends on the use case, but I would start with requirements and measure first.');
  await p.waitForTimeout(300);
  ok('muted interviewer stays silent but captions still appear', (await spoken(p)).length === mutedBefore && await p.locator('[role=log]').innerText().then(t => t.includes('measure first')));
  await p.getByRole('button', { name: 'Unmute interviewer' }).click();

  // finish all 10 mains by voice
  let turns = 2, guard = 0;
  while (!(await p.locator('text=Interview complete').count()) && guard++ < 25) {
    await speakAnswer(p, 'I would explain the core idea with a concrete example and discuss security, caching and testing trade-offs in detail.'); turns++;
  }
  await p.waitForSelector('text=Interview complete');
  ok('10 of 10 main questions answered by voice', await p.locator('text=10 of 10 main questions answered').count() === 1);
  await p.waitForFunction(() => window.__spoken.some(t => /last question/.test(t)), null, { timeout: 4000 }).catch(() => {});
  ok('closing line was spoken', (await spoken(p)).some(t => /last question/.test(t)));
  ok('microphone starts were user-initiated (one per answer)', (await p.evaluate(() => window.__recStarts)) >= turns - 1);
  await p.screenshot({ path: `${out}/voice-complete.png`, fullPage: true });
  ok('no page errors in main flow', p.errs.length === 0);

  // ============ report ============
  await p.getByRole('button', { name: 'View my report' }).click();
  await p.waitForURL(/\/report$/); await p.waitForSelector('text=Interview report');
  for (const n of ['Overall result','Skills radar','Skill evaluations','Strengths','Areas to improve','Coach summary','Recommendations','Learning roadmap','Question-by-question review'])
    ok('report section: ' + n, await p.locator('h2', { hasText: n }).count() === 1);
  ok('radar chart rendered', await p.locator('svg.recharts-surface').count() >= 1);
  ok('demo banner shown on demo report', await p.locator('text=Demo mode.').count() >= 1);
  ok('10 question reviews', await p.locator('details summary').count() === 10);
  await p.screenshot({ path: `${out}/report.png`, fullPage: true });
  ok('no page errors on report', p.errs.length === 0);

  // ============ reload mid-interview: no re-greeting ============
  p = await newPage(b); await login(p); await wizard(p, { persona: 'Strict Interviewer' });
  await p.getByRole('button', { name: 'Start interview' }).click(); await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/);
  await p.getByRole('button', { name: 'Join interview' }).click(); await p.waitForSelector('h1:has-text("Introduction")');
  await speakAnswer(p, 'I work in cybersecurity and web development.'); await p.waitForSelector('h1:has-text("Question 1 of 10")');
  await p.reload(); await p.waitForSelector('text=is ready to meet you');
  await p.getByRole('button', { name: 'Join interview' }).click(); await p.waitForSelector('h1:has-text("Question 1 of 10")');
  await p.waitForFunction(() => window.__spoken.length > 0);
  const s3 = await spoken(p);
  ok('after reload only the pending question is spoken (not the welcome again)', !s3.some(t => /welcome/i.test(t)) && s3.length >= 1);

  // ============ failure paths ============
  p = await newPage(b, { mic: 'denied' }); await login(p); await wizard(p);
  await p.getByRole('button', { name: 'Start interview' }).click(); await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/);
  await p.getByRole('button', { name: 'Join interview' }).click();
  await p.waitForSelector('text=Microphone access was blocked');
  ok('denied microphone shows a clear message and no audio plays', (await spoken(p)).length === 0);
  await p.getByRole('button', { name: 'Use typing instead' }).click();
  await p.waitForSelector('h1:has-text("Introduction")');
  ok('typing fallback: textbox shown, no mic button, nothing spoken', await p.locator('#answer').count() === 1 && await p.getByRole('button', { name: 'Start answering' }).count() === 0 && (await spoken(p)).length === 0);
  await p.fill('#answer', 'I typed this introduction instead.'); await p.getByRole('button', { name: 'Send answer' }).click();
  await p.waitForSelector('h1:has-text("Question 1 of 10")');
  ok('typed answers still work in a voice-configured interview', true);

  p = await newPage(b, { recError: 'not-allowed' }); await login(p); await wizard(p);
  await p.getByRole('button', { name: 'Start interview' }).click(); await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/);
  await p.getByRole('button', { name: 'Join interview' }).click(); await p.waitForSelector('h1:has-text("Introduction")');
  await p.getByRole('button', { name: 'Start answering' }).click();
  await p.waitForSelector('text=Microphone access was blocked');
  ok('recognition error shows a message and opens the typing box', await p.locator('#answer').count() === 1 && await p.getByRole('button', { name: 'Start answering' }).count() === 1);

  p = await newPage(b, { stt: false }); await login(p);
  await p.goto(BASE + '/interview/new'); await p.waitForSelector('section[aria-live] button');
  await p.locator('section[aria-live] button').first().click(); await p.getByRole('button', { name: 'Continue to configuration' }).click();
  ok('unsupported browser: voice option disabled with a reason', await p.getByLabel(/^Voice \(recommended\)/).isDisabled() && await p.locator('text=Your browser can\'t hear you').count() > 0);
  ok('unsupported browser: text mode stays selected', await p.getByLabel(/^Text only/).isChecked());

  // ============ Arabic: no Arabic voice installed ============
  p = await newPage(b); await login(p); await wizard(p, { arabic: true });
  await p.getByRole('button', { name: 'Start interview' }).click(); await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/);
  await p.getByRole('button', { name: 'Join interview' }).click(); await p.waitForSelector('text=Introduction');
  await p.waitForSelector('text=No Arabic voice is installed');
  ok('Arabic without an Arabic voice: honest notice, captions only, nothing spoken', (await spoken(p)).length === 0);
  ok('Arabic captions are right-to-left', await p.locator('[role=log]').getAttribute('dir') === 'rtl' && await p.locator('[role=log]').innerText().then(t => /مرحباً/.test(t)));
  await p.screenshot({ path: `${out}/voice-arabic.png`, fullPage: true });

  // ============ mobile ============
  p = await newPage(b, {}, { width: 390, height: 800 }); await login(p); await wizard(p);
  await p.getByRole('button', { name: 'Start interview' }).click(); await p.waitForURL(/\/interview\/[0-9a-f-]{36}$/);
  await p.getByRole('button', { name: 'Join interview' }).click(); await p.waitForSelector('h1:has-text("Introduction")');
  ok('mobile voice room has no horizontal overflow', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.screenshot({ path: `${out}/voice-mobile.png`, fullPage: true });

  await b.close();
  console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('E2E CRASH:', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(2); });
