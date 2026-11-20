const dev = process.env.NODE_ENV !== "production";
const origin = (u) => { try { return u ? new URL(u).origin : null; } catch { return null; } };

// Only the API and the auth provider may be contacted from the browser.
const connect = ["'self'", origin(process.env.NEXT_PUBLIC_API_URL), origin(process.env.NEXT_PUBLIC_SUPABASE_URL),
  ...(dev ? ["ws:", "http://localhost:*"] : [])].filter(Boolean);

const csp = [
  "default-src 'self'",
  // Next.js injects small inline bootstrap scripts; 'unsafe-eval' is only needed by the dev server.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connect.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone", // small production image (see Dockerfile)
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // The microphone is needed for spoken interviews, on this origin only.
        { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
        ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
      ],
    }];
  },
};
export default nextConfig;
