"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Mic, RotateCcw, Send, SkipForward, Square, Volume2, VolumeX, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { JoinGate } from "@/components/room/JoinGate";
import { VoicePicker } from "@/components/room/VoicePicker";
import { api, ApiError, type InterviewView } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useDictation, useSpeaker, voiceSupport } from "@/lib/voice";

const MAX = 6000;

function parseUtc(ts: string): number {
  // SQLite returns timestamps without an offset; treat those as UTC.
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`).getTime();
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function InterviewRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [view, setView] = useState<InterviewView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [joined, setJoined] = useState(false);
  const [textOnly, setTextOnly] = useState(false); // candidate chose typing instead of voice
  const [voiceOn, setVoiceOn] = useState(true); // interviewer's voice on/off
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const spokenRef = useRef(0); // how many messages have already been spoken
  const answerRef = useRef("");
  answerRef.current = answer;

  const lang = view?.language ?? "en";
  const speaker = useSpeaker(lang, view?.interviewer.voice_gender);
  const dictation = useDictation(lang, (text) => { setAnswer(text); setUsedVoice(true); });

  const voiceMode = !!view && view.mode !== "text" && !textOnly;
  const micAvailable = voiceMode && voiceSupport().stt;

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return router.replace(`/login?next=/interview/${id}`);
    try {
      setView(await api.interview(id, token));
    } catch (e) {
      setLoadError(e instanceof ApiError ? (e.status === 404 ? "We couldn't find this interview." : e.message) : "Something went wrong.");
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  // The interviewer speaks every new message of theirs, in order (captions always stay in the log).
  useEffect(() => {
    if (!view || !joined || !voiceMode) return;
    const fresh = view.messages.slice(spokenRef.current).filter((m) => m.role === "interviewer").map((m) => m.text);
    spokenRef.current = view.messages.length;
    if (voiceOn && fresh.length) speaker.speak(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.messages.length, joined, voiceMode, voiceOn]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [view?.messages.length, submitting, answer]);

  useEffect(() => {
    if (!showTimer || !view) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - parseUtc(view.started_at)) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [showTimer, view]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (confirmEnd && !d.open) d.showModal();
    if (!confirmEnd && d.open) d.close();
  }, [confirmEnd]);

  function handleJoin() {
    if (view) spokenRef.current = view.messages.map((m) => m.role).lastIndexOf("candidate") + 1; // only speak what's pending
    setJoined(true);
  }

  function toggleMic() {
    if (dictation.listening) return void dictation.stop();
    speaker.cancel();
    dictation.start(answerRef.current);
  }

  async function send(skipped: boolean) {
    if (!view || submitting) return;
    if (dictation.listening || dictation.busy) {
      await dictation.stop();                          // desktop app: waits for the transcription
      await new Promise((r) => setTimeout(r, 350));    // let the last words arrive
    }
    speaker.cancel();
    const text = answerRef.current;
    if (!skipped && !text.trim()) return setSubmitError("Say or type your answer, or choose Skip.");
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getAccessToken();
      if (!token) return router.replace(`/login?next=/interview/${id}`);
      await api.submitAnswer(id, { text: skipped ? "" : text, skipped, source: usedVoice ? "voice" : "text" }, token);
      setAnswer("");
      setUsedVoice(false);
      dictation.clearError();
      setView(await api.interview(id, token));
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      // The server stores nothing on failure, so the answer stays and can be sent again safely.
      setSubmitError(e instanceof ApiError ? e.message : "Something went wrong. Your answer is still here; please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  async function finishInterview() {
    setFinishError(null);
    setFinishing(true);
    try {
      const token = await getAccessToken();
      if (!token) return router.replace(`/login?next=/interview/${id}`);
      await api.finishInterview(id, token);
      router.push(`/interview/${id}/report`);
    } catch (e) {
      setFinishError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setFinishing(false);
    }
  }

  async function endInterview() {
    speaker.cancel();
    dictation.stop();
    const token = await getAccessToken();
    try {
      if (token) await api.abandonInterview(id, token);
    } catch { /* leaving anyway */ }
    router.push("/dashboard");
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 className="font-serif text-2xl">{loadError}</h1>
        <Link href="/dashboard" className="btn-outline mt-6">Back to dashboard</Link>
      </main>
    );
  }
  if (!view) return <p className="p-8 text-sm text-navy/70">Loading your interview…</p>;

  const live = view.status === "in_progress";

  if (live && voiceMode && !joined) {
    return (
      <JoinGate role={view.interviewer.role_title}
        avatarUrl={view.interviewer.avatar_url} lang={view.language} voiceGender={view.interviewer.voice_gender}
        onJoin={handleJoin} onUseTyping={() => setTextOnly(true)} />
    );
  }

  const q = view.current_question;
  const dir = view.language === "ar" ? "rtl" : "ltr";
  const pct = Math.round((view.progress.answered_main / view.progress.total_main) * 100);
  const showTextbox = !micAvailable || view.mode === "both" || answer.length > 0 || dictation.listening || !!dictation.error;
  const status = submitting ? "Answer sent" : speaker.speaking ? "Listening to your interviewer"
    : dictation.busy ? "Transcribing your answer" : dictation.listening ? "Recording your answer" : live ? "Your turn" : "Finished";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy text-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo variant="compact" tone="dark" />
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={() => setShowTimer((v) => !v)} aria-pressed={showTimer}
              className="inline-flex items-center gap-1.5 text-cream/85 hover:text-cream">
              <Clock size={16} aria-hidden />
              {showTimer ? `${fmt(elapsed)}${view.duration_min ? ` / ${view.duration_min}:00` : ""}` : "Show timer"}
            </button>
            {live && (
              <button type="button" onClick={() => setConfirmEnd(true)}
                className="inline-flex items-center gap-1.5 rounded-control border border-cream/50 px-3 py-1.5 hover:bg-cream hover:text-navy">
                <X size={16} aria-hidden /> End interview
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-5 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4" aria-label="Interviewer">
          <div className="card p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.interviewer.avatar_url} alt="" width={96} height={96}
              className={`mx-auto h-24 w-24 rounded-full ${speaker.speaking ? "ring-4 ring-sand" : ""}`} />
            <p className="mt-3 font-medium">{view.interviewer.role_title}</p>
            <p className="mt-2 chip">{view.interviewer.personality}</p>
            <p role="status" className="mt-3 min-h-4 text-xs text-navy/70">
              {speaker.speaking ? "Your interviewer is speaking…" : ""}
            </p>
          </div>
          <div className="card p-5 text-sm">
            <p className="font-medium">{view.specialization_name}</p>
            <p className="mt-0.5 text-xs capitalize text-navy/75">{view.level} · {view.difficulty}</p>
            <div className="mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={view.progress.answered_main}
              aria-label="Interview progress">
              <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full bg-slate-blue transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <p className="mt-2 text-xs text-navy/70">
              {view.progress.answered_main} of {view.progress.total_main} main questions answered
            </p>
            <p className="mt-3 text-xs text-navy/75">Candidate status: {status}</p>
          </div>
          {voiceMode && view.interviewer && (
            <details className="rounded-control border border-border bg-white p-3 text-sm">
              <summary className="cursor-pointer font-medium">Change interviewer voice</summary>
              <VoicePicker lang={lang} defaultGender={view.interviewer.voice_gender} speaking={speaker.speaking}
                onPreview={() => speaker.speak([lang === "ar" ? "مرحباً! هل تسمعني بوضوح؟" : "Hello! Can you hear me clearly?"])} />
            </details>
          )}
          {speaker.noVoice && (
            <p className="rounded-control border border-border bg-white p-3 text-xs text-navy/75">
              No {view.language === "ar" ? "Arabic " : ""}voice is installed on this device, so the interviewer's words appear as text only.
            </p>
          )}
          {view.demo_mode && (
            <p className="rounded-control border border-sand-dark/60 bg-sand/40 p-3 text-xs">
              <strong>Demo mode.</strong> No AI provider is configured. Questions are templates and feedback is simulated, so don't treat it as real.
            </p>
          )}
        </aside>

        <section className="flex min-h-[28rem] flex-col" aria-label="Interview conversation">
          {q && live && (
            <h1 className="mb-3 font-serif text-xl">
              {q.kind === "intro" ? "Introduction" : `Question ${q.position} of ${view.progress.total_main}`}
              {q.is_followup && <span className="ml-2 chip align-middle">Follow-up</span>}
            </h1>
          )}

          <div ref={logRef} role="log" aria-live="polite" aria-label="Conversation history" dir={dir}
            className="card flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "50vh" }}>
            {view.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-2.5 text-sm ${
                  m.role === "candidate" ? "bg-sand/50" : "bg-navy text-cream"}`}>
                  <span className="sr-only">{m.role === "candidate" ? "You: " : "Interviewer: "}</span>
                  {m.text}
                </div>
              </div>
            ))}
            {submitting && <p role="status" className="text-xs text-navy/75">Your interviewer is thinking…</p>}
          </div>

          {live && !view.ready_to_finish && q && (
            <form className="mt-4" onSubmit={(e) => { e.preventDefault(); void send(false); }}>
              {micAvailable && (
                <div className="mb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={toggleMic} disabled={speaker.speaking || submitting || dictation.busy}
                      aria-pressed={dictation.listening}
                      className={`inline-flex items-center gap-2 rounded-control px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        dictation.listening ? "bg-danger text-white hover:opacity-90" : "bg-sand text-navy hover:bg-sand-dark"}`}>
                      {dictation.listening ? <><Square size={16} aria-hidden /> Stop recording</>
                        : <><Mic size={16} aria-hidden /> {answer ? "Continue answering" : "Start answering"}</>}
                    </button>
                    {speaker.speaking && (
                      <button type="button" onClick={speaker.cancel} className="btn-outline">Skip audio</button>
                    )}
                    <button type="button" onClick={() => speaker.speak([q.text])}
                      disabled={speaker.speaking || dictation.listening || !voiceOn} className="btn-outline disabled:opacity-50">
                      <RotateCcw size={16} aria-hidden /> Repeat question
                    </button>
                    <button type="button" onClick={() => { speaker.cancel(); setVoiceOn((v) => !v); }} aria-pressed={!voiceOn}
                      className="btn-outline">
                      {voiceOn ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
                      {voiceOn ? "Mute interviewer" : "Unmute interviewer"}
                    </button>
                  </div>
                  <p role="status" className="mt-2 text-xs text-navy/70">
                    {dictation.busy ? "Transcribing your answer…"
                      : dictation.listening
                      ? <><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-danger align-middle" aria-hidden />Recording. Speak naturally, then press Stop when you're done.</>
                      : speaker.speaking ? "Listen to the interviewer, then press Start answering. Press Skip audio to cut them short."
                      : answer ? "Review the text below and fix anything misheard before sending."
                      : "Press Start answering and speak. You can review and edit the text before sending."}
                  </p>
                </div>
              )}

              {showTextbox && (
                <>
                  <label htmlFor="answer" className="mb-1.5 block text-sm font-medium">
                    {micAvailable ? "Your answer (transcript, you can edit it)" : "Your answer"}
                  </label>
                  <textarea id="answer" ref={inputRef} rows={5} dir={dir} value={answer} maxLength={MAX}
                    disabled={submitting} readOnly={dictation.listening || dictation.busy}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void send(false); } }}
                    className="w-full rounded-control border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-blue focus:ring-2 focus:ring-soft-blue/50 disabled:opacity-60 read-only:bg-cream"
                    placeholder={micAvailable ? "Your spoken answer appears here" : "Type your answer. Ctrl+Enter to submit."} />
                  <p className="mt-1 text-xs text-navy/75">{answer.length} / {MAX}</p>
                </>
              )}

              {dictation.error && (
                <p role="alert" className="mt-2 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{dictation.error}</p>
              )}
              {submitError && (
                <p role="alert" className="mt-2 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{submitError}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="submit" disabled={submitting || dictation.busy} className="btn-primary disabled:cursor-wait disabled:opacity-60">
                  <Send size={16} aria-hidden /> {submitting ? "Sending…" : "Send answer"}
                </button>
                {answer && !dictation.listening && (
                  <button type="button" disabled={submitting} onClick={() => { setAnswer(""); setUsedVoice(false); }}
                    className="btn-outline">Clear and re-record</button>
                )}
                <button type="button" disabled={submitting} onClick={() => void send(true)} className="btn-outline disabled:opacity-60">
                  <SkipForward size={16} aria-hidden /> {q.kind === "intro" ? "Skip introduction" : "Skip question"}
                </button>
              </div>
            </form>
          )}

          {live && view.ready_to_finish && (
            <div className="card mt-4 p-6 text-center">
              <h2 className="font-serif text-xl">Interview complete</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-navy/75">
                All 10 questions are answered and saved. Generate your report to see your scores, radar chart and study plan.
              </p>
              {finishError && <p role="alert" className="mt-3 text-sm text-danger">{finishError}</p>}
              <button type="button" onClick={finishInterview} disabled={finishing}
                className="btn-cta mt-4 disabled:cursor-wait disabled:opacity-60">
                {finishing ? "Building your report…" : "View my report"}
              </button>
              <Link href="/dashboard" className="btn-outline mt-4">Back to dashboard</Link>
            </div>
          )}

          {!live && (
            <div className="card mt-4 p-6 text-center">
              <h2 className="font-serif text-xl">This interview has ended</h2>
              {view.status === "completed" && <Link href={`/interview/${id}/report`} className="btn-cta mt-4 mr-2">View report</Link>}
              <Link href="/interview/new" className="btn-primary mt-4">Start a new interview</Link>
            </div>
          )}
        </section>
      </main>

      <dialog ref={dialogRef} onClose={() => setConfirmEnd(false)} aria-labelledby="end-title"
        className="rounded-card border border-border p-6 backdrop:bg-navy/50">
        <h2 id="end-title" className="font-serif text-xl">End this interview?</h2>
        <p className="mt-2 max-w-sm text-sm text-navy/75">Your progress is saved, but you won't be able to continue this interview.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" autoFocus onClick={() => setConfirmEnd(false)} className="btn-outline">Keep going</button>
          <button type="button" onClick={endInterview} className="btn-primary">End interview</button>
        </div>
      </dialog>
    </div>
  );
}
