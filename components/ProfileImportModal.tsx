"use client";

import { useState } from "react";

export function ProfileImportModal({ onComplete }: { onComplete: () => void }) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: tab === "paste" ? "linkedin_text" : "upload",
          rawText: inputText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Profile ingestion failed");

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full shadow-2xl space-y-5">
      <div>
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Initialize Your Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Zero friction: no resume file required. Paste your background directly from LinkedIn or Indeed.
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTab("paste")}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            tab === "paste" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-slate-500"
          }`}
        >
          📋 Paste LinkedIn / Bio Text
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            tab === "upload" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-slate-500"
          }`}
        >
          📄 LinkedIn "Save to PDF" / Resume
        </button>
      </div>

      {tab === "paste" && (
        <div className="space-y-2">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300">
            <strong>How to copy:</strong> Go to your LinkedIn profile, press <strong>Cmd+A</strong> (or Ctrl+A) to select your text, copy it, and paste it below. The engine extracts companies, dates, tenure, and skills automatically.
          </div>
          <textarea
            rows={9}
            placeholder="Paste your LinkedIn profile text (About, Experience, Skills, Education) here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none text-zinc-900 dark:text-zinc-100"
          />
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-[11px] text-indigo-800 dark:text-indigo-300">
            <strong>LinkedIn PDF Export:</strong> On your LinkedIn profile, click <strong>"More" → "Save to PDF"</strong>, then upload that file here.
          </div>
          <div className="p-8 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-center space-y-2">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                setInputText(text);
              }}
              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer"
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

      <button
        type="button"
        onClick={handleImport}
        disabled={loading || !inputText.trim()}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Normalizing Background via Gemini 3.8 Flash...</span>
          </>
        ) : (
          <span>Extract Profile & View Matches →</span>
        )}
      </button>
    </div>
  );
}
