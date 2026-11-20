"use client";

import { useEffect, useId, useState } from "react";
import { Volume2 } from "lucide-react";
import { guessGender, loadVoicePrefs, saveVoicePrefs, voicesFor, voiceSupport, type Gender, type Lang, type VoicePrefs } from "@/lib/voice";

const LABEL = { male: "Male", female: "Female", unknown: "Other" } as const;

/** Lets the person choose the interviewer's voice (male/female and a specific installed voice) for the interview language.
 *  The choice is remembered in this browser only. */
export function VoicePicker({ lang, defaultGender, onPreview, speaking }: {
  lang: Lang; defaultGender: Gender; onPreview: () => void; speaking: boolean;
}) {
  const uid = useId();
  const [version, setVersion] = useState(0);
  const [prefs, setPrefs] = useState<VoicePrefs>({});
  useEffect(() => { setPrefs(loadVoicePrefs()); }, []);
  useEffect(() => {
    if (!voiceSupport().tts) return;
    const bump = () => setVersion((v) => v + 1);
    window.speechSynthesis.addEventListener?.("voiceschanged", bump);
    bump();
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", bump);
  }, []);
  if (!voiceSupport().tts) return null;

  const voices = voicesFor(lang);
  void version;
  const gender = prefs.gender ?? defaultGender;
  const update = (next: VoicePrefs) => { setPrefs(next); saveVoicePrefs(next); };
  const langName = lang === "ar" ? "Arabic" : "English";

  return (
    <fieldset className="mt-5 rounded-control border border-border p-4 text-left">
      <legend className="px-1 text-sm font-medium">Interviewer voice ({langName})</legend>
      <div className="flex gap-5" role="radiogroup" aria-label="Voice gender">
        {(["male", "female"] as const).map((g) => (
          <label key={g} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`${uid}-g`} checked={gender === g}
              onChange={() => update({ ...prefs, gender: g, voiceURI: { ...prefs.voiceURI, [lang]: undefined } })} />
            {LABEL[g]}
          </label>
        ))}
      </div>
      <label htmlFor={`${uid}-v`} className="mt-3 block text-sm">Specific voice</label>
      <select id={`${uid}-v`} className="mt-1 w-full rounded-control border border-border bg-white px-2 py-2 text-sm"
        value={prefs.voiceURI?.[lang] ?? ""}
        onChange={(e) => {
          const uri = e.target.value || undefined;
          const picked = voices.find((v) => v.voiceURI === uri);
          const g = picked ? guessGender(picked) : "unknown";
          update({ ...prefs, ...(g !== "unknown" ? { gender: g } : {}), voiceURI: { ...prefs.voiceURI, [lang]: uri } });
        }}>
        <option value="">Automatic (best {gender} match)</option>
        {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({LABEL[guessGender(v)]})</option>)}
      </select>
      {voices.length === 0 ? (
        <p className="mt-2 text-xs text-navy/75">
          No {langName} voices are installed on this device.{lang === "ar" && " Install an Arabic voice in your system's text-to-speech settings (Windows: Settings → Time & language → Speech; Android/macOS: Accessibility → Spoken content), then reload."}
        </p>
      ) : (
        <p className="mt-2 text-xs text-navy/75">Gender is guessed from the voice name. Available voices depend on your device and browser.</p>
      )}
      <button type="button" className="btn-outline mt-3" onClick={onPreview} disabled={speaking || voices.length === 0}>
        <Volume2 size={16} aria-hidden /> {speaking ? "Playing…" : "Preview voice"}
      </button>
    </fieldset>
  );
}
