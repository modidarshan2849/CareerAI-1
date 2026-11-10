"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      // Friendly authentication errors (section 13) — never surface raw provider error text.
      setError(
        error.message.toLowerCase().includes("invalid login credentials")
          ? "That email or password doesn't match our records."
          : "Something went wrong signing you in. Please try again."
      );
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  async function handleGoogleLogin() {
    // Requires Google OAuth to be configured in the Supabase dashboard
    // (Authentication > Providers > Google) before this will succeed.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-1">Welcome back</h1>
        <p className="text-sm text-slate mb-8">Sign in to continue building your career profile.</p>

        {error && (
          <div className="mb-6 rounded-md bg-signal-red-bg text-signal-red text-sm px-3 py-2.5">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0" htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs text-verdigris hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-hairline flex-1" />
          <span className="text-xs text-slate-light">or</span>
          <div className="h-px bg-hairline flex-1" />
        </div>

        <button onClick={handleGoogleLogin} className="btn-secondary w-full">
          Continue with Google
        </button>

        <p className="text-sm text-slate mt-8 text-center">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-verdigris hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}


export default function LoginPage(props: any) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-500">Loading...</div>}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}
