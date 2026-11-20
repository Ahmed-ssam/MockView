import type { Config } from "tailwindcss";

// MockView design tokens — taken from the Brand Identity Board.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0B1F3B", 700: "#12294A", 600: "#1B3558" },
        slate: { blue: "#376A90" },
        soft: { blue: "#8FB6D9" },
        sand: { DEFAULT: "#F4C992", dark: "#E8B574" },
        cream: { DEFAULT: "#F8F4EC", 200: "#EFE9DC" },
        // semantic (readability/feedback only)
        success: "#2E7D5B",
        danger: "#B23A27",
        border: "#E3DCCB",
      },
      fontFamily: {
        serif: ["'Playfair Display Variable'", "Playfair Display", "serif"],
        sans: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "12px", control: "8px" },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,59,0.06), 0 4px 12px rgba(11,31,59,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
