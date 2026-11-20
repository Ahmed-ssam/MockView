import { describe, expect, it } from "vitest";
import { chooseVoice, guessGender } from "../voice";

const v = (name: string, lang: string, voiceURI = name) => ({ name, lang, voiceURI }) as SpeechSynthesisVoice;

describe("guessGender", () => {
  it("recognises common English and Arabic voice names", () => {
    expect(guessGender({ name: "Microsoft Zira - English (United States)" })).toBe("female");
    expect(guessGender({ name: "Google UK English Female" })).toBe("female");   // "female" must not match "male"
    expect(guessGender({ name: "Google UK English Male" })).toBe("male");
    expect(guessGender({ name: "Microsoft David Desktop" })).toBe("male");
    expect(guessGender({ name: "Microsoft Hoda Online (Natural) - Arabic (Egypt)" })).toBe("female");
    expect(guessGender({ name: "Microsoft Naayf - Arabic (Saudi Arabia)" })).toBe("male");
    expect(guessGender({ name: "Majed" })).toBe("male");
    expect(guessGender({ name: "Some Unknown Voice" })).toBe("unknown");
  });
});

describe("chooseVoice", () => {
  const list = [v("Microsoft Naayf", "ar-SA"), v("Microsoft Hoda", "ar-EG"), v("Microsoft Salma", "ar-SA"), v("Mystery", "ar-AE")];
  it("honours a saved voice", () => {
    expect(chooseVoice("ar", { voiceURI: { ar: "Microsoft Hoda" } }, "male", list)?.name).toBe("Microsoft Hoda");
  });
  it("otherwise matches the wanted gender, preferring the exact locale", () => {
    expect(chooseVoice("ar", {}, "female", list)?.name).toBe("Microsoft Salma");
    expect(chooseVoice("ar", { gender: "male" }, "female", list)?.name).toBe("Microsoft Naayf");   // the person's choice wins
  });
  it("falls back to any voice in the language, and to null when there is none", () => {
    expect(chooseVoice("ar", {}, "male", [v("Mystery", "ar-AE")])?.name).toBe("Mystery");
    expect(chooseVoice("ar", {}, "male", [])).toBeNull();
  });
  it("ignores a saved voice that is no longer installed", () => {
    expect(chooseVoice("ar", { voiceURI: { ar: "gone" } }, "male", list)?.name).toBe("Microsoft Naayf");
  });
});
