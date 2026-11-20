import Link from "next/link";
import { Logo } from "./Logo";
import { NavActions } from "./NavActions";

const links = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#fields", label: "Tech Fields" },
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteNav() {
  return (
    <header className="bg-navy text-cream">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/">
          <Logo variant="compact" tone="dark" />
        </Link>
        <ul className="hidden items-center gap-7 text-sm md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-cream/80 hover:text-cream">{l.label}</Link>
            </li>
          ))}
        </ul>
        <NavActions />
      </nav>
    </header>
  );
}
