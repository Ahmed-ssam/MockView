"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell, Field, inputCls, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase";
import { useLocalMode } from "@/lib/localMode";
import { loginSchema, type LoginValues } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const local = useLocalMode();
  useEffect(() => { if (local) router.replace("/dashboard"); }, [local, router]);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabase();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(v: LoginValues) {
    setError(null);
    if (!supabase) return setError("Sign-in is not configured on this server yet.");
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) {
      // Same message for unknown email and wrong password.
      return setError(error.message.toLowerCase().includes("confirm") ? "Please verify your email first." : "Incorrect email or password.");
    }
    // Only same-site relative paths are allowed as a return target (no open redirects).
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your interviews and reports."
      footer={<>New to MockView? <Link href="/signup" className="font-medium underline">Create an account</Link></>}
    >
      {!supabase && <Notice kind="info">Authentication is not configured in this environment.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field id="email" label="Email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputCls}
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" className={inputCls}
            aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
        </Field>
        <div className="text-right text-sm"><Link href="/reset-password" className="underline">Forgot password?</Link></div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center disabled:opacity-60">
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
