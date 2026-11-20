const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SpecializationSummary = {
  slug: string;
  name: string;
  category: string;
  description: string;
};

export type SpecializationDetail = SpecializationSummary & {
  core_competencies: string[];
  technical_topics: string[];
  tools: string[];
  question_categories: Record<string, number>;
  evaluation_dimensions: string[];
  learning_topics: string[];
};

export type LocalSettings = { key_set: boolean; key_hint: string | null; model: string; provider: "gemini" | "demo" };

export type Personality = { key: string; name: string; summary: string; traits: string[] };
export type ExperienceLevel = { key: string; name: string; summary: string };
export type Avatar = { id: string; role_title: string; role_ar: string; asset_url: string; voice_gender: "male" | "female" };

export type QuestionOut = {
  id: string; // "intro" for the warm-up introduction
  position: number; // 0 for the introduction
  text: string;
  is_followup: boolean;
  kind: "intro" | "main" | "followup";
};
export type Message = { role: "interviewer" | "candidate"; text: string; question_id: string | null };
export type Progress = { answered_main: number; total_main: number; current_position: number | null };
export type InterviewView = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  demo_mode: boolean;
  specialization_slug: string;
  specialization_name: string;
  level: string;
  difficulty: string;
  language: "en" | "ar";
  duration_min: number | null;
  mode: "text" | "voice" | "both";
  interviewer: { role_title: string; avatar_url: string; personality: string; voice_gender: "male" | "female" };
  progress: Progress;
  current_question: QuestionOut | null;
  messages: Message[];
  ready_to_finish: boolean;
  started_at: string;
};
export type AnswerResult = {
  interviewer_message: string;
  next_question: QuestionOut | null;
  progress: Progress;
  ready_to_finish: boolean;
  demo_mode: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** FastAPI sends `detail` as a string for our errors but as a list of objects for request-validation errors. */
export function errorMessage(body: unknown, fallback: string): string {
  const d = (body as { detail?: unknown } | null)?.detail;
  if (typeof d === "string" && d) return d;
  if (Array.isArray(d)) {
    const msgs = d.map((x) => (x && typeof x === "object" && "msg" in x ? String((x as { msg: unknown }).msg) : "")).filter(Boolean);
    if (msgs.length) return msgs.join("; ");
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError(0, "Cannot reach the MockView server. Please try again.");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(detail, `Request failed (${res.status})`));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type ReportQuestion = {
  id: string; position: number; category: string; question: string; answer: string; skipped: boolean;
  score: number; verdict: string; did_well: string[]; missing: string[]; incorrect_statements: string[];
  explanation: string; expected_elements: string[]; improved_answer: string; tip: string;
  followup: Omit<ReportQuestion, "position" | "category" | "followup"> | null;
};
export type Report = {
  id: string; specialization: string; level: string; difficulty: string; language: string; mode: string;
  completed_at: string | null; demo_mode: boolean; overall_score: number; performance_level: string;
  scoring_version: string; radar: Record<string, number | null>; retry_of_id: string | null; can_practice: boolean;
  strengths: { skill: string; score: number; evidence: string[] }[];
  weaknesses: { skill: string; score: number; evidence: string[] }[];
  coach_summary: string;
  skills: { skill: string; score: number | null; level: string | null; evidence: string[]; strengths: string[]; improvements: string[] }[];
  questions: ReportQuestion[];
  recommendations: { priority: "high" | "medium" | "recommended"; topic: string; explanation: string; why_it_matters: string; activity: string; expected_improvement: string }[];
  roadmap: { step: number; focus: string; priority: string; activity: string }[];
};

export type HistoryItem = {
  id: string; specialization: string; level: string; difficulty: string; mode: string;
  status: "in_progress" | "completed" | "abandoned"; demo_mode: boolean; started_at: string;
  completed_at: string | null; retry_of_id: string | null; overall_score: number | null; performance_level: string | null; has_report: boolean;
};
export type History = {
  items: HistoryItem[];
  progress: { completed: number; counted: number; average: number | null; best: number | null;
    trend: { id: string; date: string; score: number; specialization: string }[] };
};
type Side = { id: string; date: string; overall_score: number; level: string; performance_level: string; demo_mode: boolean };
export type Comparison = {
  specialization: string; before: Side; after: Side; overall_delta: number; caveat: string;
  dimensions: { skill: string; before: number | null; after: number | null; delta: number | null }[];
};

async function downloadPdf(path: string, token: string): Promise<Blob> {
  let res: Response;
  try { res = await fetch(`${BASE}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); }
  catch { throw new ApiError(0, "Cannot reach the MockView server. Please try again."); }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(detail, `Download failed (${res.status})`));
  }
  return res.blob();
}

export type ResumeInfo = { id: string; chars: number; preview: string; consent_at: string };

async function uploadResume(file: File, consent: boolean, token: string): Promise<ResumeInfo> {
  const form = new FormData();
  form.append("file", file);
  form.append("consent", consent ? "true" : "false");
  let res: Response;
  try { res = await fetch(`${BASE}/api/v1/resumes`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }); }
  catch { throw new ApiError(0, "Cannot reach the MockView server. Please try again."); }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(detail, `Upload failed (${res.status})`));
  }
  return res.json();
}

export type AdminStats = {
  ai: { provider: string; demo_mode: boolean }; users: number; resumes_stored: number; note: string;
  interviews: { total: number; in_progress: number; completed: number; abandoned: number; last_24h: number; last_7d: number; demo: number; completion_rate: number | null };
  daily: { date: string; interviews: number }[];
  real_reports: { count: number; average_score: number | null; levels: Record<string, number> };
  languages: Record<string, number>; modes: Record<string, number>;
  top_specializations: { name: string; interviews: number }[];
};
export type AdminUser = { id: string; display_name: string | null; role: string; created_at: string; interviews: number; last_interview_at: string | null };
export type AdminInterview = { id: string; user_id: string; specialization: string; level: string; status: string; demo_mode: boolean; started_at: string; overall_score: number | null };
export type CatalogHealth = { count: number; issues: string[]; items: { slug: string; name: string; category: string; interviews: number; problems: string[] }[] };

export type AuditEntry = { id: string; actor_id: string; action: string; target_id: string | null; detail: Record<string, number> | null; created_at: string };

export const api = {
  specializations: (params?: { category?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.q) qs.set("q", params.q);
    const s = qs.toString();
    return request<SpecializationSummary[]>(`/specializations${s ? `?${s}` : ""}`);
  },
  categories: () => request<string[]>("/specializations/categories"),
  specialization: (slug: string) => request<SpecializationDetail>(`/specializations/${encodeURIComponent(slug)}`),
  personalities: () => request<Personality[]>("/interviewers/personalities"),
  experienceLevels: () => request<ExperienceLevel[]>("/interviewers/experience-levels"),
  avatars: () => request<Avatar[]>("/interviewers/avatars"),
  createInterview: (config: unknown, token: string) =>
    request<InterviewView>("/interviews", { method: "POST", body: JSON.stringify(config), token }),
  interview: (id: string, token: string) => request<InterviewView>(`/interviews/${encodeURIComponent(id)}`, { token }),
  submitAnswer: (id: string, body: { text: string; skipped: boolean; source: "text" | "voice" }, token: string) =>
    request<AnswerResult>(`/interviews/${encodeURIComponent(id)}/answers`, {
      method: "POST", body: JSON.stringify(body), token,
    }),
  abandonInterview: (id: string, token: string) =>
    request<InterviewView>(`/interviews/${encodeURIComponent(id)}/abandon`, { method: "POST", token }),
  finishInterview: (id: string, token: string) =>
    request<Report>(`/interviews/${encodeURIComponent(id)}/finish`, { method: "POST", token }),
  report: (id: string, token: string) => request<Report>(`/interviews/${encodeURIComponent(id)}/report`, { token }),
  history: (token: string) => request<History>("/history", { token }),
  compare: (base: string, other: string, token: string) =>
    request<Comparison>(`/history/compare?base=${encodeURIComponent(base)}&other=${encodeURIComponent(other)}`, { token }),
  deleteInterview: (id: string, token: string) =>
    request<void>(`/interviews/${encodeURIComponent(id)}`, { method: "DELETE", token }),
  reportPdf: (id: string, token: string) => downloadPdf(`/interviews/${encodeURIComponent(id)}/report.pdf`, token),
  uploadResume,
  transcribe: async (audio: Blob, language: string, token: string): Promise<string> => {
    const form = new FormData();
    form.append("file", audio, "answer.webm");
    form.append("language", language);
    let res: Response;
    try { res = await fetch(`${BASE}/api/v1/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }); }
    catch { throw new ApiError(0, "Cannot reach the MockView server. Please try again."); }
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new ApiError(res.status, errorMessage(detail, `Transcription failed (${res.status})`));
    }
    return ((await res.json()) as { text: string }).text;
  },
  deleteResume: (id: string, token: string) =>
    request<void>(`/resumes/${encodeURIComponent(id)}`, { method: "DELETE", token }),
  practiceWeakAreas: (id: string, token: string) =>
    request<{ id: string }>(`/interviews/${encodeURIComponent(id)}/practice`, { method: "POST", token }),
  adminStats: (token: string) => request<AdminStats>("/admin/stats", { token }),
  adminUsers: (token: string) => request<AdminUser[]>("/admin/users?limit=100", { token }),
  adminInterviews: (token: string) => request<AdminInterview[]>("/admin/interviews?limit=30", { token }),
  adminCatalog: (token: string) => request<CatalogHealth>("/admin/catalog", { token }),
  adminEraseUser: (id: string, token: string) =>
    request<{ interviews: number; resumes: number; job_descriptions: number }>(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", token }),
  deleteMyAccount: (token: string) =>
    request<{ interviews: number; resumes: number; job_descriptions: number; login_deleted: boolean }>("/me", { method: "DELETE", token }),
  settings: () => request<LocalSettings>("/settings"),
  saveSettings: (body: { api_key?: string; model?: string }) =>
    request<LocalSettings>("/settings", { method: "PUT", body: JSON.stringify(body) }),
  listModels: (body: { api_key?: string }) =>
    request<{ ok: boolean; message: string; models: string[]; method?: "listed" | "probed" }>("/settings/models", { method: "POST", body: JSON.stringify(body) }),
  removeKey: () => request<LocalSettings>("/settings/key", { method: "DELETE" }),
  testKey: (body: { api_key?: string; model?: string }) =>
    request<{ ok: boolean; message: string }>("/settings/test", { method: "POST", body: JSON.stringify(body) }),
  adminAudit: (token: string) => request<AuditEntry[]>("/admin/audit?limit=20", { token }),
};
