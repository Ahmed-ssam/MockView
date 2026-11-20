import Image from "next/image";

type Props = { variant?: "full" | "compact" | "icon"; tone?: "light" | "dark"; className?: string };

/**
 * MockView logo. The emblem is an SVG recreation of the Brand Identity Board
 * artwork (M monogram + armchair under a light cone). Swap /public/logo-icon.svg
 * with the original vector file when available.
 */
export function Logo({ variant = "full", tone = "light", className = "" }: Props) {
  const word = tone === "dark" ? "text-cream" : "text-navy";
  const accent = tone === "dark" ? "text-soft-blue" : "text-slate-blue";
  const size = variant === "full" ? 44 : 32;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {tone === "dark" ? (
        // Navy emblem needs a light tile on dark backgrounds (as in the brand board's app icon).
        <span className="flex items-center justify-center rounded-lg bg-cream p-1">
          <Image src="/logo-icon.svg" alt={variant === "icon" ? "MockView" : ""} width={size - 8} height={size - 8} priority />
        </span>
      ) : (
        <Image src="/logo-icon.svg" alt={variant === "icon" ? "MockView" : ""} width={size} height={size} priority />
      )}
      {variant !== "icon" && (
        <span className="flex flex-col leading-none">
          <span className={`font-serif font-semibold ${variant === "full" ? "text-2xl" : "text-lg"} ${word}`}>
            Mock<span className={accent}>View</span>
          </span>
          {variant === "full" && (
            <span className={`mt-1 text-[9px] font-medium uppercase tracking-[0.3em] ${accent}`}>
              AI Mock Interviews
            </span>
          )}
        </span>
      )}
    </span>
  );
}
