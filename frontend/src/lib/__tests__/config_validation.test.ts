import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, interviewConfigSchema } from "../interviewConfig";
import { loginSchema, resetSchema, signupSchema } from "../validation";

const base = { ...DEFAULT_CONFIG, specialization_slug: "web-development", level: "junior" as const };

describe("interviewConfigSchema", () => {
  it("accepts a complete config and the defaults are valid", () => expect(interviewConfigSchema.safeParse(base).success).toBe(true));
  it("requires a field and a level", () => {
    const r = interviewConfigSchema.safeParse({ ...DEFAULT_CONFIG });
    expect(r.success).toBe(false);
    const paths = !r.success ? r.error.issues.map((i) => i.path[0]) : [];
    expect(paths).toEqual(expect.arrayContaining(["specialization_slug", "level"]));
  });
  it.each([["duration_min", 20], ["language", "fr"], ["mode", "video"], ["difficulty", "insane"], ["level", "principal"]])("rejects bad %s", (k, v) => {
    expect(interviewConfigSchema.safeParse({ ...base, [k]: v }).success).toBe(false);
  });
  it("enforces text limits", () => {
    expect(interviewConfigSchema.safeParse({ ...base, job_description: "x".repeat(8001) }).success).toBe(false);
    expect(interviewConfigSchema.safeParse({ ...base, custom_instructions: "x".repeat(1001) }).success).toBe(false);
    expect(interviewConfigSchema.safeParse({ ...base, job_description: "x".repeat(8000) }).success).toBe(true);
  });
});

describe("auth schemas", () => {
  const ok = { displayName: "Sam", email: "sam@example.com", password: "correct-horse-1", confirm: "correct-horse-1" };
  it("accepts a valid signup", () => expect(signupSchema.safeParse(ok).success).toBe(true));
  it.each([["short", "abc1"], ["no digit", "abcdefghijkl"], ["no letter", "1234567890123"]])("rejects a %s password", (_n, pw) => {
    expect(signupSchema.safeParse({ ...ok, password: pw, confirm: pw }).success).toBe(false);
  });
  it("flags mismatched confirmation on the confirm field", () => {
    const r = signupSchema.safeParse({ ...ok, confirm: "different-1" });
    expect(!r.success && r.error.issues[0].path[0]).toBe("confirm");
  });
  it("validates emails", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(resetSchema.safeParse({ email: " a@b.co " }).success).toBe(true);
  });
});
