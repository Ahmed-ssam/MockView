import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage } from "../api";

const respond = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => { if (body === undefined) throw new Error("no body"); return body; }, blob: async () => new Blob(["%PDF"]) });

afterEach(() => vi.unstubAllGlobals());

describe("errorMessage", () => {
  it("uses string details as-is", () => expect(errorMessage({ detail: "Nope" }, "x")).toBe("Nope"));
  it("flattens FastAPI validation errors instead of showing [object Object]", () => {
    expect(errorMessage({ detail: [{ msg: "field required", loc: ["body", "a"] }, { msg: "too long" }] }, "x")).toBe("field required; too long");
  });
  it("falls back for missing or odd bodies", () => {
    for (const b of [null, undefined, {}, { detail: [] }, { detail: [1, 2] }, { detail: 5 }]) expect(errorMessage(b, "fb")).toBe("fb");
  });
});

describe("api requests", () => {
  it("sends the bearer token and never caches", async () => {
    const f = respond(200, { items: [] }); vi.stubGlobal("fetch", f);
    await api.history("tok");
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toContain("/api/v1/history");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.cache).toBe("no-store");
  });
  it("turns an API error into ApiError with its message and status", async () => {
    vi.stubGlobal("fetch", respond(429, { detail: "Daily limit of 3 interviews reached." }));
    await expect(api.history("t")).rejects.toMatchObject({ status: 429, message: "Daily limit of 3 interviews reached." });
  });
  it("reports an unreachable server in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const e = await api.history("t").catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(0);
    expect(e.message).toMatch(/Cannot reach/);
  });
  it("handles an empty 204 reply (delete)", async () => {
    vi.stubGlobal("fetch", respond(204));
    await expect(api.deleteInterview("abc", "t")).resolves.toBeUndefined();
  });
  it("encodes ids in paths", async () => {
    const f = respond(200, {}); vi.stubGlobal("fetch", f);
    await api.report("a/b?c", "t");
    expect(String(f.mock.calls[0][0])).toContain("a%2Fb%3Fc");
  });
  it("downloads a PDF as a blob and surfaces its error message", async () => {
    vi.stubGlobal("fetch", respond(200, {}));
    expect(await api.reportPdf("id", "t")).toBeInstanceOf(Blob);
    vi.stubGlobal("fetch", respond(422, { detail: "PDF export isn't available for Arabic reports yet." }));
    await expect(api.reportPdf("id", "t")).rejects.toMatchObject({ status: 422, message: expect.stringContaining("Arabic") });
  });
  it("uploads a resume as multipart without forcing a JSON content type", async () => {
    const f = respond(201, { id: "r", chars: 100, preview: "", consent_at: "" }); vi.stubGlobal("fetch", f);
    await api.uploadResume(new File(["%PDF"], "cv.pdf", { type: "application/pdf" }), true, "t");
    const init = f.mock.calls[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("consent")).toBe("true");
    expect(init.headers["Content-Type"]).toBeUndefined();   // the browser must add the multipart boundary itself
  });
});
