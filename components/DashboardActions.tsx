"use client";

import { useState } from "react";
import { ProfileImportModal } from "./ProfileImportModal";

export function DashboardActions({ activeJob }: { activeJob?: any }) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [clipInput, setClipInput] = useState("");
  const [isClipping, setIsClipping] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [statusAlert, setStatusAlert] = useState<string | null>(null);

  async function handleClipJob() {
    if (!clipInput.trim()) return;
    setIsClipping(true);
    setStatusAlert(null);
    try {
      const isUrl = clipInput.trim().startsWith("http");
      const res = await fetch("/api/jobs/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobUrl: isUrl ? clipInput.trim() : undefined,
          rawJobText: !isUrl ? clipInput.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clip job");

      setStatusAlert(`✓ Clipped: ${data.job.parsed_title} at ${data.job.parsed_company} (${data.job.match_score}% Match)`);
      setClipInput("");
    } catch (err: any) {
      setStatusAlert(`Clipper Error: ${err.message}`);
    } finally {
      setIsClipping(false);
    }
  }

  async function handleGenerateOutreach() {
    if (!activeJob) {
      alert("Please select a job from the left feed first.");
      return;
    }

    setIsGeneratingOutreach(true);
    setOutreachMessage(null);
    setStatusAlert(null);

    // Normalize property names across both raw and evaluated job formats
    const roleTitle = activeJob.title || activeJob.parsed_title || "Target Role";
    const company = activeJob.employer || activeJob.company || activeJob.parsed_company || "Target Company";
    const skills = activeJob.matchedSkills || activeJob.requiredSkills || activeJob.parsed_skills || [];

    try {
      const res = await fetch("/api/ai/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: roleTitle,
          companyName: company,
          keySkills: skills,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate outreach");

      setOutreachMessage(data.message);
      setStatusAlert("✓ Recruiter InMail draft generated below.");
    } catch (err: any) {
      console.error("Outreach hook failure:", err);
      setStatusAlert(`InMail Error: ${err.message}`);
      alert(`InMail Generation Failed: ${err.message}`);
    } finally {
      setIsGeneratingOutreach(false);
    }
  }

  return (
    <div className="w-full space-y-3 mb-6">
      {/* Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        {/* Job Clipper Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Paste LinkedIn/Indeed Job URL or JD text..."
            value={clipInput}
            onChange={(e) => setClipInput(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleClipJob}
            disabled={isClipping || !clipInput.trim()}
            className="px-3.5 py-2 text-xs font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 disabled:opacity-50 whitespace-nowrap cursor-pointer transition-all"
          >
            {isClipping ? "Parsing..." : "+ Clip Job"}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateOutreach}
            disabled={isGeneratingOutreach}
            className="px-3 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            {isGeneratingOutreach ? (
              <>
                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Drafting InMail...</span>
              </>
            ) : (
              <span>✉️ InMail Hook</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            📋 Import Profile
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusAlert && (
        <div className="p-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex justify-between items-center">
          <span>{statusAlert}</span>
          <button onClick={() => setStatusAlert(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-2">✕</button>
        </div>
      )}

      {/* Recruiter Outreach Card */}
      {outreachMessage && (
        <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Recruiter InMail Draft (Under 75 Words)
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(outreachMessage);
                setStatusAlert("✓ InMail copied to clipboard!");
              }}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              Copy Text 📋
            </button>
          </div>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans select-all whitespace-pre-wrap">
            {outreachMessage}
          </p>
        </div>
      )}

      {/* Modal Overlay */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="absolute -top-3 -right-3 h-8 w-8 bg-zinc-800 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-zinc-700 z-10 cursor-pointer"
            >
              ✕
            </button>
            <ProfileImportModal
              onComplete={() => {
                setShowImportModal(false);
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
