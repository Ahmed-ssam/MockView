"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell, Field, inputCls, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase";
import { useLocalMode } from "@/lib/localMode";
import { resetSchema, type ResetValues } from "@/lib/validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const local = useLocalMode();
  useEffect(() => { if (local) router.replace("/dashboard"); }, [local, router]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const supabase = getSupabase();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });

  async function onSubmit(v: ResetValues) {
    setError(null);
    if (!supabase) return setError("Password reset is not configured on this server yet.");
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return setError("We couldn't send the email. Please try again.");
    setSent(true); // same response whether or not the account exists
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
      footer={<Link href="/login" className="font-medium underline">Back to log in</Link>}
    >
      {!supabase && <Notice kind="info">Authentication is not configured in this environment.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {sent ? (
        <Notice kind="success">If an account exists for that email, a reset link is on its way.</Notice>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field id="email" label="Email" error={errors.email?.message}>
            <input id="email" type="email" autoComplete="email" className={inputCls} aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
          </Field>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center disabled:opacity-60">
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
