import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerAI — Stop applying everywhere",
  description:
    "Target the jobs you can actually win, backed by evidence from your own career history.",
};

const fontVars: CSSProperties = {
  "--font-fraunces": 'Fraunces, Georgia, Cambria, "Times New Roman", Times, serif',
  "--font-plex-sans":
    '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  "--font-plex-mono":
    '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={fontVars}>
      <body className="font-body bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
