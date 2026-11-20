import type { MetadataRoute } from "next";

// Lets Chrome/Edge show MockView's own icon and name for its app-style window and taskbar button.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MockView",
    short_name: "MockView",
    description: "Practice technical interviews out loud with an AI interviewer.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F4EC",
    theme_color: "#0B1F3B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
