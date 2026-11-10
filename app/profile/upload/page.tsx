"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

export default function ResumeUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic continuous progress engine: smoothly advances without stalling
  useEffect(() => {
    if (!isProcessing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(0);
      setStatusMessage("");
      return;
    }

    setStatusMessage("Extracting document text...");

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        // Fast curve up to 60%, steady up to 85%, then gentle continuous increments to 96%
        if (prev < 50) {
          return prev + 6;
        } else if (prev < 75) {
          setStatusMessage("AI extracting roles, skills, and credentials...");
          return prev + 3;
        } else if (prev < 90) {
          setStatusMessage("Synthesizing skill evidence and career metrics...");
          return prev + 1;
        } else if (prev < 96) {
          setStatusMessage("Finalizing profile snapshot...");
          return prev + 0.5;
        }
        return prev;
      });
    }, 120);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isProcessing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setProgress(5);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const rawResponseText = await res.text();
      let data: any = {};
      try {
        data = rawResponseText ? JSON.parse(rawResponseText) : {};
      } catch {
        throw new Error(`Server returned non-JSON response (${res.status}): ${rawResponseText.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to process resume.");
      }

      // Finish cleanly to 100% on response
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      setStatusMessage("Extraction complete! Redirecting to review...");

      setTimeout(() => {
        router.push(data.redirectUrl || "/profile/review");
      }, 400);
    } catch (err: any) {
      console.error("[Upload Error]:", err);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setError(err.message || "An unexpected error occurred during processing.");
      setIsProcessing(false);
      setProgress(0);
      setStatusMessage("");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav active="/profile/upload" />

      <main className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <div className="text-center space-y-2">
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
            Step 1 of 3: Master Career Profile
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Upload Your Resume</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Upload your resume (.txt, .docx, or .pdf). Every skill and career milestone will be extracted with strict traceability.
          </p>
        </div>

        <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Resume Document
              </label>
              <input
                type="file"
                accept=".txt,.pdf,.docx"
                disabled={isProcessing}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-zinc-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-400 cursor-pointer border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-900/50"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-sm rounded-xl">
                {error}
              </div>
            )}

            {/* Live Continuous Progress Gauge */}
            {isProcessing && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-slate-600 dark:text-slate-400">{statusMessage}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden p-0.5 border border-zinc-200 dark:border-zinc-700">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${Math.round(progress)}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!file || isProcessing}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Resume ({Math.round(progress)}%)...</span>
                </>
              ) : (
                "Extract & Build Career Profile"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
