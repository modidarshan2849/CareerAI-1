import fs from "fs";
import path from "path";

// 1. Restore original app/dashboard/page.tsx.bak if present
if (fs.existsSync("app/dashboard/page.tsx.bak")) {
  fs.copyFileSync("app/dashboard/page.tsx.bak", "app/dashboard/page.tsx");
  console.log("✅ Restored original app/dashboard/page.tsx from .bak");
}

// 2. Bypass middleware.ts completely
for (const mw of ["middleware.ts", "src/middleware.ts"]) {
  if (fs.existsSync(mw)) {
    fs.writeFileSync(
      mw,
      `import { NextResponse } from "next/server";\nexport function middleware() {\n  return NextResponse.next();\n}\n`,
      "utf8"
    );
    console.log("✅ Bypassed middleware:", mw);
  }
}

// 3. Patch lib/supabase/client.ts so auth.getUser() & auth.getSession() always succeed
// while keeping all database queries (.from()) connected to your real Supabase project
const clientFiles = ["lib/supabase/client.ts", "src/lib/supabase/client.ts", "utils/supabase/client.ts"];
for (const cf of clientFiles) {
  if (fs.existsSync(cf)) {
    fs.writeFileSync(
      cf,
      `import { createBrowserClient } from "@supabase/ssr";

const LOCAL_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "darshan@careerai.local",
  role: "authenticated",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Darshan Modi" },
  created_at: new Date().toISOString()
};

export function createClient() {
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fnemfziivufcwelnbxlf.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_vt3jrwc5bunlttruDOMoBg_NLQMSfKp"
  );

  client.auth.getUser = async () => ({
    data: { user: LOCAL_USER as any },
    error: null
  });

  client.auth.getSession = async () => ({
    data: {
      session: {
        access_token: "local-bypass-token",
        refresh_token: "local-bypass-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: LOCAL_USER as any
      }
    },
    error: null
  });

  return client;
}
`,
      "utf8"
    );
    console.log("✅ Patched Supabase browser client with permanent session:", cf);
  }
}

// 4. Find all login page files and replace with auto-redirect + direct link to /dashboard
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      if (full.includes("login") && full.endsWith("page.tsx")) {
        fs.writeFileSync(
          full,
          `"use client";
import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    window.location.replace("/dashboard");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl border border-gray-800 text-center space-y-4">
        <h2 className="text-2xl font-bold">CareerAI Local Bypass</h2>
        <p className="text-sm text-gray-400">Redirecting directly to your dashboard...</p>
        <a
          href="/dashboard"
          className="inline-block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg"
        >
          Open Dashboard Now &rarr;
        </a>
      </div>
    </div>
  );
}
`,
          "utf8"
        );
        console.log("✅ Updated login page with instant redirect:", full);
      } else {
        // Strip any server/client redirects to /login in layouts or pages
        let code = fs.readFileSync(full, "utf8");
        const updated = code
          .replace(/redirect\(['"`]\/login['"`]\)/g, "/* bypassed login redirect */")
          .replace(/router\.(?:push|replace)\(['"`]\/login['"`]\)/g, "/* bypassed login router */");
        if (updated !== code) {
          fs.writeFileSync(full, updated, "utf8");
          console.log("✅ Removed /login redirect in:", full);
        }
      }
    }
  }
}

walk("app");
walk("src");
walk("lib");
