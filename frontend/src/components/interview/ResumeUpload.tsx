"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError, type ResumeInfo } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

/** Optional resume upload. Only the extracted text is kept (never the PDF), only with explicit consent, and it can be removed at any time. */
export function ResumeUpload({ resumeId, onChange }: { resumeId?: string; onChange: (id: string | undefined) => void }) {
  const [info, setInfo] = useState<ResumeInfo | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null); setNeedsLogin(false);
    if (!consent) return setError("Please tick the consent box first.");
    const token = await getAccessToken();
    if (!token) { setNeedsLogin(true); return setError("Please log in to upload a resume."); }
    setBusy(true);
    try { const r = await api.uploadResume(file, consent, token); setInfo(r); onChange(r.id); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Upload failed. Please try again."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setError(null);
    const token = await getAccessToken();
    if (!token || !resumeId) { setInfo(null); return onChange(undefined); }
    try { await api.deleteResume(resumeId, token); }
    catch (e) { if (!(e instanceof ApiError && e.status === 404)) return setError(e instanceof ApiError ? e.message : "Could not remove it."); }
    setInfo(null); onChange(undefined);
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Resume (PDF)</p>
      {resumeId ? (
        <div className="rounded-control border border-border bg-cream-200 p-3 text-sm">
          <p className="font-medium">Resume added{info ? ` (${info.chars.toLocaleString()} characters read)` : ""}</p>
          {info && <p className="mt-1 line-clamp-2 text-xs text-navy/75">{info.preview}</p>}
          <button type="button" onClick={remove} className="mt-2 text-xs underline">Remove and delete my resume text</button>
        </div>
      ) : (
        <>
          <label className="flex items-start gap-2 text-xs text-navy/75">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>I agree that MockView may read the text of my resume to tailor my questions. The PDF file is not saved, only its text, and I can delete it at any time.</span>
          </label>
          <input type="file" accept="application/pdf,.pdf" disabled={busy} aria-label="Upload resume PDF"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-control file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm" />
          <p className="mt-1 text-xs text-navy/75">Text-based PDF, up to 2 MB and 10 pages. {busy && "Reading…"}</p>
        </>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error} {needsLogin && <Link href="/login?next=/interview/new" className="underline">Log in</Link>}</p>}
    </div>
  );
}
