import { z } from "zod";

export const LEVELS = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Expert" },
] as const;

export const DIFFICULTIES = [
  { value: "easy", label: "Easy", hint: "Core concepts, gentle pacing" },
  { value: "medium", label: "Medium", hint: "Practical scenarios and trade-offs" },
  { value: "hard", label: "Hard", hint: "Depth, edge cases and design decisions" },
  { value: "adaptive", label: "Adaptive", hint: "Adjusts to how you answer" },
] as const;

export const DURATIONS = [15, 30, 45, 60] as const;

// Mirrors backend InterviewConfig (app/schemas/interview.py). The server re-validates everything.
export const interviewConfigSchema = z.object({
  specialization_slug: z.string().min(1, "Choose a field"),
  level: z.enum(["intern", "junior", "mid", "senior", "lead"], { required_error: "Choose your level" }),
  difficulty: z.enum(["easy", "medium", "hard", "adaptive"]),
  language: z.enum(["en", "ar"]),
  mode: z.enum(["text", "voice", "both"]),
  duration_min: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  personality: z.string().min(1),
  interviewer_experience: z.string().min(1),
  avatar_id: z.string().min(1),
  target_job_title: z.string().max(120, "Keep it under 120 characters").optional(),
  job_description: z.string().max(8000, "Keep it under 8,000 characters").optional(),
  custom_instructions: z.string().max(1000, "Keep it under 1,000 characters").optional(),
  resume_id: z.string().max(36).optional(),
});

export type InterviewConfig = z.infer<typeof interviewConfigSchema>;

export const DEFAULT_CONFIG: Omit<InterviewConfig, "specialization_slug" | "level"> = {
  difficulty: "adaptive",
  language: "en",
  mode: "text",
  duration_min: 30,
  personality: "professional",
  interviewer_experience: "experienced",
  avatar_id: "alex",
};
