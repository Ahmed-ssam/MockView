"use client";

/**
 * Voice layer:
 *  - useSpeaker: the interviewer speaks (speechSynthesis, built into the browser / desktop window)
 *  - useDictation: the candidate speaks. In a web browser the browser's own SpeechRecognition types the text live.
 *    In the desktop app (Electron has no speech engine) the answer is recorded, sent once to the local MockView
 *    server to be transcribed with the person's own Gemini key, and discarded. Audio is never stored by MockView.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { getAccessToken } from "./auth";

export type Lang = "en" | "ar";
export const LANG_TAG: Record<Lang, string> = { en: "en-US", ar: "ar-SA" };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True inside the MockView desktop app (an Electron window), false in a normal browser. */
export function isDesktopApp(): boolean {
  return typeof navigator !== "undefined" && /\bElectron\//.test(navigator.userAgent);
}
function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== "undefined";
}

export function voiceSupport(): { stt: boolean; tts: boolean } {
  if (typeof window === "undefined") return { stt: false, tts: false };
  return {
    stt: isDesktopApp() ? canRecord() : recognitionCtor() !== null,
    tts: "speechSynthesis" in window && typeof (window as any).SpeechSynthesisUtterance !== "undefined",
  };
}

export const VOICE_MESSAGES = {
  unsupported: "Your browser doesn't support voice input. Use Chrome, Edge or Safari, or type your answers.",
  denied: "Microphone access was blocked. Allow the microphone in your browser's site settings, or type your answer.",
  noMic: "No microphone was found. Check your device, or type your answer.",
  network: "Speech recognition couldn't reach your browser's speech service. Check your connection, or type your answer.",
  silent: "I couldn't hear anything. Check that the right microphone is selected, or type your answer.",
  generic: "Voice input stopped unexpectedly. You can try again or type your answer.",
} as const;

/** Split text into short spoken chunks (long utterances get cut off in some browsers). */
export function splitForSpeech(text: string, max = 180): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?؟۔])\s+/).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= max) { out.push(s); continue; }
    let cur = "";
    for (const w of s.split(" ")) {
      if ((cur + " " + w).trim().length > max) { out.push(cur.trim()); cur = w; } else cur += " " + w;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/* ---------------------------------------------------------------- voice choice
 * The Web Speech API does not tell us a voice's gender, so it is guessed from well-known voice names
 * (best effort; unknown names are listed as "Other"). Which voices exist depends on the device and browser. */
export type Gender = "male" | "female";
export type VoicePrefs = { gender?: Gender; voiceURI?: Partial<Record<Lang, string>> };
const PREFS_KEY = "mockview:voice";

export function loadVoicePrefs(): VoicePrefs {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as VoicePrefs; } catch { return {}; }
}
export function saveVoicePrefs(p: VoicePrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode: choice just isn't remembered */ }
}

const FEMALE = /\b(female|woman|zira|jenny|aria|ava|emma|michelle|sara|sarah|salma|hoda|zariyah|fatima|laila|layla|amira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|libby|sonia|natasha|joanna|kendra|kimberly|salli|ivy|zoe|amelie|shelley|nicky|catherine|allison|mariam|maryam|noora|sana|lina|heera|neerja|ana|ayanda|microsoft (?:eva|elsa|katja))\b/i;
const MALE = /\b(male|man|david|mark|guy|ryan|christopher|eric|brian|george|james|daniel|alex|fred|tom|aaron|arthur|oliver|rishi|naayf|hamed|shakir|hamza|maged|majed|tarik|tarek|ali|omar|khaled|zayd|salem|fahed|bassel|junior|ravi|prabhat|microsoft (?:stefan|hans))\b/i;

export function guessGender(v: { name: string }): Gender | "unknown" {
  if (FEMALE.test(v.name)) return "female";   // tested first: "female" contains "male"
  if (MALE.test(v.name)) return "male";
  return "unknown";
}

export function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  if (!voiceSupport().tts) return [];
  const two = LANG_TAG[lang].slice(0, 2);
  return window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(two))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Saved voice for this language, else the first voice matching the wanted gender, else any voice in the language. */
export function chooseVoice(lang: Lang, prefs: VoicePrefs, fallbackGender: Gender | undefined,
                            list: SpeechSynthesisVoice[] = voicesFor(lang)): SpeechSynthesisVoice | null {
  if (!list.length) return null;
  const saved = prefs.voiceURI?.[lang];
  const byUri = saved ? list.find((v) => v.voiceURI === saved) : undefined;
  if (byUri) return byUri;
  const want = prefs.gender ?? fallbackGender;
  const exact = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-") === LANG_TAG[lang];
  const matching = want ? list.filter((v) => guessGender(v) === want) : [];
  return matching.find(exact) ?? matching[0] ?? list.find(exact) ?? list[0];
}

export function useSpeaker(lang: Lang, defaultGender?: Gender) {
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [voicesVersion, setVoicesVersion] = useState(0);
  const token = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!voiceSupport().tts) return;
    const bump = () => setVoicesVersion((v) => v + 1);
    window.speechSynthesis.addEventListener?.("voiceschanged", bump);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", bump);
  }, []);

  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  const cancel = useCallback(() => {
    token.current += 1;
    clearTimers();
    if (voiceSupport().tts) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((texts: string[], onDone?: () => void) => {
    if (!voiceSupport().tts) return;
    cancel();
    const mine = token.current;
    const chunks = texts.flatMap((t) => splitForSpeech(t));
    if (!chunks.length) return;

    const tag = LANG_TAG[lang];
    const voice = chooseVoice(lang, loadVoicePrefs(), defaultGender);
    // An English voice reading Arabic text is unintelligible, so don't speak at all: captions remain.
    if (!voice && window.speechSynthesis.getVoices().length > 0 && lang !== "en") { setNoVoice(true); return; }
    setNoVoice(false);

    setSpeaking(true);
    const finish = () => {
      if (token.current !== mine) return;
      clearTimers();
      setSpeaking(false);
      onDone?.();
    };
    // Safety net: if the browser never fires 'end', don't leave the room stuck in "speaking".
    timers.current.push(window.setTimeout(finish, chunks.join(" ").length * 90 + 8000));

    // Chrome can drop a speak() issued in the same tick as cancel(), so wait a moment.
    timers.current.push(window.setTimeout(() => {
      if (token.current !== mine) return;
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = tag;
        if (voice) u.voice = voice;
        u.rate = 0.95;
        if (i === chunks.length - 1) u.onend = finish;
        u.onerror = (e: SpeechSynthesisErrorEvent) => {
          if (e.error === "canceled" || e.error === "interrupted") return;
          finish();
        };
        window.speechSynthesis.speak(u);
      });
    }, 60));
  }, [lang, defaultGender, cancel, voicesVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => cancel, [cancel]); // stop talking when leaving the page
  return { speak, cancel, speaking, noVoice };
}

export function useDictation(lang: Lang, onText: (full: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);               // desktop app: the recording is being transcribed
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finished = useRef<Promise<void>>(Promise.resolve());
  const cutoff = useRef<number | undefined>(undefined);
  const discard = useRef(false);
  const rec = useRef<Recognition | null>(null);
  const want = useRef(false);
  const base = useRef("");
  const finals = useRef("");
  const restarts = useRef({ count: 0, last: 0 });
  const cb = useRef(onText);
  cb.current = onText;

  const fail = useCallback((msg: string) => {
    want.current = false;
    try { rec.current?.abort(); } catch { /* already stopped */ }
    setListening(false);
    setError(msg);
  }, []);

  const startRecording = useCallback(async (existingText: string) => {
    setError(null);
    base.current = existingText.trim() ? existingText.trim() + " " : "";
    discard.current = false;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { return setError((e as DOMException)?.name === "NotFoundError" ? VOICE_MESSAGES.noMic : VOICE_MESSAGES.denied); }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    chunks.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    finished.current = new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearTimeout(cutoff.current);
        setListening(false);
        const blob = new Blob(chunks.current, { type: recorder.mimeType || mime || "audio/webm" });
        if (discard.current) return resolve();
        if (blob.size < 1500) { setError(VOICE_MESSAGES.silent); return resolve(); }
        setBusy(true);
        try {
          const text = await api.transcribe(blob, lang, (await getAccessToken()) ?? "local");
          if (text) cb.current((base.current + text).trim()); else setError(VOICE_MESSAGES.silent);
        } catch (e) { setError(e instanceof ApiError ? e.message : VOICE_MESSAGES.generic); }
        setBusy(false);
        resolve();
      };
    });
    media.current = recorder;
    recorder.start(1000);
    setListening(true);
    cutoff.current = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 4 * 60 * 1000);
  }, [lang]);

  const start = useCallback((existingText: string) => {
    if (isDesktopApp()) return void startRecording(existingText);
    const Ctor = recognitionCtor();
    if (!Ctor) return setError(VOICE_MESSAGES.unsupported);
    setError(null);
    base.current = existingText.trim() ? existingText.trim() + " " : "";
    finals.current = "";

    const r = new Ctor();
    r.lang = LANG_TAG[lang];
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current += res[0].transcript.trim() + " ";
        else interim += res[0].transcript;
      }
      cb.current((base.current + finals.current + interim).trim());
    };
    r.onerror = (e) => {
      switch (e.error) {
        case "not-allowed": case "service-not-allowed": return fail(VOICE_MESSAGES.denied);
        case "audio-capture": return fail(VOICE_MESSAGES.noMic);
        case "network": return fail(VOICE_MESSAGES.network);
        default: return; // "no-speech" / "aborted": the onend handler decides
      }
    };
    r.onend = () => {
      if (!want.current) return setListening(false);
      // Browsers end a session after a pause; keep listening until the candidate presses Stop.
      const now = Date.now(), s = restarts.current;
      s.count = now - s.last < 1500 ? s.count + 1 : 0;
      s.last = now;
      if (s.count >= 4) return fail(VOICE_MESSAGES.silent); // restarting instantly = nothing is being heard
      try { r.start(); } catch { fail(VOICE_MESSAGES.generic); }
    };

    rec.current = r;
    want.current = true;
    restarts.current = { count: 0, last: Date.now() };
    try { r.start(); setListening(true); } catch { fail(VOICE_MESSAGES.generic); }
  }, [lang, fail, startRecording]);

  /** Resolves when the last words are in the text (desktop app: after transcription finishes). */
  const stop = useCallback((): Promise<void> => {
    want.current = false;
    if (media.current && media.current.state !== "inactive") media.current.stop();
    try { rec.current?.stop(); } catch { /* ignore */ }
    setListening(false);
    return finished.current;
  }, []);

  useEffect(() => () => {
    want.current = false; discard.current = true;
    window.clearTimeout(cutoff.current);
    try { if (media.current && media.current.state !== "inactive") media.current.stop(); } catch { /* ignore */ }
    try { rec.current?.abort(); } catch { /* ignore */ }
  }, []);
  return { start, stop, listening, busy, error, clearError: () => setError(null) };
}

/** Ask for microphone permission up front so problems show before the interview starts. */
export async function checkMicrophone(): Promise<"ok" | "denied" | "none" | "unsupported"> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "ok";
  } catch (e) {
    const name = (e as DOMException).name;
    return name === "NotFoundError" || name === "OverconstrainedError" ? "none" : "denied";
  }
}
