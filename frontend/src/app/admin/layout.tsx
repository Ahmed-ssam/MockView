import type { Metadata } from "next";

// Private pages: a clear title and kept out of search engines.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
