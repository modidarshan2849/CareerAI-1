"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Section 13: confirm a recovery session actually exists before showing
    // the form. If someone lands here without a valid recovery session
    // (e.g. link already used, or direct navigation), we don't silently
    // show a broken form — we tell them clearly.
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Something went wrong updating your password. Please request a new reset link.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  if (hasRecoverySession === null) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-slate">Checking your reset link…</p>
      </main>
    );
  }

  if (!hasRecoverySession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl mb-3">Link expired</h1>
          <p className="text-sm text-slate">
            This password reset link is invalid or has already been used. Please request a new one.
          </p>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl mb-3">Password updated</h1>
          <p className="text-sm text-slate">Redirecting you to your dashboard…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-1">Set a new password</h1>
        <p className="text-sm text-slate mb-8">Choose a new password for your account.</p>

        {error && (
          <div className="mb-6 rounded-md bg-signal-red-bg text-signal-red text-sm px-3 py-2.5">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
