"use client";

import { DashboardActions } from "@/components/DashboardActions";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  evaluateJobFit,
  RawDbJob,
  CandidatePreferences,
  EvaluatedJobMatch,
} from "@/lib/jobMatching";

export interface DashboardClientProps {
  rawJobs: RawDbJob[];
  candidateSkills: string[];
  basePreferences: CandidatePreferences;
  readinessScore: number;
  activeSkillCount: number;
  homeLocation: string;
  totalTenureDisplay?: string;
  initialInteractions?: Record<string, "saved" | "applied" | "hidden">;
}

function formatJobDescription(raw: string | null | undefined): string {
  if (!raw) return "Detailed requirements and responsibilities available via direct application link above.";
  
  let text = raw
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");

  text = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/p>|<\/div>|<br\s*\/?>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/gi, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  return text;
}

export function DashboardClient({
  rawJobs,
  candidateSkills,
  basePreferences,
  readinessScore,
  activeSkillCount,
  homeLocation,
  totalTenureDisplay = "12y 10m",
  initialInteractions = {},
}: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"eligible" | "saved" | "applied" | "restricted">("eligible");
  const [tierFilter, setTierFilter] = useState<"all" | "tier1" | "tier2" | "tier3">("all");
  const [recencyFilter, setRecencyFilter] = useState<"all" | "fresh" | "expiring">("all");
  const [minSalaryFilter, setMinSalaryFilter] = useState<number>(0);
  const [includeUnlistedSalary, setIncludeUnlistedSalary] = useState<boolean>(true);
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedVisa, setSelectedVisa] = useState<CandidatePreferences["citizenshipStatus"]>(
    basePreferences.citizenshipStatus || "US_Citizen"
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [visaChangeNotice, setVisaChangeNotice] = useState<string | null>(null);
  const [applicationNotice, setApplicationNotice] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Record<string, "saved" | "applied" | "hidden">>(
    initialInteractions
  );
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  // AI Modal States
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResume, setTailoredResume] = useState<any | null>(null);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);

  const [isPrepping, setIsPrepping] = useState(false);
  const [interviewPrep, setInterviewPrep] = useState<any | null>(null);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);

  const scoreOutOfTen = ((readinessScore / 95) * 10).toFixed(1);
  const readinessTier =
    readinessScore >= 85 ? "Lead / Staff Ready" : readinessScore >= 70 ? "Senior Ready" : "Emerging Fit";

  // Pre-calculate ranks
  const rankedAllMatches: EvaluatedJobMatch[] = useMemo(() => {
    const livePrefs: CandidatePreferences = {
      ...basePreferences,
      citizenshipStatus: selectedVisa,
      requiresSponsorship: selectedVisa === "Requires_Sponsorship",
    };

    return rawJobs
      .map((job) => evaluateJobFit(job, candidateSkills, livePrefs))
      .sort((a, b) => b.matchScore - a.matchScore)
      .map((job, idx) => ({ ...job, rank: idx + 1 }));
  }, [rawJobs, candidateSkills, basePreferences, selectedVisa]);

  async function handleVisaChange(newStatus: CandidatePreferences["citizenshipStatus"]) {
    setSelectedVisa(newStatus);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...basePreferences,
          citizenship_status: newStatus,
          requires_sponsorship: newStatus === "Requires_Sponsorship",
        }),
      });

      const nextGated = rawJobs.map((j) =>
        evaluateJobFit(j, candidateSkills, {
          ...basePreferences,
          citizenshipStatus: newStatus,
          requiresSponsorship: newStatus === "Requires_Sponsorship",
        })
      ).filter((m) => !m.isEligible).length;

      setVisaChangeNotice(
        `Work authorization set to "${newStatus.replace("_", " ")}". ${nextGated} total openings are restricted by citizenship or sponsorship requirements.`
      );
      setTimeout(() => setVisaChangeNotice(null), 6000);
    } catch (err) {
      console.error("Failed to persist visa preference:", err);
    }
  }

  async function handleToggleStatus(jobId: string, targetStatus: "saved" | "applied" | "hidden") {
    const current = interactions[jobId];
    const newStatus = current === targetStatus ? "none" : targetStatus;

    setInteractions((prev) => {
      const next = { ...prev };
      if (newStatus === "none") delete next[jobId];
      else next[jobId] = newStatus;
      return next;
    });

    try {
      await fetch("/api/jobs/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  // Auto-pruning Application Handler
  async function handleMarkAppliedAndTrack(job: EvaluatedJobMatch) {
    setInteractions((prev) => ({ ...prev, [job.jobId]: "applied" }));

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.jobId,
          companyName: job.employer,
          jobTitle: job.title,
          sourceUrl: job.sourceUrl,
          stage: "applied",
        }),
      });

      if (res.ok) {
        setApplicationNotice(`"${job.title}" at ${job.employer} moved to your Pipeline.`);
        setTimeout(() => setApplicationNotice(null), 7000);
      }
    } catch (err) {
      console.error("Failed to track application:", err);
    }
  }

  // AI Resume Tailor Trigger
  async function handleGenerateTailoredResume(job: EvaluatedJobMatch) {
    setIsTailoring(true);
    setIsResumeModalOpen(true);
    setTailoredResume(null);

    try {
      const rawDesc = rawJobs.find((j) => j.id === job.jobId)?.description || "";
      const res = await fetch("/api/ai/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.jobId,
          jobTitle: job.title,
          jobDescription: rawDesc,
          requiredSkills: job.matchedSkills.concat(job.missingSkills),
        }),
      });

      const data = await res.json();
      if (data.resume) {
        setTailoredResume(data.resume);
      } else {
        throw new Error(data.error || "Failed to generate resume");
      }
    } catch (err: any) {
      alert(`Resume Generation Error: ${err.message}`);
      setIsResumeModalOpen(false);
    } finally {
      setIsTailoring(false);
    }
  }

  // ATS Word Document (.docx) Downloader
  async function handleDownloadDocx() {
    if (!tailoredResume) return;
    setIsDownloadingDocx(true);
    try {
      const res = await fetch("/api/ai/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: "Verified Professional Candidate",
          contactLine: `${homeLocation} • Available Upon Interview Request`,
          resume: tailoredResume,
        }),
      });

      if (!res.ok) throw new Error("Server failed to compile .docx");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Tailored_Resume_${(activeJob?.title || "Role").replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export Error: ${err.message}`);
    } finally {
      setIsDownloadingDocx(false);
    }
  }

  // AI Interview Prep Trigger
  async function handleGenerateInterviewPrep(job: EvaluatedJobMatch) {
    setIsPrepping(true);
    setIsInterviewModalOpen(true);
    setInterviewPrep(null);

    try {
      const rawDesc = rawJobs.find((j) => j.id === job.jobId)?.description || "";
      const res = await fetch("/api/ai/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.jobId,
          jobTitle: job.title,
          jobDescription: rawDesc,
          matchedSkills: job.matchedSkills,
        }),
      });

      const data = await res.json();
      if (data.prep) {
        setInterviewPrep(data.prep);
      } else {
        throw new Error(data.error || "Failed to generate interview prep");
      }
    } catch (err: any) {
      alert(`Interview Prep Error: ${err.message}`);
      setIsInterviewModalOpen(false);
    } finally {
      setIsPrepping(false);
    }
  }

  // Auto-prune applied and hidden roles from active eligible search
  const eligibleMatches = useMemo(
    () => rankedAllMatches.filter((m) => m.isEligible && interactions[m.jobId] !== "hidden" && interactions[m.jobId] !== "applied"),
    [rankedAllMatches, interactions]
  );
  const savedTotal = useMemo(
    () => Object.values(interactions).filter((s) => s === "saved").length,
    [interactions]
  );
  const appliedTotal = useMemo(
    () => Object.values(interactions).filter((s) => s === "applied").length,
    [interactions]
  );
  const restrictedTotal = useMemo(
    () => rankedAllMatches.filter((m) => !m.isEligible && interactions[m.jobId] !== "hidden").length,
    [rankedAllMatches, interactions]
  );

  const tier1Count = useMemo(() => eligibleMatches.filter((m) => m.matchScore >= 80).length, [eligibleMatches]);
  const tier2Count = useMemo(() => eligibleMatches.filter((m) => m.matchScore >= 70 && m.matchScore < 80).length, [eligibleMatches]);
  const tier3Count = useMemo(() => eligibleMatches.filter((m) => m.matchScore < 70).length, [eligibleMatches]);

  const displayedMatches = useMemo(() => {
    return rankedAllMatches.filter((job) => {
      const userStatus = interactions[job.jobId];
      if (userStatus === "hidden") return false;

      if (activeTab === "saved") return userStatus === "saved";
      if (activeTab === "applied") return userStatus === "applied";
      if (activeTab === "restricted") return !job.isEligible;
      
      // Eligible Feed: Automatically pruned of applied roles
      if (activeTab === "eligible") {
        if (!job.isEligible || userStatus === "applied") return false;

        if (tierFilter === "tier1" && job.matchScore < 80) return false;
        if (tierFilter === "tier2" && (job.matchScore < 70 || job.matchScore >= 80)) return false;
        if (tierFilter === "tier3" && job.matchScore >= 70) return false;

        if (recencyFilter === "fresh" && job.urgencyStatus !== "fresh") return false;
        if (recencyFilter === "expiring" && job.urgencyStatus !== "expiring") return false;

        if (minSalaryFilter > 0) {
          const hasDisclosedSalary = Boolean(job.salaryMax || job.salaryMin);
          if (!hasDisclosedSalary) {
            if (!includeUnlistedSalary) return false;
          } else {
            const compBenchmark = job.salaryMax || job.salaryMin || 0;
            if (compBenchmark < minSalaryFilter) return false;
          }
        }

        if (selectedWorkMode !== "all" && job.resolvedWorkMode !== selectedWorkMode) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesEmployer = job.employer.toLowerCase().includes(q);
        const matchesSkill = job.matchedSkills.some((s) => s.toLowerCase().includes(q));
        if (!matchesTitle && !matchesEmployer && !matchesSkill) return false;
      }

      return true;
    });
  }, [
    rankedAllMatches,
    activeTab,
    tierFilter,
    recencyFilter,
    minSalaryFilter,
    includeUnlistedSalary,
    selectedWorkMode,
    searchQuery,
    interactions,
  ]);

  useEffect(() => {
    if (displayedMatches.length > 0 && (!selectedJobId || !displayedMatches.some((m) => m.jobId === selectedJobId))) {
      setSelectedJobId(displayedMatches[0].jobId);
    }
  }, [displayedMatches, selectedJobId]);

  const activeJob = useMemo(() => {
    return (
      displayedMatches.find((m) => m.jobId === selectedJobId) ||
      rankedAllMatches.find((m) => m.jobId === selectedJobId) ||
      displayedMatches[0] ||
      null
    );
  }, [displayedMatches, rankedAllMatches, selectedJobId]);

  return (
    <div className="space-y-6">
      {/* 1. Context & Profile Sync Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Location: <strong className="text-zinc-900 dark:text-zinc-100">{homeLocation}</strong>
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Tenure: <strong className="text-zinc-900 dark:text-zinc-100">{totalTenureDisplay}</strong>
          </span>
          <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Skills Indexed: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{activeSkillCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Work Auth:</label>
          <select
            value={selectedVisa}
            onChange={(e) => handleVisaChange(e.target.value as CandidatePreferences["citizenshipStatus"])}
            className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="US_Citizen">U.S. Citizen (Clearance Eligible)</option>
            <option value="Green_Card">Permanent Resident (Green Card)</option>
            <option value="EAD_OPT">EAD / STEM OPT</option>
            <option value="H1B_Transfer">H-1B Transfer</option>
            <option value="Requires_Sponsorship">Requires Visa Sponsorship</option>
          </select>
        </div>
      </div>

      {visaChangeNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>ℹ️ {visaChangeNotice}</span>
          <button onClick={() => setVisaChangeNotice(null)} className="font-bold text-emerald-700 ml-2">✕</button>
        </div>
      )}

      {applicationNotice && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between animate-fadeIn">
          <span>✓ {applicationNotice}</span>
          <Link href="/applications" className="font-bold underline text-blue-700 dark:text-blue-300 ml-2">
            View in Pipeline →
          </Link>
        </div>
      )}

      {/* PHASE 2 ACTION STRIP: Profile Import, Job Clipper & Outreach Hooks */}
      <DashboardActions activeJob={activeJob} />

      {/* 2. Top-Level Metric Tabs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
          className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm text-left hover:border-emerald-500 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Readiness</span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-md">
                {readinessTier}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {scoreOutOfTen} <span className="text-xs font-normal text-slate-400">/ 10</span>
            </div>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
            {showScoreBreakdown ? "▲ Hide Breakdown" : "▼ Path to 10.0"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab("eligible"); setTierFilter("all"); }}
          className={`p-4 text-left rounded-2xl border transition-all shadow-sm flex flex-col justify-between ${
            activeTab === "eligible"
              ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-300">
            Qualified Pool
          </span>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            {eligibleMatches.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-2">Active Unapplied</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("saved")}
          className={`p-4 text-left rounded-2xl border transition-all shadow-sm flex flex-col justify-between ${
            activeTab === "saved"
              ? "bg-purple-50/70 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700 dark:text-purple-300">
            Saved Shortlist
          </span>
          <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
            {savedTotal}
          </div>
          <span className="text-[10px] text-slate-400 mt-2">Bookmarked</span>
        </button>

        <Link
          href="/applications"
          className="p-4 text-left rounded-2xl border transition-all shadow-sm flex flex-col justify-between bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-500"
        >
          <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300">
            Pipeline (Board)
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
            {appliedTotal}
          </div>
          <span className="text-[10px] text-slate-400 mt-2">Track In-Flight →</span>
        </Link>

        <button
          type="button"
          onClick={() => setActiveTab("restricted")}
          className={`p-4 text-left rounded-2xl border transition-all shadow-sm flex flex-col justify-between ${
            activeTab === "restricted"
              ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300">
            Gated Out
          </span>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
            {restrictedTotal}
          </div>
          <span className="text-[10px] text-slate-400 mt-2">Visa / Salary Floor</span>
        </button>
      </section>

      {/* 3. Simulator Dropdown */}
      {showScoreBreakdown && (
        <section className="p-6 bg-gradient-to-br from-emerald-500/5 via-zinc-900/40 to-indigo-500/5 border border-emerald-500/30 rounded-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Strategic Path to 10.0 Documentary Strength
              </h3>
              <p className="text-xs text-slate-500">
                Current score: 88 / 95 (9.3 / 10). Closing these 3 evidence gaps reaches peak documentary verification.
              </p>
            </div>
            <Link href="/profile/review" className="text-xs font-bold text-emerald-600 hover:underline">
              Edit Master Profile →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 uppercase">Lever 1: Quantified Dollar Impact (+3 pts)</span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Detail dollarized infrastructure savings in your Lead role (e.g., <em>"Saved $42,000/yr in Snowflake compute through query clustering"</em>).
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-indigo-600 uppercase">Lever 2: Vendor Credential (+2 pts)</span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Verify official credential (e.g., <em>Snowflake SnowPro Core</em> or <em>dbt Developer</em>).
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-purple-600 uppercase">Lever 3: Governance Scope (+2 pts)</span>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Document data model ownership across multiple executive business units.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 4. Filter Bar */}
      <section className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <input
            type="text"
            placeholder="Filter by title, company, or stack (e.g. Snowflake, Databricks, Reddit)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          {activeTab === "eligible" && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setTierFilter("all")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  tierFilter === "all" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-slate-500"
                }`}
              >
                All ({eligibleMatches.length})
              </button>
              <button
                onClick={() => setTierFilter("tier1")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  tierFilter === "tier1" ? "bg-emerald-600 text-white shadow-sm" : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                🟢 Tier 1 ({tier1Count})
              </button>
              <button
                onClick={() => setTierFilter("tier2")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  tierFilter === "tier2" ? "bg-indigo-600 text-white shadow-sm" : "text-indigo-700 dark:text-indigo-400"
                }`}
              >
                🔵 Tier 2 ({tier2Count})
              </button>
              <button
                onClick={() => setTierFilter("tier3")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  tierFilter === "tier3" ? "bg-amber-600 text-white shadow-sm" : "text-amber-700 dark:text-amber-400"
                }`}
              >
                🟠 Tier 3 ({tier3Count})
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Salary Floor:</span>
              <input
                type="range"
                min="0"
                max="180000"
                step="10000"
                value={minSalaryFilter}
                onChange={(e) => setMinSalaryFilter(Number(e.target.value))}
                className="w-32 accent-emerald-600 cursor-pointer"
              />
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {minSalaryFilter === 0 ? "Any" : `$${Math.round(minSalaryFilter / 1000)}k+`}
              </span>
            </div>

            <label className="flex items-center gap-1.5 text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeUnlistedSalary}
                onChange={(e) => setIncludeUnlistedSalary(e.target.checked)}
                className="accent-emerald-600 rounded"
              />
              <span>Include unlisted comp</span>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setRecencyFilter("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                recencyFilter === "all" ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" : "text-slate-400"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setRecencyFilter("fresh")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                recencyFilter === "fresh" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" : "text-slate-400"
              }`}
            >
              🔥 &lt;48h
            </button>
            <button
              onClick={() => setRecencyFilter("expiring")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                recencyFilter === "expiring" ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400" : "text-slate-400"
              }`}
            >
              ⏳ Expiring
            </button>
          </div>
        </div>
      </section>

      {/* 5. 2-Pane Console */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Master Feed */}
        <div className="lg:col-span-5 space-y-3 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
          {displayedMatches.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs font-semibold text-slate-500">No positions match active filters.</p>
              <button
                onClick={() => {
                  setTierFilter("all");
                  setMinSalaryFilter(0);
                  setIncludeUnlistedSalary(true);
                  setSearchQuery("");
                }}
                className="mt-2 text-xs font-bold text-emerald-600 hover:underline"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            displayedMatches.map((job) => {
              const isSelected = activeJob?.jobId === job.jobId;
              const isSaved = interactions[job.jobId] === "saved";

              return (
                <div
                  key={job.jobId}
                  onClick={() => setSelectedJobId(job.jobId)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-white dark:bg-zinc-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded">
                          #{job.rank}
                        </span>
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1">
                          {job.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {job.employer} • <span className="capitalize">{job.resolvedWorkMode}</span>
                      </p>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {job.matchScore}%
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {job.daysAgo === 0 ? "Today" : `${job.daysAgo}d ago`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 rounded">
                      {job.salaryDisplay}
                    </span>
                    {job.urgencyStatus === "fresh" && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold rounded">
                        🔥 Just Posted
                      </span>
                    )}
                    {job.matchedSkills.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 text-[9px] font-medium rounded">
                        ✓ {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
                    <span className="text-slate-400 text-[10px]">{job.industry}</span>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleStatus(job.jobId, "saved")}
                        className={`text-[10px] font-semibold ${isSaved ? "text-purple-600 font-bold" : "text-slate-400 hover:text-zinc-700"}`}
                      >
                        {isSaved ? "★ Saved" : "☆ Save"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail Inspector Console */}
        <div className="lg:col-span-7 sticky top-4 space-y-4">
          {activeJob ? (
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm space-y-6 max-h-[calc(100vh-140px)] overflow-y-auto">
              {/* Header Action Banner */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md">
                      Rank #{activeJob.rank}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-md">
                      {activeJob.matchScore >= 80 ? "Tier 1: Prime Target" : activeJob.matchScore >= 70 ? "Tier 2: Strategic Fit" : "Tier 3: Lateral Extension"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Source: {activeJob.sourcePlatform}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                    {activeJob.title}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    <strong className="text-zinc-800 dark:text-zinc-200">{activeJob.employer}</strong> • {activeJob.location} • Level: {activeJob.experienceLevel}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 whitespace-nowrap">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Match Score</span>
                    <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {activeJob.matchScore}%
                    </span>
                  </div>

                  <a
                    href={activeJob.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                  >
                    Apply Direct ↗
                  </a>
                </div>
              </div>

              {/* Phase 2: Action Suite (AI Tools & Auto-Pruning) */}
              <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateTailoredResume(activeJob)}
                    disabled={isTailoring}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>✨ Tailor Resume (ATS)</span>
                  </button>

                  <button
                    onClick={() => handleGenerateInterviewPrep(activeJob)}
                    disabled={isPrepping}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🎯 Prep Interview</span>
                  </button>
                </div>

                <button
                  onClick={() => handleMarkAppliedAndTrack(activeJob)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>✓ Mark Applied & Track</span>
                </button>
              </div>

              {/* 3 Multi-Meters */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Stack Overlap</span>
                  <span className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-100">
                    {activeJob.compatibility.skillsCoverage}%
                  </span>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${activeJob.compatibility.skillsCoverage}%` }} />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Seniority Fit</span>
                  <span className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-100">
                    {activeJob.compatibility.seniorityFit}%
                  </span>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${activeJob.compatibility.seniorityFit}%` }} />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Comp Alignment</span>
                  <span className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-100">
                    {activeJob.compatibility.salaryFit}%
                  </span>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${activeJob.compatibility.salaryFit}%` }} />
                  </div>
                </div>
              </div>

              {/* Compensation Benchmark */}
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Compensation Benchmark</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {activeJob.salaryDisplay}
                  </span>
                </div>
                <div className="relative w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: activeJob.salaryMax ? `${Math.min(100, Math.max(25, (activeJob.salaryMax / 200000) * 100))}%` : "60%",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Candidate Floor: $120k</span>
                  <span>Market Target: $150k</span>
                  <span>Ceiling: $200k+</span>
                </div>
              </div>

              {/* Skills Diff Matrix */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Skills Requirement Matrix
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">
                      Evidenced on Your Profile ({activeJob.matchedSkills.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {activeJob.matchedSkills.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">No direct keyword overlap</span>
                      ) : (
                        activeJob.matchedSkills.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium rounded">
                            ✓ {s}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Skills to Highlight or Add ({activeJob.missingSkills.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {activeJob.missingSkills.length === 0 ? (
                        <span className="text-[11px] text-emerald-600 font-semibold">100% stack coverage evidenced</span>
                      ) : (
                        activeJob.missingSkills.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium rounded">
                            △ {s}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Location & Legal Box */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Location & Legal Authorization Policy
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                  Arrangement: <strong className="capitalize">{activeJob.resolvedWorkMode}</strong> • {activeJob.workModeNote || "US-Wide remote authorized"}
                </p>
                {activeJob.advisoryWarnings && activeJob.advisoryWarnings.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ {activeJob.advisoryWarnings.join(" • ")}
                  </p>
                )}
                {!activeJob.isEligible && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    ⛔ Gated Out: {activeJob.hardExclusions.join(" • ")}
                  </p>
                )}
              </div>

              {/* Clean Sanitized Description */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Role Overview & Requirements
                </h4>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-80 overflow-y-auto bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-2xl whitespace-pre-wrap font-sans">
                  {formatJobDescription(rawJobs.find((j) => j.id === activeJob.jobId)?.description)}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-slate-400">
              Select an opening from the left feed to inspect compatibility diagnostics.
            </div>
          )}
        </div>
      </section>

      {/* MODAL 1: AI Tailored Resume (with Native ATS .docx Export) */}
      {isResumeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">✨ AI-Tailored Resume Draft</h3>
                <p className="text-xs text-slate-500">Strict single-column ATS format with zero hallucination.</p>
              </div>
              <button onClick={() => setIsResumeModalOpen(false)} className="text-slate-400 hover:text-zinc-700 font-bold p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
              {isTailoring ? (
                <div className="py-16 text-center space-y-3">
                  <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">Synthesizing job requirements with verified history...</p>
                </div>
              ) : tailoredResume ? (
                <div className="space-y-5 font-sans">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Executive Summary</span>
                    <p className="text-xs text-zinc-900 dark:text-zinc-100">{tailoredResume.summary}</p>
                  </div>

                  <div className="space-y-4">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block">
                      Prioritized Professional Experience
                    </span>
                    {tailoredResume.tailoredExperience?.map((exp: any, i: number) => (
                      <div key={i} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-baseline font-semibold">
                          <span className="text-xs text-zinc-900 dark:text-zinc-100">{exp.position} • {exp.company}</span>
                          <span className="text-[11px] font-mono text-slate-400">{exp.period}</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                          {exp.alignedBullets?.map((b: string, j: number) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={handleDownloadDocx}
                      disabled={isDownloadingDocx}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isDownloadingDocx ? "Generating .docx..." : "📥 Download ATS Word (.docx)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(tailoredResume, null, 2));
                        alert("Copied resume JSON to clipboard!");
                      }}
                      className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
                    >
                      Copy Clean Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsResumeModalOpen(false)}
                      className="px-4 py-2.5 bg-transparent text-slate-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold text-xs ml-auto cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AI Interview Prep */}
      {isInterviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">🎯 Technical Screen Interview Predictor</h3>
                <p className="text-xs text-slate-500">Predicted technical questions with STAR-framework answers grounded in your background.</p>
              </div>
              <button onClick={() => setIsInterviewModalOpen(false)} className="text-slate-400 hover:text-zinc-700 font-bold p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
              {isPrepping ? (
                <div className="py-16 text-center space-y-3">
                  <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-500">Analyzing job description against candidate projects...</p>
                </div>
              ) : interviewPrep?.questions ? (
                <div className="space-y-4">
                  {interviewPrep.questions.map((q: any, i: number) => (
                    <div key={i} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 bg-zinc-50 dark:bg-zinc-800/40">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-600 text-xs">Q{i + 1}: {q.focusSkill}</span>
                      </div>
                      <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{q.question}</p>

                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                        <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg">
                          <strong className="text-slate-900 dark:text-slate-100">Situation:</strong> {q.starFramework?.situation}
                        </div>
                        <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg">
                          <strong className="text-slate-900 dark:text-slate-100">Task:</strong> {q.starFramework?.task}
                        </div>
                        <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg">
                          <strong className="text-slate-900 dark:text-slate-100">Action:</strong> {q.starFramework?.action}
                        </div>
                        <div className="p-2 bg-white dark:bg-zinc-900 rounded-lg">
                          <strong className="text-slate-900 dark:text-slate-100">Result:</strong> {q.starFramework?.result}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsInterviewModalOpen(false)}
                    className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
