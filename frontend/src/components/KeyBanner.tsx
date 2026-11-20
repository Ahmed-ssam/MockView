"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocalMode } from "@/lib/localMode";

/** Local mode only: tells the person when no Gemini key is set, so demo output is never mistaken for real AI. */
export function KeyBanner() {
  const local = useLocalMode();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (local) api.settings().then((s) => setMissing(!s.key_set)).catch(() => {});
  }, [local]);
  if (!local || !missing) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-sand-dark/60 bg-sand/40 px-4 py-3 text-sm text-navy">
      <p><strong>Demo mode.</strong> No Gemini key is set, so interviews use simulated questions and scores (labeled DEMO).</p>
      <Link href="/settings" className="btn-cta whitespace-nowrap">Add your Gemini API key</Link>
    </div>
  );
}
