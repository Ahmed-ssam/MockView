"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError, type AdminInterview, type AdminStats, type AuditEntry, type AdminUser, type CatalogHealth } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { SiteNav } from "@/components/SiteNav";

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recent, setRecent] = useState<AdminInterview[]>([]);
  const [catalog, setCatalog] = useState<CatalogHealth | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return router.replace("/login?next=/admin");
    try {
      const [s, u, r, c, a] = await Promise.all([api.adminStats(token), api.adminUsers(token), api.adminInterviews(token), api.adminCatalog(token), api.adminAudit(token)]);
      setStats(s); setUsers(u); setRecent(r); setCatalog(c); setAudit(a);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setDenied(true);
      else setError(e instanceof ApiError ? e.message : "Could not load the admin data.");
    }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  async function erase(id: string) {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const r = await api.adminEraseUser(id, token);
      setNotice(`Erased ${r.interviews} interviews, ${r.resumes} resumes and ${r.job_descriptions} job descriptions. The user's sign-in account still exists in Supabase.`);
      setConfirm(null); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not erase that user."); }
  }

  const shell = (children: React.ReactNode) => (<><SiteNav /><main className="mx-auto max-w-6xl px-5 py-8">{children}</main></>);
  if (denied) return shell(<div role="alert" className="card p-6"><h1 className="font-serif text-2xl">Admin access required</h1><p className="mt-2 text-sm text-navy/75">Your account doesn&apos;t have the admin role.</p><Link href="/dashboard" className="btn-outline mt-4">Back to dashboard</Link></div>);
  if (error && !stats) return shell(<p role="alert" className="card p-5 text-danger">{error}</p>);
  if (!stats || !catalog) return shell(<p className="text-sm text-navy/70">Loading…</p>);

  const i = stats.interviews;
  const tiles: [string, string][] = [["Users", String(stats.users)], ["Interviews", String(i.total)], ["Last 24 h", String(i.last_24h)], ["Last 7 days", String(i.last_7d)],
    ["Completion rate", pct(i.completion_rate)], ["Avg real score", stats.real_reports.average_score?.toFixed(0) ?? "—"], ["Demo interviews", String(i.demo)], ["Resumes stored", String(stats.resumes_stored)]];

  return shell(<>
    <h1 className="font-serif text-3xl">Admin</h1>
    <p className="mt-1 text-sm text-navy/70">Usage and health. Candidates&apos; answers, resumes and job descriptions are never shown here.</p>
    <p role="note" className={`mt-3 rounded-control px-3 py-2 text-sm ${stats.ai.demo_mode ? "bg-sand/60" : "bg-soft-blue/30"}`}>
      AI provider: <strong>{stats.ai.provider}</strong>{stats.ai.demo_mode ? " — demo mode is ON; users see simulated feedback." : " — live."} {stats.note}
    </p>
    {notice && <p role="status" className="mt-3 rounded-control bg-soft-blue/30 px-3 py-2 text-sm">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{tiles.map(([k, v]) => <div key={k} className="card p-4 text-center"><p className="text-2xl font-semibold">{v}</p><p className="text-xs text-navy/75">{k}</p></div>)}</div>

    <section className="card mt-6 p-5" aria-labelledby="daily"><h2 id="daily" className="font-serif text-xl">Interviews per day (14 days)</h2>
      <div className="mt-3 h-52" role="img" aria-label={"Interviews per day: " + stats.daily.map((d) => `${d.date} ${d.interviews}`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="interviews" fill="#376A90" isAnimationActive={false} /></BarChart></ResponsiveContainer>
      </div></section>

    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <section className="card p-5" aria-labelledby="lv"><h2 id="lv" className="font-serif text-xl">Real report levels ({stats.real_reports.count})</h2>
        <ul className="mt-3 space-y-1 text-sm">{Object.entries(stats.real_reports.levels).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><strong>{v}</strong></li>)}</ul></section>
      <section className="card p-5" aria-labelledby="top"><h2 id="top" className="font-serif text-xl">Most used fields</h2>
        {stats.top_specializations.length === 0 ? <p className="mt-3 text-sm text-navy/70">No interviews yet.</p> :
          <ul className="mt-3 space-y-1 text-sm">{stats.top_specializations.map((t) => <li key={t.name} className="flex justify-between"><span>{t.name}</span><strong>{t.interviews}</strong></li>)}</ul>}</section>
    </div>

    <section className="card mt-6 p-5" aria-labelledby="cat"><h2 id="cat" className="font-serif text-xl">Catalog health ({catalog.count} fields)</h2>
      {catalog.issues.length === 0 ? <p className="mt-2 text-sm">No problems found: every field has a valid 10-question mix, 6 radar dimensions and all five level configs.</p>
        : <ul role="alert" className="mt-2 list-disc pl-5 text-sm text-danger">{catalog.issues.map((x) => <li key={x}>{x}</li>)}</ul>}</section>

    <section className="card mt-6 overflow-x-auto p-5" aria-labelledby="usr"><h2 id="usr" className="font-serif text-xl">Users</h2>
      <table className="mt-3 w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-2 pr-3">User</th><th className="pr-3">Role</th><th className="pr-3">Joined</th><th className="pr-3">Interviews</th><th className="pr-3">Last interview</th><th /></tr></thead>
        <tbody>{users.map((u) => <tr key={u.id} className="border-b border-border/60"><td className="py-2 pr-3"><span className="font-medium">{u.display_name ?? "(no name)"}</span> <span className="text-xs text-navy/75">{u.id.slice(0, 8)}</span></td><td className="pr-3">{u.role}</td><td className="pr-3">{new Date(u.created_at).toLocaleDateString()}</td><td className="pr-3">{u.interviews}</td><td className="pr-3">{u.last_interview_at ? new Date(u.last_interview_at).toLocaleDateString() : "—"}</td>
          <td className="text-right">{confirm === u.id ? <span className="text-xs">Erase all their data? <button type="button" onClick={() => erase(u.id)} className="font-medium text-danger underline">Yes, erase</button> <button type="button" onClick={() => setConfirm(null)} className="underline">Cancel</button></span>
            : <button type="button" onClick={() => setConfirm(u.id)} className="text-xs text-navy/75 underline" aria-label={`Erase data for user ${u.id.slice(0, 8)}`}>Erase data</button>}</td></tr>)}</tbody></table></section>

    <section className="card mt-6 overflow-x-auto p-5" aria-labelledby="rec"><h2 id="rec" className="font-serif text-xl">Recent interviews</h2>
      <table className="mt-3 w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-2 pr-3">When</th><th className="pr-3">Field</th><th className="pr-3">Level</th><th className="pr-3">Status</th><th>Score</th></tr></thead>
        <tbody>{recent.map((r) => <tr key={r.id} className="border-b border-border/60"><td className="py-2 pr-3">{new Date(r.started_at).toLocaleString()}</td><td className="pr-3">{r.specialization}</td><td className="pr-3">{r.level}</td><td className="pr-3">{r.status.replace("_", " ")}{r.demo_mode ? " · demo" : ""}</td><td>{r.overall_score?.toFixed(0) ?? "—"}</td></tr>)}</tbody></table></section>

    <section className="card mt-6 overflow-x-auto p-5" aria-labelledby="aud"><h2 id="aud" className="font-serif text-xl">Admin audit log</h2>
      {audit.length === 0 ? <p className="mt-3 text-sm text-navy/70">No admin actions recorded yet.</p> :
        <table className="mt-3 w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-2 pr-3">When</th><th className="pr-3">Admin</th><th className="pr-3">Action</th><th className="pr-3">Target</th><th>Detail</th></tr></thead>
          <tbody>{audit.map((a) => <tr key={a.id} className="border-b border-border/60"><td className="py-2 pr-3">{new Date(a.created_at).toLocaleString()}</td><td className="pr-3">{a.actor_id.slice(0, 8)}</td><td className="pr-3">{a.action}</td><td className="pr-3">{a.target_id?.slice(0, 8) ?? "—"}</td><td>{a.detail ? Object.entries(a.detail).map(([k, v]) => `${k}: ${v}`).join(", ") : ""}</td></tr>)}</tbody></table>}</section>
  </>);
}
