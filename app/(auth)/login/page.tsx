"use client";
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
