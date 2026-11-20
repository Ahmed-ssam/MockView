"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type Avatar, type ExperienceLevel, type Personality } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { authConfigured } from "@/lib/supabase";
import { DIFFICULTIES, LEVELS, interviewConfigSchema, type InterviewConfig } from "@/lib/interviewConfig";
import { RadioCards } from "./RadioCards";

type Draft = Partial<InterviewConfig>;

export function InterviewerStep({ draft, set, specializationName, onBack }: {
  draft: Draft; set: (patch: Draft) => void; specializationName: string | undefined; onBack: () => void;
}) {
  const [data, setData] = useState<{ p: Personality[]; e: ExperienceLevel[]; a: Avatar[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function start() {
    setStartError(null);
    const parsed = interviewConfigSchema.safeParse(draft);
    if (!parsed.success) return setStartError("Some settings are missing. Go back and check the configuration step.");
    const token = await getAccessToken();
    if (!token) {
      // The draft is already saved for this tab; offer a login link that returns here.
      setNeedsLogin(authConfigured);
      return setStartError(authConfigured
        ? "Please log in to start your interview. Your choices are saved."
        : "Sign-in is not configured on this server, so interviews can't be started yet.");
    }
    setNeedsLogin(false);
    setStarting(true);
    try {
      // Blank optional fields are omitted; the server validates everything again.
      const cfg = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== "" && v !== undefined));
      const view = await api.createInterview(cfg, token);
      try { sessionStorage.removeItem("mockview:new-interview"); } catch { /* ignore */ }
      router.push(`/interview/${view.id}`);
    } catch (e) {
      setStartError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setStarting(false);
    }
  }

  useEffect(() => {
    Promise.all([api.personalities(), api.experienceLevels(), api.avatars()])
      .then(([p, e, a]) => setData({ p, e, a }))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Something went wrong."));
  }, []);

  if (error) return <div role="alert" className="card p-5 text-danger">{error}</div>;
  if (!data) return <p className="text-sm text-navy/70">Loading interviewers…</p>;

  const avatar = data.a.find((a) => a.id === draft.avatar_id) ?? data.a[0];
  const personality = data.p.find((p) => p.key === draft.personality);
  const level = LEVELS.find((l) => l.value === draft.level)?.label;
  const diff = DIFFICULTIES.find((d) => d.value === draft.difficulty)?.label;

  return (
    <>
      <h1 className="font-serif text-3xl">Customize your interviewer</h1>
      <p className="mt-1 text-navy/75">The personality changes how the interviewer actually behaves, not just how it looks.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Appearance</legend>
            <div className="flex flex-wrap gap-4">
              {data.a.map((a) => {
                const id = `avatar-${a.id}`;
                return (
                  <div key={a.id}>
                    <input id={id} type="radio" name="avatar" className="peer sr-only" checked={draft.avatar_id === a.id}
                      onChange={() => set({ avatar_id: a.id })} />
                    <label htmlFor={id}
                      className="block w-28 cursor-pointer rounded-card border border-border bg-white p-2 text-center text-xs transition hover:border-slate-blue
                        peer-checked:border-navy peer-checked:ring-2 peer-checked:ring-navy peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-slate-blue">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.asset_url} alt="" width={96} height={96} className="mx-auto h-24 w-24 rounded-full" />
                      <span className="mt-2 block font-medium">{a.role_title}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <RadioCards legend="Personality" value={draft.personality} onChange={(v) => set({ personality: v })}
            options={data.p.map((p) => ({ value: p.key, label: p.name, hint: `${p.summary} (${p.traits.join(", ")})` }))} />

          <RadioCards legend="Interviewer experience" value={draft.interviewer_experience}
            onChange={(v) => set({ interviewer_experience: v })} columns="sm:grid-cols-3"
            options={data.e.map((e) => ({ value: e.key, label: e.name, hint: e.summary }))} />

          <button type="button" onClick={onBack} className="btn-outline">Back</button>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Interview summary">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar.asset_url} alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
              <div>
                <p className="font-medium">{avatar.role_title}</p>
                <p className="text-xs text-navy/75">{personality?.name}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              {[
                ["Field", specializationName],
                ["Level", level],
                ["Difficulty", diff],
                ["Language", draft.language === "ar" ? "Arabic" : "English"],
                ["Length", `${draft.duration_min} min`],
                ["Mode", draft.mode === "voice" ? "Spoken (microphone)" : draft.mode === "both" ? "Spoken + typing" : "Text only"],
                ["Questions", "10 main questions plus follow-ups"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-navy/75">{k}</dt><dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {startError && (
              <p role="alert" className="mt-4 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
                {startError}{" "}
                {needsLogin && <Link href="/login?next=/interview/new" className="font-medium underline">Log in</Link>}
              </p>
            )}
            <button type="button" onClick={start} disabled={starting}
              className="btn-cta mt-5 w-full justify-center disabled:cursor-wait disabled:opacity-60">
              {starting ? "Preparing your questions…" : "Start interview"}
            </button>
            <p className="mt-2 text-xs text-navy/75">
              Your questions are prepared before the interview begins, which can take a few seconds.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
