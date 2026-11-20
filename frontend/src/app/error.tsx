"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto max-w-xl px-5 py-20 text-center">
      <h1 className="font-serif text-3xl">Something went wrong</h1>
      <p className="mt-3 text-navy/75">Your answers are saved. Please try again; if it keeps happening, come back in a few minutes.</p>
      {error.digest && <p className="mt-2 text-xs text-navy/50">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="btn-primary mt-6">Try again</button>
    </main>
  );
}
