import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="text-sm font-medium text-slate-blue">404</p>
        <h1 className="mt-2 font-serif text-4xl">We can&apos;t find that page</h1>
        <p className="mt-3 text-navy/75">The link may be old or mistyped.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn-primary">Home</Link>
          <Link href="/dashboard" className="btn-outline">Dashboard</Link>
        </div>
      </main>
    </>
  );
}
