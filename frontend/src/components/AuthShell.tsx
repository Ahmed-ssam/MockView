import Link from "next/link";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo variant="full" />
        </Link>
        <div className="card p-7">
          <h1 className="font-serif text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-navy/70">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-navy/75">{footer}</p>}
      </div>
    </main>
  );
}

export function Field({ id, label, error, children }: {
  id: string; label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-control border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-blue focus:ring-2 focus:ring-soft-blue/50";

export function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: React.ReactNode }) {
  const tone = { error: "border-danger/40 bg-danger/5 text-danger", success: "border-success/40 bg-success/5 text-success", info: "border-slate-blue/30 bg-soft-blue/20 text-navy" }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`mb-4 rounded-control border px-3 py-2 text-sm ${tone}`}>{children}</div>;
}
