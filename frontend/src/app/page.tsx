import Link from "next/link";
import { ArrowRight, BarChart3, GraduationCap, History, Layers, Mic, Play, SlidersHorizontal, Target } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { CATEGORIES } from "@/lib/categories";

const steps = [
  { icon: Layers, title: "Choose your field", text: "Pick one of 64 technical specializations and your experience level." },
  { icon: SlidersHorizontal, title: "Customize your interviewer", text: "Select a personality, experience level, difficulty and language." },
  { icon: Play, title: "Take the interview", text: "Introduce yourself, then answer 10 questions in a spoken conversation, with follow-ups when your answer needs depth." },
  { icon: BarChart3, title: "Review your report", text: "See scores per question and skill, a radar chart, strengths, gaps and a study plan." },
];

const features = [
  { icon: Mic, title: "A real spoken conversation", text: "Your interviewer welcomes you, asks you to introduce yourself, then asks the questions out loud. You answer with your microphone and can review the transcript before sending. Typing is always available." },
  { icon: Target, title: "Adaptive questioning", text: "Follow-ups respond to what you actually said. The 10 main questions stay fixed, so results are comparable." },
  { icon: SlidersHorizontal, title: "Interviewer personalities", text: "Friendly, Professional, Strict or Senior Technical. The persona changes the interviewer's behavior, not just its picture." },
  { icon: BarChart3, title: "Evidence-based scoring", text: "Every score traces to your answers. The final numbers are calculated by fixed rules, not guessed by a model." },
  { icon: GraduationCap, title: "Personal learning plan", text: "A day-by-day roadmap built from the gaps your answers revealed." },
  { icon: History, title: "History and comparison", text: "Keep every report and compare radar charts across interviews to see real progress." },
];

const faqs = [
  { q: "Is MockView free?", a: "Yes. To keep it free, each account has a daily interview limit. The limit is shown before you start." },
  { q: "Does it use real AI?", a: "When an AI provider is configured, yes. If it is not, MockView runs in a clearly labeled demo mode with simulated responses, which should not be treated as real feedback." },
  { q: "Will my score predict if I get hired?", a: "No. The score summarizes how you performed in one practice session. It is a study aid, not a hiring prediction." },
  { q: "Do I have to upload my resume?", a: "No. Resume and job description are optional. If you add them they shape your questions, and you can delete them at any time." },
  { q: "How does the voice interview work, and is my audio stored?", a: "The interviewer speaks using your browser's built-in voice, and your answers are turned into text by your browser's speech service (Google in Chrome, Apple in Safari, Microsoft in Edge). MockView never records or stores audio, only the text of your answers. Voice works best in Chrome, Edge or Safari; otherwise you can type." },
  { q: "Which languages are supported?", a: "English and Arabic. Technical terms stay in English where that is how practitioners say them." },
];

export default function Home({ searchParams }: { searchParams?: { deleted?: string } }) {
  const deleted = searchParams?.deleted;
  return (
    <>
      <SiteNav />
      {deleted && (
        <p role="status" className="bg-sand px-5 py-3 text-center text-sm text-navy">
          {deleted === "account" ? "Your data and sign-in account were deleted." : "Your data was deleted. Your sign-in account still exists; ask the site operator to remove it if you want that too."}
        </p>
      )}
      <main>
        {/* Hero */}
        <section className="bg-navy text-cream">
          <div className="mx-auto max-w-6xl px-5 pb-20 pt-14 md:pb-28 md:pt-20">
            <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight text-cream md:text-5xl">
              Practice Real Interviews. Build Real Confidence.
            </h1>
            <p className="mt-5 max-w-xl text-base text-cream/85 md:text-lg">
              Prepare for your next technical interview with a personalized AI interviewer. Practice across 64
              technology fields and receive detailed feedback to improve your skills.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/interview/new" className="btn-cta">Start Free Interview <ArrowRight size={16} aria-hidden /></Link>
              <Link href="#fields" className="inline-flex items-center rounded-control border border-cream/70 px-5 py-2.5 text-sm font-medium text-cream hover:bg-cream hover:text-navy">
                Explore Technical Fields
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-3xl">How MockView Works</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-cream">{i + 1}</span>
                  <s.icon size={20} className="text-slate-blue" aria-hidden />
                </div>
                <h3 className="mt-4 font-sans text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-navy/75">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Fields */}
        <section id="fields" className="bg-cream-200 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-serif text-3xl">64 Supported Technical Fields</h2>
            <p className="mt-2 max-w-2xl text-navy/75">
              Each field has its own competencies, question styles and radar dimensions. A cybersecurity interview is
              not scored like a UX design interview.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((c) => (
                <li key={c.name} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-sans text-base font-semibold">{c.name}</h3>
                    <span className="chip shrink-0">{c.count}</span>
                  </div>
                  <p className="mt-2 text-sm text-navy/70">{c.examples.join(" · ")}</p>
                </li>
              ))}
            </ul>
            <Link href="/interview/new" className="btn-primary mt-8">Browse all fields <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-3xl">An Interviewer That Responds to You</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="card p-5">
                <f.icon size={22} className="text-slate-blue" aria-hidden />
                <h3 className="mt-3 font-sans text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-navy/75">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Report preview — explicitly a sample, not user data */}
        <section className="bg-navy py-16 text-cream">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl text-cream">Feedback You Can Act On</h2>
              <ul className="mt-5 space-y-3 text-cream/85">
                <li>Per-question analysis: what you got right, what was missing, and a stronger sample answer.</li>
                <li>A skills radar chart specific to your field.</li>
                <li>Strengths and weaknesses tied to the exact answers that showed them.</li>
                <li>A prioritized study roadmap and the option to retry weak questions.</li>
              </ul>
            </div>
            <div className="rounded-card bg-cream p-6 text-navy shadow-card" aria-label="Sample report layout">
              <p className="mb-3 inline-block rounded-full bg-sand px-3 py-1 text-xs font-semibold">Sample layout, not real results</p>
              <p className="font-serif text-xl">Interview Report</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                {["Overall score", "Performance level", "Questions"].map((l) => (
                  <div key={l} className="rounded-control border border-border bg-white p-3">
                    <div className="mb-1 h-4 rounded bg-cream-200" aria-hidden />
                    <span className="text-xs text-navy/70">{l}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-28 rounded-control border border-dashed border-border bg-white" aria-hidden />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="font-serif text-3xl">Frequently Asked Questions</h2>
          <div className="mt-6 divide-y divide-border rounded-card border border-border bg-white">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="cursor-pointer list-none font-medium marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-blue">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-navy/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
