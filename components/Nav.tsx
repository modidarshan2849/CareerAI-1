"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ active }: { active?: string }) {
  const pathname = usePathname();
  const current = active || pathname;

  const links = [
    { href: "/dashboard", label: "Matches Feed" },
    { href: "/applications", label: "Pipeline" },
    { href: "/profile/review", label: "Profile Evidence" },
    { href: "/preferences", label: "Preferences" },
  ];

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-black text-lg tracking-tight">
            <span className="h-6 w-6 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-mono font-bold">
              C
            </span>
            <span>CareerAI</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {links.map((link) => {
              const isActive = current === link.href || current.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                      : "text-slate-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/portal", { method: "POST" });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              } catch (err) {
                console.error("Portal error:", err);
              }
            }}
            className="text-xs font-bold px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl transition-all"
          >
            Billing
          </button>
        </div>
      </div>
    </header>
  );
}
