"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell, Field, inputCls, Notice } from "@/components/AuthShell";
import { getSupabase } from "@/lib/supabase";
import { useLocalMode } from "@/lib/localMode";
import { signupSchema, type SignupValues } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const local = useLocalMode();
  useEffect(() => { if (local) router.replace("/dashboard"); }, [local, router]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const supabase = getSupabase();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(v: SignupValues) {
    setError(null);
    if (!supabase) return setError("Sign-up is not configured on this server yet.");
    const { error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { display_name: v.displayName }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) return setError(error.message);
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell title="Check your email">
        <Notice kind="success">We sent a verification link. Open it to activate your account, then log in.</Notice>
        <Link href="/login" className="btn-primary w-full justify-center">Go to log in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. We only ask for what we need."
      footer={<>Already registered? <Link href="/login" className="font-medium underline">Log in</Link></>}
    >
      {!supabase && <Notice kind="info">Authentication is not configured in this environment.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field id="displayName" label="Name" error={errors.displayName?.message}>
          <input id="displayName" autoComplete="name" className={inputCls} aria-invalid={!!errors.displayName}
            aria-describedby={errors.displayName ? "displayName-error" : undefined} {...register("displayName")} />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputCls} aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
        </Field>
        <Field id="password" label="Password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="new-password" className={inputCls} aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
        </Field>
        <Field id="confirm" label="Confirm password" error={errors.confirm?.message}>
          <input id="confirm" type="password" autoComplete="new-password" className={inputCls} aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "confirm-error" : undefined} {...register("confirm")} />
        </Field>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center disabled:opacity-60">
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
