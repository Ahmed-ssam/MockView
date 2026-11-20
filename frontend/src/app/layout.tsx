import type { Metadata } from "next";
// Self-hosted fonts (no runtime or build-time request to Google).
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL;
const description = "Practice technical interviews across 64 technology fields with a spoken AI interviewer and get detailed feedback.";

export const metadata: Metadata = {
  ...(site ? { metadataBase: new URL(site) } : {}),
  title: { default: "MockView: AI Mock Interviews", template: "%s | MockView" },
  description,
  openGraph: { title: "MockView: AI Mock Interviews", description, type: "website", siteName: "MockView" },
  twitter: { card: "summary", title: "MockView: AI Mock Interviews", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
