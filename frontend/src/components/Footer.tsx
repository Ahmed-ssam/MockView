import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-navy text-cream/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-3">
        <div>
          <Logo variant="full" tone="dark" />
          <p className="mt-4 max-w-xs text-sm">Practice technical interviews with a personalized AI interviewer.</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-medium text-cream">Product</p>
          <ul className="space-y-2">
            <li><Link href="/interview/new" className="hover:text-cream">Start an interview</Link></li>
            <li><Link href="/#fields" className="hover:text-cream">Technical fields</Link></li>
            <li><Link href="/#faq" className="hover:text-cream">FAQ</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-medium text-cream">Good to know</p>
          <ul className="mb-3 space-y-2">
            <li><Link href="/privacy" className="hover:text-cream">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-cream">Terms of Use</Link></li>
          </ul>
          <p>
            MockView is a practice tool. Scores reflect your answers in a practice session and do not predict
            hiring outcomes.
          </p>
        </div>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs">© {new Date().getFullYear()} MockView</div>
    </footer>
  );
}
