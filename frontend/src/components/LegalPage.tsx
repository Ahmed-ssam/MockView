import Link from "next/link";
import { SiteNav } from "./SiteNav";
import { Footer } from "./Footer";

export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-serif text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-navy/75">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-navy/85 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-navy [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
        <p className="mt-10 text-sm text-navy/70">
          Questions? {CONTACT ? <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a> : "Please contact the operator of this site."}{" "}
          <Link href="/" className="underline">Back to home</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
