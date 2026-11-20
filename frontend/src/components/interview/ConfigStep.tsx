"use client";

import { useEffect, useState } from "react";
import { DIFFICULTIES, DURATIONS, LEVELS, type InterviewConfig } from "@/lib/interviewConfig";
import { voiceSupport } from "@/lib/voice";
import { RadioCards } from "./RadioCards";
import { ResumeUpload } from "./ResumeUpload";

type Draft = Partial<InterviewConfig>;
const area =
  "w-full rounded-control border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-blue focus:ring-2 focus:ring-soft-blue/50";

export function ConfigStep({ draft, set, errors, onBack, onNext }: {
  draft: Draft;
  set: (patch: Draft) => void;
  errors: Partial<Record<keyof InterviewConfig, string>>;
  onBack: () => void;
  onNext: () => void;
}) {
  // Detected after mount (browser-only) so server and client markup match.
  const [support, setSupport] = useState<{ stt: boolean; tts: boolean } | null>(null);
  useEffect(() => setSupport(voiceSupport()), []);
  const voiceOk = !!support && support.stt && support.tts;
  const voiceReason = support === null ? "Checking your browser…"
    : !support.stt ? "Your browser can't hear you. Use Chrome, Edge or Safari"
    : "Your browser can't speak aloud";
  return (
    <>
      <h1 className="font-serif text-3xl">Configure your interview</h1>
      <p className="mt-1 text-navy/75">These settings shape the questions and how hard the interviewer pushes.</p>

      <div className="mt-8 max-w-3xl space-y-8">
        <div>
          <RadioCards legend="Professional level" value={draft.level} onChange={(v) => set({ level: v })}
            columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
          {errors.level && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.level}</p>}
        </div>

        <RadioCards legend="Difficulty" value={draft.difficulty} onChange={(v) => set({ difficulty: v })}
          columns="sm:grid-cols-2 lg:grid-cols-4"
          options={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label, hint: d.hint }))} />

        <div className="grid gap-8 sm:grid-cols-2">
          <RadioCards legend="Interview language" value={draft.language} onChange={(v) => set({ language: v })}
            columns="grid-cols-2"
            options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية (Arabic)" }]} />
          <RadioCards legend="Interview length" value={draft.duration_min} onChange={(v) => set({ duration_min: v })}
            columns="grid-cols-4" options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))} />
        </div>

        <div>
          <RadioCards legend="Interview mode" value={draft.mode} onChange={(v) => set({ mode: v })}
            columns="sm:grid-cols-3"
            options={[
              { value: "voice", label: "Voice (recommended)", hint: "The interviewer speaks and you answer with your microphone",
                disabled: !voiceOk, disabledReason: voiceReason },
              { value: "both", label: "Voice + typing", hint: "Spoken interview, with the typing box always open",
                disabled: !voiceOk, disabledReason: voiceReason },
              { value: "text", label: "Text only", hint: "Read the questions and type your answers" },
            ]} />
          {draft.language === "ar" && draft.mode !== "text" && (
            <p className="mt-2 text-xs text-navy/75">
              Arabic voice depends on the voices installed on your device. If none is available, questions appear as text only.
            </p>
          )}
        </div>

        <fieldset className="rounded-card border border-border bg-white p-5">
          <legend className="px-1 text-sm font-medium">Optional context</legend>
          <p className="mb-4 text-xs text-navy/75">
            Everything here is optional. If you add a resume or job description, it is used to tailor your questions.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="job-title" className="mb-1.5 block text-sm font-medium">Target job title</label>
              <input id="job-title" className={area} maxLength={120} value={draft.target_job_title ?? ""}
                onChange={(e) => set({ target_job_title: e.target.value })} placeholder="e.g. Backend Engineer" />
              {errors.target_job_title && <p role="alert" className="mt-1 text-xs text-danger">{errors.target_job_title}</p>}
            </div>
            <ResumeUpload resumeId={draft.resume_id} onChange={(id) => set({ resume_id: id })} />
            <div>
              <label htmlFor="jd" className="mb-1.5 block text-sm font-medium">Job description</label>
              <textarea id="jd" rows={5} className={area} value={draft.job_description ?? ""}
                onChange={(e) => set({ job_description: e.target.value })} placeholder="Paste the job posting here" />
              <p className="mt-1 text-xs text-navy/75">{(draft.job_description ?? "").length} / 8000</p>
              {errors.job_description && <p role="alert" className="text-xs text-danger">{errors.job_description}</p>}
            </div>
            <div>
              <label htmlFor="custom" className="mb-1.5 block text-sm font-medium">Custom instructions</label>
              <textarea id="custom" rows={3} className={area} value={draft.custom_instructions ?? ""}
                onChange={(e) => set({ custom_instructions: e.target.value })}
                placeholder="e.g. Focus on API design and testing" />
              <p className="mt-1 text-xs text-navy/75">{(draft.custom_instructions ?? "").length} / 1000</p>
              {errors.custom_instructions && <p role="alert" className="text-xs text-danger">{errors.custom_instructions}</p>}
            </div>
          </div>
        </fieldset>

        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="btn-outline">Back</button>
          <button type="button" onClick={onNext} className="btn-primary">Continue to interviewer</button>
        </div>
      </div>
    </>
  );
}
