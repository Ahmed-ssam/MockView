import { describe, expect, it } from "vitest";
import { splitForSpeech, voiceSupport } from "../voice";

describe("splitForSpeech", () => {
  it("splits on sentence ends in English and Arabic", () => {
    expect(splitForSpeech("Hello there. How are you? Fine!")).toEqual(["Hello there.", "How are you?", "Fine!"]);
    expect(splitForSpeech("مرحبا بك. كيف حالك؟ جيد")).toHaveLength(3);
  });
  it("breaks one very long sentence into chunks no longer than the limit, losing no words", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const parts = splitForSpeech(long, 60);
    expect(parts.every((p) => p.length <= 60)).toBe(true);
    expect(parts.join(" ")).toBe(long);
  });
  it("handles empty and whitespace-only text", () => {
    expect(splitForSpeech("")).toEqual([]);
    expect(splitForSpeech("   \n ")).toEqual([]);
  });
});

describe("voiceSupport", () => {
  it("reports no support outside a browser (server rendering) without throwing", () => {
    expect(voiceSupport()).toEqual({ stt: false, tts: false });
  });
});
