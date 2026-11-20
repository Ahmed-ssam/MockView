"use client";

import { useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import { checkMicrophone, useSpeaker, voiceSupport, VOICE_MESSAGES, type Gender, type Lang } from "@/lib/voice";
import { VoicePicker } from "./VoicePicker";

const TEST_LINE = { en: "Hello! Can you hear me clearly?", ar: "مرحباً! هل تسمعني بوضوح؟" };

/** Waiting room shown before a spoken interview: consent, microphone check, sound test, then join. */
export function JoinGate({ role, avatarUrl, lang, voiceGender, onJoin, onUseTyping }: {
  role: string; avatarUrl: string; lang: Lang; voiceGender: Gender;
  onJoin: () => void; onUseTyping: () => void;
}) {
  const support = voiceSupport();
  const speaker = useSpeaker(lang, voiceGender);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(
    support.stt ? null : VOICE_MESSAGES.unsupported);

  async function join() {
    setChecking(true);
    setProblem(null);
    const mic = await checkMicrophone();
    setChecking(false);
    if (mic === "ok") return onJoin();
    setProblem(mic === "none" ? VOICE_MESSAGES.noMic : mic === "unsupported" ? VOICE_MESSAGES.unsupported : VOICE_MESSAGES.denied);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-10">
      <div className="card w-full p-7 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" width={96} height={96} className="mx-auto h-24 w-24 rounded-full" />
        <h1 className="mt-4 font-serif text-2xl">Your interviewer is ready to meet you</h1>
        <p className="mt-1 text-sm text-navy/70">{role}</p>

        <ul className="mt-6 space-y-2 text-left text-sm text-navy/80">
          <li className="flex gap-2"><Mic size={16} className="mt-0.5 shrink-0 text-slate-blue" aria-hidden />
            <span>You'll answer out loud. Find a quiet spot and allow microphone access when asked.</span></li>
          <li className="flex gap-2"><Volume2 size={16} className="mt-0.5 shrink-0 text-slate-blue" aria-hidden />
            <span>The interviewer speaks, and everything is also shown as text. You can review and edit your transcript before sending it.</span></li>
        </ul>

        <p className="mt-5 rounded-control border border-border bg-cream p-3 text-left text-xs text-navy/75">
          <strong>Privacy:</strong> your browser's speech service turns your voice into text (in Chrome this is a Google
          service; Safari and Edge use Apple and Microsoft). MockView does not record or store audio. Only the text of
          your answers is saved. Joining means you agree to this. You can choose typing instead.
        </p>

        {support.tts && (
          <VoicePicker lang={lang} defaultGender={voiceGender} speaking={speaker.speaking}
            onPreview={() => speaker.speak([TEST_LINE[lang]])} />
        )}
        {speaker.noVoice && (
          <p className="mt-2 text-xs text-navy/75">
            No {lang === "ar" ? "Arabic" : ""} voice is installed on this device, so the interviewer's words will appear as text only.
          </p>
        )}
        {!support.tts && (
          <p className="mt-3 text-xs text-navy/75">This browser can't speak aloud, so the interviewer's words will appear as text only.</p>
        )}

        {problem && (
          <p role="alert" className="mt-4 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-left text-sm text-danger">{problem}</p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {support.stt && (
            <button type="button" onClick={join} disabled={checking} className="btn-cta justify-center disabled:opacity-60">
              <Mic size={16} aria-hidden /> {checking ? "Checking microphone…" : problem ? "Try again" : "Join interview"}
            </button>
          )}
          <button type="button" onClick={onUseTyping} className="btn-outline justify-center">Use typing instead</button>
        </div>
      </div>
    </main>
  );
}
