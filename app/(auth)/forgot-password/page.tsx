"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // type=recovery is what /auth/callback branches on to route to /reset-password
      // instead of /dashboard.
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    setLoading(false);
    if (error) {
      setError("Something went wrong sending the reset link. Please try again.");
      return;
    }
    // Always show the same success message whether or not the email exists,
    // so this endpoint can't be used to enumerate registered accounts.
    setSent(true);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl mb-3">Check your inbox</h1>
          <p className="text-sm text-slate">
            If an account exists for <span className="text-ink font-medium">{email}</span>, a password reset
            link is on its way.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-1">Reset your password</h1>
        <p className="text-sm text-slate mb-8">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>

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
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-sm text-slate mt-8 text-center">
          <Link href="/login" className="text-verdigris hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
