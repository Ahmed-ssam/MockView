"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError, type History } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { isLocalMode } from "@/lib/localMode";
import { KeyBanner } from "@/components/KeyBanner";
import { EmptyHistory, Hero, HowItWorks, SideTips } from "@/components/panels";

type State = { status: "loading" } | { status: "unconfigured" } | { status: "ready"; name: string; local?: boolean };

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [hist, setHist] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);

  async function load() {
    const token = await getAccessToken();
    if (!token) return;
    try { setHist(await api.history(token)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not load your history."); }
  }
  useEffect(() => { if (state.status === "ready") void load(); }, [state.status]);

  async function remove(id: string) {
    const token = await getAccessToken();
    if (!token) return;
    try { await api.deleteInterview(id, token); setConfirmId(null); setPicked((p) => p.filter((x) => x !== id)); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not delete that interview."); }
  }
  async function deleteAccount() {
    const token = await getAccessToken();
    if (!token) return;
    setAccountBusy(true); setError(null);
    try {
      const r = await api.deleteMyAccount(token);
      await getSupabase()?.auth.signOut();
      router.push(r.login_deleted ? "/?deleted=account" : "/?deleted=data");
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not delete your data."); setAccountBusy(false); }
  }
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1], id] : [...p, id]);

  useEffect(() => {
    void isLocalMode().then((local) => {
      if (local) return setState({ status: "ready", name: "", local: true });
      const supabase = getSupabase();
      if (!supabase) return setState({ status: "unconfigured" });
      supabase.auth.getSession().then(({ data }) => {
        const user = data.session?.user;
        if (!user) return router.replace("/login"); // protected route
        const name = (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "there";
        setState({ status: "ready", name });
      });
    });
  }, [router]);

  async function logout() {
    await getSupabase()?.auth.signOut();
    router.replace("/login");
  }

  if (state.status === "loading") return <p className="p-8 text-sm text-navy/70">Loading…</p>;
  if (state.status === "unconfigured") {
    return (
      <main className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 className="font-serif text-2xl">Sign-in isn't configured here</h1>
        <p className="mt-2 text-sm text-navy/75">The dashboard needs authentication to know whose interviews to show.</p>
        <Link href="/" className="btn-outline mt-6">Back to home</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo variant="compact" tone="dark" />
          {state.local ? (
            <Link href="/settings" className="text-sm text-cream/85 hover:text-cream">Settings</Link>
          ) : (
            <button type="button" onClick={logout} className="inline-flex items-center gap-2 text-sm text-cream/85 hover:text-cream">
              <LogOut size={16} aria-hidden /> Log out
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Hero title={state.local ? "Welcome back" : `Welcome, ${state.name}`} hasHistory={!!hist && hist.items.length > 0} />
        <div className="mt-4"><KeyBanner /></div>
        {error && <p role="alert" className="mt-4 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
        {!hist && !error && <p className="mt-6 text-sm text-navy/70">Loading your interviews…</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
        {hist && hist.items.length === 0 && (<><EmptyHistory /><div className="mt-8"><HowItWorks /></div></>)}

        {hist && hist.items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {[["Reports", String(hist.progress.completed)],
                ["Average score", hist.progress.average === null ? "—" : hist.progress.average.toFixed(0)],
                ["Best score", hist.progress.best === null ? "—" : hist.progress.best.toFixed(0)]].map(([k, v]) => (
                <div key={k} className="card p-4 text-center"><p className="text-2xl font-semibold">{v}</p><p className="text-xs text-navy/75">{k}</p></div>
              ))}
            </div>
            {hist.progress.counted < hist.progress.completed && (
              <p className="mt-2 text-xs text-navy/75">Demo-mode reports are excluded from these figures because their scores are simulated.</p>
            )}

            <section className="card mt-6 p-5" aria-labelledby="trend-h">
              <h2 id="trend-h" className="font-serif text-xl">Score over time</h2>
              {hist.progress.trend.length < 2 ? (
                <p className="mt-2 text-sm text-navy/70">Complete at least two interviews to see a trend.</p>
              ) : (
                <div className="mt-3 h-56" role="img" aria-label={"Overall scores in order: " + hist.progress.trend.map((t) => t.score.toFixed(0)).join(", ")}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hist.progress.trend.map((t, i) => ({ n: i + 1, score: t.score, label: t.specialization }))}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="n" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => [`${v}`, "Score"]} labelFormatter={(n) => `Interview ${n}`} />
                      <Line type="monotone" dataKey="score" stroke="#376A90" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="mt-8" aria-labelledby="hist-h">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="hist-h" className="font-serif text-xl">Interview history</h2>
                <div className="flex items-center gap-3">
                  <Link href={picked.length === 2 ? `/compare?base=${picked[0]}&other=${picked[1]}` : "#"} aria-disabled={picked.length !== 2}
                    onClick={(e) => { if (picked.length !== 2) e.preventDefault(); }}
                    className={`btn-outline ${picked.length !== 2 ? "pointer-events-none opacity-50" : ""}`}>Compare selected ({picked.length}/2)</Link>
                  <Link href="/interview/new" className="btn-cta">New interview</Link>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {hist.items.map((i) => (
                  <li key={i.id} className="card flex flex-wrap items-center gap-4 p-4">
                    <input type="checkbox" aria-label={`Select ${i.specialization} interview for comparison`} disabled={!i.has_report}
                      checked={picked.includes(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{i.specialization} <span className="text-sm font-normal text-navy/75">· {i.level}</span></p>
                      <p className="text-xs text-navy/75">{new Date(i.started_at).toLocaleString()} · {i.status.replace("_", " ")}{i.demo_mode ? " · demo" : ""}{i.retry_of_id ? " · practice of an earlier interview" : ""}</p>
                    </div>
                    {i.has_report && <p className="text-sm"><strong>{i.overall_score?.toFixed(0)}</strong>/100 · {i.performance_level}</p>}
                    {i.has_report ? <Link href={`/interview/${i.id}/report`} className="btn-outline">View report</Link>
                      : i.status === "in_progress" ? <Link href={`/interview/${i.id}`} className="btn-outline">Resume</Link> : null}
                    {confirmId === i.id ? (
                      <span className="flex items-center gap-2 text-sm">Delete permanently?
                        <button type="button" onClick={() => remove(i.id)} className="font-medium text-danger underline">Yes, delete</button>
                        <button type="button" onClick={() => setConfirmId(null)} className="underline">Cancel</button>
                      </span>
                    ) : <button type="button" onClick={() => setConfirmId(i.id)} className="text-sm text-navy/75 underline" aria-label={`Delete ${i.specialization} interview`}>Delete</button>}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        </div>
        <SideTips showKey={!!state.local} />
        </div>

        <section className="mt-12 border-t border-border pt-6" aria-labelledby="acct">
          <h2 id="acct" className="font-serif text-lg">Your data</h2>
          <p className="mt-1 max-w-xl text-sm text-navy/70">Delete every interview, report, resume and job description MockView holds about you. This can&apos;t be undone. See the <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
          {confirmAccount ? (
            <p className="mt-3 text-sm">Delete all your data permanently?{" "}
              <button type="button" disabled={accountBusy} onClick={deleteAccount} className="font-medium text-danger underline disabled:opacity-60">{accountBusy ? "Deleting…" : "Yes, delete everything"}</button>{" "}
              <button type="button" onClick={() => setConfirmAccount(false)} className="underline">Cancel</button></p>
          ) : <button type="button" onClick={() => setConfirmAccount(true)} className="mt-3 text-sm text-navy/70 underline">Delete my account data</button>}
        </section>
      </main>
    </div>
  );
}
