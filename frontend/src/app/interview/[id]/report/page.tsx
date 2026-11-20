"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { api, ApiError, type Report } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { SiteNav } from "@/components/SiteNav";

const PRIORITY: Record<string, string> = { high: "bg-danger/10 text-danger", medium: "bg-sand/60 text-navy", recommended: "bg-soft-blue/40 text-navy" };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`} className="card mt-6 p-6">
      <h2 id={`s${n}`} className="font-serif text-2xl">{n}. {title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => items.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : null;

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) return router.replace(`/login?next=/interview/${id}/report`);
      try { setReport(await api.report(id, token)); }
      catch (e) { setError(e instanceof ApiError ? e.message : "Something went wrong."); }
    })();
  }, [id, router]);

  // Collapsed <details> print empty, so expand every question review while printing.
  useEffect(() => {
    const open = () => document.querySelectorAll("details").forEach((d) => { d.dataset.was = d.open ? "1" : ""; d.open = true; });
    const restore = () => document.querySelectorAll("details").forEach((d) => { d.open = d.dataset.was === "1"; });
    window.addEventListener("beforeprint", open); window.addEventListener("afterprint", restore);
    return () => { window.removeEventListener("beforeprint", open); window.removeEventListener("afterprint", restore); };
  }, []);

  async function practice() {
    setPracticeError(null); setPracticeBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return router.replace(`/login?next=/interview/${id}/report`);
      const v = await api.practiceWeakAreas(id, token);
      router.push(`/interview/${v.id}`);
    } catch (e) { setPracticeError(e instanceof ApiError ? e.message : "Could not start the practice interview."); setPracticeBusy(false); }
  }

  async function downloadPdf() {
    setPdfError(null); setPdfBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return router.replace(`/login?next=/interview/${id}/report`);
      const url = URL.createObjectURL(await api.reportPdf(id, token));
      const a = document.createElement("a");
      a.href = url; a.download = `mockview-report-${id.slice(0, 8)}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setPdfError(e instanceof ApiError ? e.message : "Could not create the PDF."); }
    finally { setPdfBusy(false); }
  }

  if (error) return <><SiteNav /><main className="mx-auto max-w-3xl px-5 py-10"><p role="alert" className="card p-5 text-danger">{error}</p><Link href="/dashboard" className="btn-outline mt-4">Back to dashboard</Link></main></>;
  if (!report) return <><SiteNav /><main className="mx-auto max-w-3xl px-5 py-10 text-sm text-navy/70">Loading your report…</main></>;

  const radar = Object.entries(report.radar).map(([skill, v]) => ({ skill, score: v ?? 0, assessed: v !== null }));
  const notAssessed = radar.filter((r) => !r.assessed).map((r) => r.skill);

  return (
    <>
      <div className="print:hidden"><SiteNav /></div>
      <main className="mx-auto max-w-4xl px-5 py-8 print:max-w-none">
        <h1 className="font-serif text-3xl">Interview report</h1>
        <p className="mt-1 text-navy/75">{report.specialization} · {report.level} · {report.difficulty}</p>
        {report.retry_of_id && <p role="note" className="mt-3 rounded-control bg-soft-blue/30 px-3 py-2 text-sm print:hidden">This was a practice interview on the weak areas of an earlier one. <Link className="font-medium underline" href={`/compare?base=${report.retry_of_id}&other=${report.id}`}>Compare with that attempt</Link></p>}
        {report.demo_mode && <p role="note" className="mt-3 rounded-control bg-sand/60 px-3 py-2 text-sm"><strong>Demo mode.</strong> This report was produced without a real AI provider; the feedback is simulated and should not be treated as real.</p>}

        <Section n={1} title="Overall result">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-control border border-border p-4 text-center"><p className="text-3xl font-semibold">{report.overall_score.toFixed(0)}<span className="text-base text-navy/75">/100</span></p><p className="text-xs text-navy/75">Overall score</p></div>
            <div className="rounded-control border border-border p-4 text-center"><p className="text-xl font-semibold">{report.performance_level}</p><p className="text-xs text-navy/75">Performance level</p></div>
            <div className="rounded-control border border-border p-4 text-center"><p className="text-xl font-semibold">{report.questions.length} + {report.questions.filter((q) => q.followup).length}</p><p className="text-xs text-navy/75">Main questions + follow-ups</p></div>
          </div>
          <p className="mt-3 text-xs text-navy/75">A practice summary, not a hiring prediction. Calculated by fixed scoring rules (v{report.scoring_version}).</p>
        </Section>

        <Section n={2} title="Skills radar">
          <div className="h-80" role="img" aria-label={"Radar chart: " + radar.map((r) => `${r.skill} ${r.assessed ? r.score : "not assessed"}`).join(", ")}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar}>
                <PolarGrid /><PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar dataKey="score" stroke="#376A90" fill="#8FB6D9" fillOpacity={0.55} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {notAssessed.length > 0 && <p className="mt-2 text-sm text-navy/70">Not assessed in this interview: {notAssessed.join(", ")}.</p>}
        </Section>

        <Section n={3} title="Skill evaluations">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Question scores table"><table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border"><th className="py-2 pr-3">Skill</th><th className="pr-3">Score</th><th className="pr-3">Level</th><th>Evidence</th></tr></thead>
            <tbody>{report.skills.map((k) => (
              <tr key={k.skill} className="border-b border-border/60 align-top"><td className="py-2 pr-3 font-medium">{k.skill}</td><td className="pr-3">{k.score === null ? "—" : k.score.toFixed(0)}</td><td className="pr-3">{k.level ?? "Not assessed"}</td><td className="text-navy/75">{k.evidence.join(" · ")}</td></tr>
            ))}</tbody>
          </table></div>
        </Section>

        <Section n={4} title="Strengths">
          {report.strengths.length === 0 ? <p className="text-sm text-navy/70">No skill reached the strong threshold (70) this time.</p> :
            report.strengths.map((s) => <div key={s.skill} className="mb-3"><p className="font-medium">{s.skill} <span className="text-sm text-navy/75">({s.score.toFixed(0)})</span></p><List items={s.evidence} /></div>)}
        </Section>

        <Section n={5} title="Areas to improve">
          {report.weaknesses.length === 0 ? <p className="text-sm text-navy/70">No skill fell below the strong threshold.</p> :
            report.weaknesses.map((s) => <div key={s.skill} className="mb-3"><p className="font-medium">{s.skill} <span className="text-sm text-navy/75">({s.score.toFixed(0)})</span></p><List items={s.evidence} /></div>)}
        </Section>

        <Section n={6} title="Coach summary"><p className="text-sm leading-relaxed">{report.coach_summary}</p></Section>

        <Section n={7} title="Recommendations">
          {report.recommendations.length === 0 ? <p className="text-sm text-navy/70">No weak questions. Try a harder difficulty next.</p> :
            <ul className="space-y-4">{report.recommendations.map((r, i) => (
              <li key={i} className="rounded-control border border-border p-4">
                <span className={`chip ${PRIORITY[r.priority]}`}>{r.priority}</span>
                <p className="mt-2 font-medium">{r.topic}</p>
                <p className="mt-1 text-sm text-navy/80">{r.explanation}</p>
                <p className="mt-1 text-sm"><strong>Why it matters:</strong> {r.why_it_matters}</p>
                <p className="mt-1 text-sm"><strong>Do this:</strong> {r.activity}</p>
                <p className="mt-1 text-sm"><strong>Expected result:</strong> {r.expected_improvement}</p>
              </li>))}</ul>}
        </Section>

        <Section n={8} title="Learning roadmap">
          {report.roadmap.length === 0 ? <p className="text-sm text-navy/70">Nothing urgent to plan.</p> :
            <ol className="space-y-2 text-sm">{report.roadmap.map((r) => <li key={r.step}><strong>Step {r.step} ({r.priority}):</strong> {r.focus}. {r.activity}</li>)}</ol>}
        </Section>

        <Section n={9} title="Question-by-question review">
          <div className="space-y-3">{report.questions.map((q) => (
            <details key={q.id} className="rounded-control border border-border p-4 print:break-inside-avoid">
              <summary className="cursor-pointer font-medium">Q{q.position}. {q.question} <span className="ml-2 text-sm text-navy/75">{q.score.toFixed(0)}/100 · {q.verdict.replace("_", " ")}</span></summary>
              <div className="mt-3 space-y-3 text-sm">
                <div><p className="font-medium">Your answer</p><p className="text-navy/80">{q.skipped ? "(Skipped)" : q.answer}</p></div>
                {q.explanation && <p>{q.explanation}</p>}
                {q.did_well.length > 0 && <div><p className="font-medium">What you did well</p><List items={q.did_well} /></div>}
                {q.missing.length > 0 && <div><p className="font-medium">What was missing</p><List items={q.missing} /></div>}
                {q.incorrect_statements.length > 0 && <div><p className="font-medium">Incorrect statements</p><List items={q.incorrect_statements} /></div>}
                {q.improved_answer && <div><p className="font-medium">A stronger answer</p><p className="text-navy/80">{q.improved_answer}</p></div>}
                {q.tip && <p><strong>Tip:</strong> {q.tip}</p>}
                {q.followup && <div className="rounded-control bg-cream-200 p-3"><p className="font-medium">Follow-up: {q.followup.question}</p><p className="mt-1 text-navy/80">{q.followup.skipped ? "(Skipped)" : q.followup.answer}</p><p className="mt-1 text-xs text-navy/75">{q.followup.score.toFixed(0)}/100 · counts for 30% of this question</p></div>}
              </div>
            </details>))}</div>
        </Section>

        {practiceError && <p role="alert" className="mt-6 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger print:hidden">{practiceError}</p>}
        {pdfError && <p role="alert" className="mt-6 rounded-control border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger print:hidden">{pdfError}</p>}
        <div className="mt-8 flex flex-wrap gap-3 print:hidden">
          <button type="button" onClick={downloadPdf} disabled={pdfBusy} className="btn-primary disabled:cursor-wait disabled:opacity-60">{pdfBusy ? "Preparing PDF…" : "Download PDF"}</button>
          <button type="button" onClick={() => window.print()} className="btn-outline">Print</button>
          {report.can_practice && <button type="button" onClick={practice} disabled={practiceBusy} className="btn-cta disabled:cursor-wait disabled:opacity-60">{practiceBusy ? "Preparing questions…" : "Practice my weak areas"}</button>}
          <Link href="/interview/new" className={report.can_practice ? "btn-outline" : "btn-cta"}>New interview</Link>
          <Link href="/dashboard" className="btn-outline">Dashboard</Link>
        </div>
      </main>
    </>
  );
}
