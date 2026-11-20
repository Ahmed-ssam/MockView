"use client";

// Last-resort boundary: replaces the root layout, so it must render its own <html> and avoid app styles/components.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F8F4EC", color: "#0B1F3B", textAlign: "center", padding: "5rem 1rem" }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "8px 18px", borderRadius: 8, border: 0, background: "#0B1F3B", color: "#F8F4EC" }}>Try again</button>
      </body>
    </html>
  );
}
