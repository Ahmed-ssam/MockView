"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { api, ApiError, type Comparison } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { SiteNav } from "@/components/SiteNav";

const fmt = (d: number | null) => d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`;

function Inner() {
  const q = useSearchParams();
  const router = useRouter();
  const base = q.get("base"), other = q.get("other");
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base || !other) return setError("Choose two interviews on your dashboard to compare.");
    (async () => {
      const token = await getAccessToken();
      if (!token) return router.replace("/login?next=/dashboard");
      try { setData(await api.compare(base, other, token)); }
      catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong."); }
    })();
  }, [base, other, router]);

  if (error) return <div role="alert" className="card p-5 text-danger">{error}</div>;
  if (!data) return <p className="text-sm text-navy/70">Loading comparison…</p>;
  const chart = data.dimensions.map((d) => ({ skill: d.skill, Earlier: d.before ?? 0, Later: d.after ?? 0 }));
  const when = (d: string) => new Date(d).toLocaleDateString();
  return (
    <>
      <h1 className="font-serif text-3xl">Compare interviews</h1>
      <p className="mt-1 text-navy/75">{data.specialization}</p>
      {(data.before.demo_mode || data.after.demo_mode) && <p role="note" className="mt-3 rounded-control bg-sand/60 px-3 py-2 text-sm">One or both reports are demo-mode, so their scores are simulated.</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4 text-center"><p className="text-2xl font-semibold">{data.before.overall_score.toFixed(0)}</p><p className="text-xs text-navy/75">Earlier · {when(data.before.date)}</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-semibold">{data.after.overall_score.toFixed(0)}</p><p className="text-xs text-navy/75">Later · {when(data.after.date)}</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-semibold">{fmt(data.overall_delta)}</p><p className="text-xs text-navy/75">Overall change</p></div>
      </div>
      <section className="card mt-6 p-5" aria-label="Radar comparison">
        <div className="h-80" role="img" aria-label={"Radar comparison: " + data.dimensions.map((d) => `${d.skill} ${d.before ?? "n/a"} to ${d.after ?? "n/a"}`).join(", ")}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chart}>
              <PolarGrid /><PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Earlier" dataKey="Earlier" stroke="#376A90" fill="#8FB6D9" fillOpacity={0.3} />
              <Radar name="Later" dataKey="Later" stroke="#B8793A" fill="#F4C992" fillOpacity={0.45} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="card mt-6 overflow-x-auto p-5" tabIndex={0} role="region" aria-label="Comparison table">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border"><th className="py-2 pr-3">Skill</th><th className="pr-3">Earlier</th><th className="pr-3">Later</th><th>Change</th></tr></thead>
          <tbody>{data.dimensions.map((d) => (
            <tr key={d.skill} className="border-b border-border/60"><td className="py-2 pr-3 font-medium">{d.skill}</td><td className="pr-3">{d.before?.toFixed(0) ?? "Not assessed"}</td><td className="pr-3">{d.after?.toFixed(0) ?? "Not assessed"}</td><td>{fmt(d.delta)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-navy/75">{data.caveat}</p>
      <Link href="/dashboard" className="btn-outline mt-6">Back to dashboard</Link>
    </>
  );
}

export default function ComparePage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-4xl px-5 py-8"><Suspense fallback={null}><Inner /></Suspense></main>
    </>
  );
}
