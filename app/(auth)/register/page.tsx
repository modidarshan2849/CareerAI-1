"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("already registered")
          ? "An account with this email already exists. Try signing in instead."
          : "Something went wrong creating your account. Please try again."
      );
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-2xl mb-3">Check your inbox</h1>
          <p className="text-sm text-slate">
            We sent a confirmation link to <span className="text-ink font-medium">{email}</span>. Click it to
            activate your account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl mb-1">Create your account</h1>
        <p className="text-sm text-slate mb-8">
          Build a career profile backed by evidence, not guesswork.
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
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-slate-light mt-1.5">At least 8 characters.</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-slate mt-8 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-verdigris hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
