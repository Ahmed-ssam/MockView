import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, KeyRound, Mic, MessagesSquare, Target } from "lucide-react";
import { Dots, InterviewScene, KeyArt, MicArt, ScoreChart } from "./art";

const PEOPLE = [
  { id: "alex", role: "Engineering Manager" }, { id: "dana", role: "Technical Recruiter" },
  { id: "sam", role: "Staff Engineer" }, { id: "noor", role: "Principal Engineer" },
];

export function Faces({ size = 56 }: { size?: number }) {
  return (
    <ul className="flex -space-x-3" aria-label="Your interviewers">
      {PEOPLE.map((p) => (
        <li key={p.id}><Image src={`/avatars/${p.id}.webp`} alt={p.role} title={p.role} width={size} height={size}
          className="rounded-full border-2 border-cream bg-cream object-cover" style={{ width: size, height: size }} /></li>
      ))}
    </ul>
  );
}

export function Hero({ title, hasHistory }: { title: string; hasHistory: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-card bg-navy text-cream shadow-card">
      <Dots className="absolute -right-6 -top-6 h-40 w-40 opacity-20" />
      <div className="relative grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-soft-blue">Practice out loud</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-cream sm:text-4xl">{title}</h1>
          <p className="mt-1 font-serif text-lg text-sand">{hasHistory ? "Ready for your next round?" : "Your first mock interview is minutes away."}</p>
          <p className="mt-3 max-w-md text-sm text-cream/85">Ten real questions, adaptive follow-ups and a clear report with what to fix first. Pick a field, choose an interviewer, and talk it through.</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link href="/interview/new" className="btn-cta">Start New Interview <ArrowRight size={16} aria-hidden /></Link>
            <Faces />
          </div>
        </div>
        <InterviewScene className="mx-auto w-full max-w-sm" />
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Target, title: "Choose your field", text: "64 specializations, from backend and data to security and design.", art: null },
  { icon: Mic, title: "Answer out loud", text: "The interviewer speaks; you answer by voice or by typing.", art: MicArt },
  { icon: BarChart3, title: "Get your report", text: "Scored by a fixed rubric, with strengths, gaps and a practice plan.", art: ScoreChart },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-h">
      <h2 id="how-h" className="font-serif text-xl">How it works</h2>
      <ol className="mt-3 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card overflow-hidden">
            <div className="flex h-32 items-center justify-center bg-cream-200">
              {s.art ? <s.art className="h-28 w-auto" /> : <InterviewScene className="h-28 w-auto" />}
            </div>
            <div className="p-4">
              <p className="flex items-center gap-2 font-medium"><span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs text-cream">{i + 1}</span>{s.title}</p>
              <p className="mt-1.5 text-sm text-navy/75">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SideTips({ showKey = true }: { showKey?: boolean }) {
  return (
    <aside className="space-y-4" aria-label="Tips">
      <div className="card overflow-hidden">
        <div className="bg-cream-200 p-4"><Faces size={52} /></div>
        <div className="p-4">
          <h2 className="font-serif text-lg">Your interviewers</h2>
          <p className="mt-1 text-sm text-navy/75">Four roles with different styles, from a warm recruiter to a demanding principal engineer. Choose one when you start.</p>
        </div>
      </div>
      <div className="card p-4">
        <h2 className="flex items-center gap-2 font-serif text-lg"><MessagesSquare size={18} aria-hidden /> Practice tips</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-navy/80">
          <li>Think aloud: say the trade-off, not just the answer.</li>
          <li>Give one concrete example from your own work.</li>
          <li>Retry the same interview to see which gaps closed.</li>
        </ul>
      </div>
      {showKey && (
        <Link href="/settings" className="card flex items-center gap-3 p-4 hover:border-slate-blue">
          <KeyArt className="h-14 w-auto shrink-0" />
          <span className="text-sm"><span className="flex items-center gap-1.5 font-medium"><KeyRound size={15} aria-hidden /> API key &amp; settings</span>
            <span className="text-navy/70">Add or change your Gemini key and model.</span></span>
        </Link>
      )}
    </aside>
  );
}

export function EmptyHistory() {
  return (
    <div className="card flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
      <ScoreChart className="h-36 w-auto shrink-0" />
      <div>
        <h2 className="font-serif text-xl">No interviews yet</h2>
        <p className="mt-2 max-w-md text-sm text-navy/75">Scores, strengths and progress charts are built from your completed interviews. Start your first one to see them here.</p>
        <Link href="/interview/new" className="btn-cta mt-4">Start New Interview <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </div>
  );
}
