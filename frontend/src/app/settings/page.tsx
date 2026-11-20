"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { api, ApiError, type LocalSettings } from "@/lib/api";
import { useLocalMode } from "@/lib/localMode";
import { KeyArt } from "@/components/art";
import { Lock, ShieldCheck } from "lucide-react";

type Msg = { ok: boolean; text: string } | null;
const PREFERRED = "gemini-2.5-flash";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-cream">{n}</span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">{title}</h3>
        <div className="mt-1.5 text-sm text-navy/80">{children}</div>
      </div>
    </li>
  );
}

export default function SettingsPage() {
  const local = useLocalMode();
  const [s, setS] = useState<LocalSettings | null>(null);
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"models" | "test" | "save" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const loadModels = useCallback(async (typed: string, current: string) => {
    setBusy("models"); setMsg(null);
    try {
      const r = await api.listModels({ api_key: typed || undefined });
      if (!r.ok) { setModels([]); setMsg({ ok: false, text: r.message }); return; }
      setModels(r.models);
      setModel(r.models.includes(current) ? current : r.models.includes(PREFERRED) ? PREFERRED : r.models[0]);
      setMsg({ ok: true, text: `${r.message} Pick one below.` });
    } catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Could not load the model list." }); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => {
    if (!local) return;
    api.settings().then((v) => {
      setS(v); setModel(v.model);
      if (v.key_set) void loadModels("", v.model);
    }).catch((e) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Could not load settings." }));
  }, [local, loadModels]);

  async function run(kind: "test" | "save", fn: () => Promise<void>) {
    setBusy(kind); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Something went wrong." }); }
    setBusy(null);
  }
  const test = () => run("test", async () => { const r = await api.testKey({ api_key: key || undefined, model }); setMsg({ ok: r.ok, text: r.message }); });
  const save = () => run("save", async () => {
    const v = await api.saveSettings({ ...(key ? { api_key: key } : {}), model });
    setS(v); setKey(""); setMsg({ ok: true, text: "Saved on this computer. You're ready to start an interview." });
  });
  const remove = () => run("save", async () => { setS(await api.removeKey()); setModels([]); setMsg({ ok: true, text: "Key removed. MockView is back in demo mode." }); });

  const haveKey = !!key || !!s?.key_set;
  const canSave = !!model && (!!key || model !== s?.model) && (models.length === 0 || models.includes(model));

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="font-serif text-3xl">Settings</h1>
        {local === false && (
          <p className="mt-4 text-sm text-navy/80">Settings are only available when MockView runs on your own computer (local mode). This server uses its own configuration.</p>
        )}
        {local && (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_280px]">
          <section className="card p-6" aria-labelledby="gk">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="gk" className="font-serif text-xl">Connect your Gemini API key</h2>
              <p className="rounded-full border border-border px-3 py-1 text-xs" aria-live="polite">
                {s === null ? "Checking…" : s.key_set ? <>Real AI on · key {s.key_hint} · {s.model}</> : <>Demo mode · no key yet</>}
              </p>
            </div>
            <p className="mt-2 text-sm text-navy/80">
              MockView uses your own key, so usage counts against your own Google quota. The key is saved only on this computer and sent only to Google.
            </p>

            <ol className="mt-6 space-y-6">
              <Step n={1} title="Get a free key">
                Open <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>,
                sign in, press <em>Create API key</em>, then open the key and press <em>Copy key</em>.
                Keys now start with <strong>AQ.</strong> (older ones start with AIza); both work. Copy the <em>whole</em> key
                (about 53 characters): the list only shows a shortened version.
              </Step>
              <Step n={2} title="Paste it here">
                <label htmlFor="key" className="sr-only">Gemini API key</label>
                <input id="key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)}
                  placeholder={s?.key_set ? `Saved key ${s.key_hint} — paste a new one to replace it` : "Paste your API key here"}
                  className="w-full rounded-control border-2 border-slate-blue/50 bg-white px-3 py-2.5 text-sm focus:border-navy" />
                {key.trim().length > 0 && key.trim().length < 35 && (
                  <p role="note" className="mt-2 rounded-control border border-sand-dark/60 bg-sand/30 px-3 py-2 text-xs text-navy">
                    This looks too short for a full key (yours is {key.trim().length} characters; a full key is about 53). Use <em>Copy key</em> in the
                    key&apos;s details page, not the shortened text in the list.
                  </p>
                )}
                <button type="button" onClick={() => loadModels(key, model)} disabled={busy !== null || !haveKey} className="btn-outline mt-3 disabled:opacity-60">
                  {busy === "models" ? "Checking your key…" : "Check key & load my models"}
                </button>
              </Step>
              <Step n={3} title="Choose a model">
                <label htmlFor="model" className="sr-only">Model</label>
                <select id="model" value={model} onChange={(e) => setModel(e.target.value)} disabled={models.length === 0}
                  className="w-full rounded-control border border-border bg-white px-3 py-2.5 text-sm disabled:opacity-60">
                  {models.length === 0 && <option value="">{haveKey ? "Press “Check key & load my models” first" : "Add a key first"}</option>}
                  {models.map((m) => <option key={m} value={m}>{m}{m === PREFERRED ? " (recommended)" : ""}</option>)}
                </select>
                <p className="mt-1 text-xs text-navy/75">Only models your key can actually use are listed. Faster “flash” models are cheaper; “pro” models reason more deeply.</p>
              </Step>
              <Step n={4} title="Test and save">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={test} disabled={busy !== null || !haveKey || !model} className="btn-outline disabled:opacity-60">
                    {busy === "test" ? "Testing…" : "Test key"}</button>
                  <button type="button" onClick={save} disabled={busy !== null || !canSave} className="btn-cta disabled:opacity-60">
                    {busy === "save" ? "Saving…" : "Save"}</button>
                  {s?.key_set && <button type="button" onClick={remove} disabled={busy !== null} className="text-sm underline disabled:opacity-60">Remove key</button>}
                </div>
              </Step>
            </ol>
            {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-5 rounded-control border px-3 py-2 text-sm ${msg.ok ? "border-slate-blue/40 bg-soft-blue/20" : "border-danger/40 bg-danger/5 text-danger"}`}>{msg.text}</p>}
          </section>
          <aside className="space-y-4" aria-label="About your key">
            <div className="card overflow-hidden"><div className="bg-cream-200 p-4"><KeyArt className="mx-auto h-32 w-auto" /></div>
              <div className="p-4"><h2 className="font-serif text-lg">Your key, your data</h2>
                <p className="mt-1 text-sm text-navy/75">MockView calls Gemini directly from your computer with your own key. There is no MockView server in between.</p></div></div>
            <div className="card p-4 text-sm text-navy/80"><p className="flex items-center gap-2 font-medium"><Lock size={16} aria-hidden /> Stored only on this computer</p>
              <p className="mt-1">Your key is saved in the app&apos;s data folder. It is never shown in full again, only its last 4 characters.</p></div>
            <div className="card p-4 text-sm text-navy/80"><p className="flex items-center gap-2 font-medium"><ShieldCheck size={16} aria-hidden /> Free tier limits apply</p>
              <p className="mt-1">Google sets the usage limits for your key. If you reach them, wait a while or try another model from the list.</p></div>
          </aside>
          </div>
        )}
        <p className="mt-6 text-sm"><Link href="/dashboard" className="underline">Back to dashboard</Link></p>
      </main>
    </>
  );
}
