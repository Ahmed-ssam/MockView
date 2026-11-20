"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { api, ApiError, type SpecializationDetail, type SpecializationSummary } from "@/lib/api";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SpecializationStep({ selectedSlug, onSelect, onNext }: {
  selectedSlug: string | undefined;
  onSelect: (s: SpecializationSummary) => void;
  onNext: () => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 250);
  const [items, setItems] = useState<SpecializationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpecializationDetail | null>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => { /* list error is shown below */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    api
      .specializations({ category: category || undefined, q: debounced.trim() || undefined })
      .then((r) => !cancelled && setItems(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof ApiError ? e.message : "Something went wrong."));
    return () => { cancelled = true; };
  }, [category, debounced]);

  useEffect(() => {
    if (!selectedSlug) return setDetail(null);
    let cancelled = false;
    api.specialization(selectedSlug).then((d) => !cancelled && setDetail(d)).catch(() => !cancelled && setDetail(null));
    return () => { cancelled = true; };
  }, [selectedSlug]);

  const grouped = useMemo(() => {
    const m = new Map<string, SpecializationSummary[]>();
    for (const s of items ?? []) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [items]);

  return (
    <>
      <h1 className="font-serif text-3xl">What are you interviewing for?</h1>
      <p className="mt-1 text-navy/75">Pick the specialization that matches the role you are preparing for.</p>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative shrink-0 md:w-80">
          <label htmlFor="search" className="sr-only">Search specializations</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy/50" aria-hidden />
          <input id="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fields, topics, tools…"
            className="w-full rounded-control border border-border bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-blue focus:ring-2 focus:ring-soft-blue/50" />
        </div>
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          {["", ...categories].map((c) => (
            <button key={c || "all"} type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${category === c ? "border-navy bg-navy text-cream" : "border-border bg-white text-slate-blue hover:border-slate-blue"}`}>
              {c || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-live="polite">
          {error && (
            <div role="alert" className="card p-5">
              <p className="font-medium text-danger">Couldn't load specializations</p>
              <p className="mt-1 text-sm text-navy/75">{error}</p>
              <button className="btn-outline mt-4" onClick={() => window.location.reload()} type="button">Try again</button>
            </div>
          )}
          {!error && items === null && <p className="text-sm text-navy/70">Loading specializations…</p>}
          {!error && items?.length === 0 && (
            <div className="card p-6 text-center">
              <p className="font-medium">No fields match your search</p>
              <button type="button" className="btn-outline mt-4" onClick={() => { setQuery(""); setCategory(""); }}>Clear filters</button>
            </div>
          )}
          {grouped.map(([cat, list]) => (
            <div key={cat} className="mb-8">
              <h2 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-slate-blue">{cat}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((s) => {
                  const active = selectedSlug === s.slug;
                  return (
                    <li key={s.slug}>
                      <button type="button" onClick={() => onSelect(s)} aria-pressed={active}
                        className={`card flex h-full w-full flex-col p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-blue ${active ? "!border-navy ring-2 ring-navy" : "hover:border-slate-blue"}`}>
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-sans text-sm font-semibold">{s.name}</span>
                          {active && <Check size={16} className="shrink-0 text-navy" aria-label="Selected" />}
                        </span>
                        <span className="mt-1.5 text-xs text-navy/70">{s.description}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Selected specialization">
          <div className="card p-5">
            {!selectedSlug && <p className="text-sm text-navy/70">Select a field to see what the interview will assess.</p>}
            {selectedSlug && (
              <>
                {detail ? (
                  <>
                    <h2 className="font-serif text-xl">{detail.name}</h2>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-blue">Skills you'll be scored on</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {detail.evaluation_dimensions.map((d) => <li key={d} className="chip">{d}</li>)}
                    </ul>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-blue">Topics</p>
                    <p className="mt-1 text-sm text-navy/80">{detail.technical_topics.join(", ")}</p>
                  </>
                ) : (
                  <p className="text-sm text-navy/70">Loading details…</p>
                )}
                <button type="button" onClick={onNext} className="btn-primary mt-5 w-full justify-center">
                  Continue to configuration
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
