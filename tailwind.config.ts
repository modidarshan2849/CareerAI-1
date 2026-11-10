import type { Config } from "tailwindcss";

/**
 * Design direction: "evidence dossier" — this product's entire premise is
 * that every claim needs a source. Visual language borrows from case files
 * and verification stamps rather than generic SaaS gradients.
 *
 * Palette (named, not defaults):
 *   ink       #12161C  — primary text / dark surfaces
 *   paper     #F3F5F6  — cool, neutral background (not warm cream)
 *   verdigris #1F6F62  — primary accent (deliberately not terracotta)
 *   slate     #4B5563  — secondary text
 *   signal-green / signal-amber / signal-red map directly to the
 *   GREEN/AMBER/RED match statuses defined in the product spec — these are
 *   functional colors, not decoration.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12161C",
        paper: "#F3F5F6",
        "paper-raised": "#FFFFFF",
        verdigris: {
          DEFAULT: "#1F6F62",
          dark: "#164F45",
          light: "#E4F0EE",
        },
        slate: {
          DEFAULT: "#4B5563",
          light: "#8A93A0",
        },
        signal: {
          green: "#2E7D5B",
          "green-bg": "#E8F4EE",
          amber: "#B8730F",
          "amber-bg": "#FBF0DF",
          red: "#B23A34",
          "red-bg": "#FBEAE9",
        },
        hairline: "#DDE1E6",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
