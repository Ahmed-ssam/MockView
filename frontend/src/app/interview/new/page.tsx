"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { KeyBanner } from "@/components/KeyBanner";
import { SpecializationStep } from "@/components/interview/SpecializationStep";
import { ConfigStep } from "@/components/interview/ConfigStep";
import { InterviewerStep } from "@/components/interview/InterviewerStep";
import { DEFAULT_CONFIG, interviewConfigSchema, type InterviewConfig } from "@/lib/interviewConfig";
import { voiceSupport } from "@/lib/voice";
import { Faces } from "@/components/panels";
import { InterviewScene } from "@/components/art";

type Draft = Partial<InterviewConfig>;
type Persisted = { step: 1 | 2 | 3; draft: Draft; specializationName?: string };
const KEY = "mockview:new-interview";

function load(): Persisted | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null; // storage can be unavailable; the wizard works without it
  }
}

export default function NewInterviewPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<Draft>({ ...DEFAULT_CONFIG });
  const [specName, setSpecName] = useState<string | undefined>();
  const [errors, setErrors] = useState<Partial<Record<keyof InterviewConfig, string>>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = load();
    if (saved) {
      setStep(saved.step);
      setDraft({ ...DEFAULT_CONFIG, ...saved.draft });
      setSpecName(saved.specializationName);
    } else {
      // A spoken interview is the default whenever this browser can both speak and listen.
      const v = voiceSupport();
      if (v.stt && v.tts) setDraft((d) => ({ ...d, mode: "voice" }));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ step, draft, specializationName: specName } satisfies Persisted));
    } catch { /* ignore */ }
  }, [ready, step, draft, specName]);

  const set = useCallback((patch: Draft) => {
    setDraft((d) => ({ ...d, ...patch }));
    // Clear a field's validation message as soon as the user changes that field.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as (keyof InterviewConfig)[]) delete next[k];
      return next;
    });
  }, []);

  function goToInterviewer() {
    const parsed = interviewConfigSchema.safeParse(draft);
    if (!parsed.success) {
      const e: Partial<Record<keyof InterviewConfig, string>> = {};
      for (const issue of parsed.error.issues) e[issue.path[0] as keyof InterviewConfig] ??= issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    setStep(3);
    window.scrollTo({ top: 0 });
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/"><Logo variant="compact" /></Link>
          <nav aria-label="Progress">
            <ol className="flex items-center gap-2 text-xs text-navy/70 sm:gap-4 sm:text-sm">
              {["Field", "Configuration", "Interviewer"].map((label, i) => (
                <li key={label} aria-current={step === i + 1 ? "step" : undefined}
                  className={step === i + 1 ? "font-semibold text-navy" : ""}>
                  {i + 1}. {label}
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-4"><KeyBanner /></div>
        <div className="relative mb-6 flex items-center justify-between gap-6 overflow-hidden rounded-card bg-navy px-6 py-5 text-cream">
          <div>
            <p className="font-serif text-2xl">{step === 1 ? "What are you interviewing for?" : step === 2 ? "Set the scene" : "Meet your interviewer"}</p>
            <p className="mt-1 max-w-md text-sm text-cream/80">{step === 1 ? "Pick the specialization your questions will come from." : step === 2 ? "Level, difficulty and optional resume or job description shape the questions." : "Each interviewer has a different style and voice."}</p>
            <div className="mt-3"><Faces size={40} /></div>
          </div>
          <InterviewScene className="hidden h-28 w-auto shrink-0 sm:block" />
        </div>
        {step === 1 && (
          <SpecializationStep
            selectedSlug={draft.specialization_slug}
            onSelect={(s) => { set({ specialization_slug: s.slug }); setSpecName(s.name); }}
            onNext={() => { setStep(2); window.scrollTo({ top: 0 }); }}
          />
        )}
        {step === 2 && (
          <ConfigStep draft={draft} set={set} errors={errors}
            onBack={() => setStep(1)} onNext={goToInterviewer} />
        )}
        {step === 3 && (
          <InterviewerStep draft={draft} set={set} specializationName={specName} onBack={() => setStep(2)} />
        )}
      </main>
    </div>
  );
}
