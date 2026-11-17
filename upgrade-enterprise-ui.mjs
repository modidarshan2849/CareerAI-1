import fs from "fs";

// 1. Simplify app/dashboard/layout.tsx to a clean shell so there are zero duplicate headers or DOM hacks
const CLEAN_LAYOUT = `import React from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {children}
    </div>
  );
}
`;

fs.writeFileSync("app/dashboard/layout.tsx", CLEAN_LAYOUT, "utf8");
console.log("✅ Cleaned app/dashboard/layout.tsx (removed duplicate headers & DOM hacks)");

// 2. Replace app/dashboard/page.tsx with a deterministic, enterprise-ready 2-Tab React Dashboard
const ENTERPRISE_DASHBOARD_PAGE = `"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  GENERATED_228_JOBS,
  DEFAULT_MASTER_PREFS,
  DEFAULT_SNAPSHOT,
  MasterPreferences,
  evaluateJobAgainstMasterGate
} from "../../lib/ats/master-jobs-pool";

type WorkModeFilter = "ALL" | "Hybrid" | "On-site" | "Remote" | "TRACKED";
type SortOption = "score" | "miles" | "salary";

export default function EnterpriseDashboardPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "preferences">("dashboard");
  const [modeFilter, setModeFilter] = useState<WorkModeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [prefs, setPrefs] = useState<MasterPreferences>(DEFAULT_MASTER_PREFS);
  const [newTitle, setNewTitle] = useState("");
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load saved preferences & tracked applications on mount
  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem("careerai_master_prefs");
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        setPrefs({
          ...DEFAULT_MASTER_PREFS,
          ...parsed,
          candidateExperienceYears: 12
        });
      }
      const savedTracked = localStorage.getItem("careerai_tracked_ids");
      if (savedTracked) {
        setTrackedIds(JSON.parse(savedTracked));
      }
    } catch {
      // Fallback to defaults
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const updatePrefs = (next: MasterPreferences) => {
    setPrefs(next);
    localStorage.setItem("careerai_master_prefs", JSON.stringify(next));
  };

  const toggleTrackJob = (job: any) => {
    const id = String(job.id);
    const exists = trackedIds.includes(id);
    const next = exists ? trackedIds.filter(item => item !== id) : [...trackedIds, id];
    setTrackedIds(next);
    localStorage.setItem("careerai_tracked_ids", JSON.stringify(next));
    showToast(
      exists
        ? \`Removed "\${job.title}" from tracked applications\`
        : \`Marked "\${job.title}" at \${job.company} as Applied & Tracked\`
    );
  };

  // Normalize work mode deterministically for every job
  const normalizeWorkMode = (job: any): "Hybrid" | "On-site" | "Remote" => {
    if (job.is_remote === true || job.remote === true) return "Remote";
    const mode = String(job.work_mode || "").toLowerCase();
    if (mode.includes("on-site") || mode.includes("onsite")) return "On-site";
    return "Hybrid";
  };

  // Step 1: Filter all jobs through the Master Gate using current Preferences
  const masterApprovedJobs = useMemo(() => {
    return GENERATED_228_JOBS.filter(job => evaluateJobAgainstMasterGate(job, prefs)).map(job => ({
      ...job,
      normalizedMode: normalizeWorkMode(job)
    }));
  }, [prefs]);

  // Step 2: Compute accurate counts for each filter button
  const modeCounts = useMemo(() => {
    let hybrid = 0;
    let onsite = 0;
    let remote = 0;
    for (const j of masterApprovedJobs) {
      if (j.normalizedMode === "Hybrid") hybrid++;
      else if (j.normalizedMode === "On-site") onsite++;
      else if (j.normalizedMode === "Remote") remote++;
    }
    return {
      all: masterApprovedJobs.length,
      hybrid,
      onsite,
      remote,
      tracked: masterApprovedJobs.filter(j => trackedIds.includes(String(j.id))).length
    };
  }, [masterApprovedJobs, trackedIds]);

  // Step 3: Apply Work Mode Filter + Search Query + Sort Order
  const visibleJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = masterApprovedJobs.filter(job => {
      if (modeFilter === "Hybrid" && job.normalizedMode !== "Hybrid") return false;
      if (modeFilter === "On-site" && job.normalizedMode !== "On-site") return false;
      if (modeFilter === "Remote" && job.normalizedMode !== "Remote") return false;
      if (modeFilter === "TRACKED" && !trackedIds.includes(String(job.id))) return false;

      if (q) {
        const haystack = [
          job.title,
          job.company,
          job.location,
          job.source,
          ...(Array.isArray(job.keywords) ? job.keywords : [])
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "miles") {
        const mA = a.normalizedMode === "Remote" ? 9999 : Number(a.miles_from_home ?? 50);
        const mB = b.normalizedMode === "Remote" ? 9999 : Number(b.miles_from_home ?? 50);
        if (mA !== mB) return mA - mB;
        return Number(b.score ?? 0) - Number(a.score ?? 0);
      }
      if (sortBy === "salary") {
        return Number(b.salary_max ?? 0) - Number(a.salary_max ?? 0);
      }
      // Default: Local first if equal score, sorted by highest ATS score
      const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.normalizedMode === "Remote" ? 1 : 0) - (b.normalizedMode === "Remote" ? 1 : 0);
    });
  }, [masterApprovedJobs, modeFilter, searchQuery, sortBy, trackedIds]);

  const handleAddTitle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    if (!prefs.targetTitles.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      updatePrefs({ ...prefs, targetTitles: [...prefs.targetTitles, trimmed] });
      showToast(\`Added target title: "\${trimmed}"\`);
    }
    setNewTitle("");
  };

  const handleRemoveTitle = (title: string) => {
    updatePrefs({
      ...prefs,
      targetTitles: prefs.targetTitles.filter(t => t !== title)
    });
    showToast(\`Removed title: "\${title}"\`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-900/95 border border-emerald-500/50 text-emerald-100 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {toastMessage}
        </div>
      )}

      {/* Top Enterprise Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-inner">
              CA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  CareerAI Command Center
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">
                  5-Gate Verified
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Darshan Modi &bull; 12 Yrs Experience &bull; Virginia Beach, VA (&le;{prefs.maxMiles} mi + US Remote)
              </p>
            </div>
          </div>

          {/* Primary 2-Tab Switcher */}
          <nav className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("dashboard")}
              className={\`px-4 py-2 rounded-lg text-xs font-semibold transition-all \${
                activeTab === "dashboard"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }\`}
            >
              Jobs &amp; ATS ({modeCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preferences")}
              className={\`px-4 py-2 rounded-lg text-xs font-semibold transition-all \${
                activeTab === "preferences"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }\`}
            >
              Preferences (Title &amp; Miles)
            </button>
          </nav>
        </div>
      </header>

      {/* TAB 1: JOBS & ATS DASHBOARD */}
      {activeTab === "dashboard" && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Executive KPI & ATS Strength Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Master Gate Pool</div>
              <div className="text-2xl font-bold text-white mt-1">{modeCounts.all}</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">100% HTTP &amp; Radius Verified</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">Local (&le;{prefs.maxMiles} mi)</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {modeCounts.hybrid + modeCounts.onsite}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {modeCounts.hybrid} Hybrid &bull; {modeCounts.onsite} On-site
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">US-Eligible Remote</div>
              <div className="text-2xl font-bold text-sky-400 mt-1">{modeCounts.remote}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Non-US / Canada Blocked</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">ATS Profile Strength</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">{DEFAULT_SNAPSHOT.score}/100</div>
              <div className="text-[11px] text-slate-400 mt-0.5">12 Yrs Senior Data Analyst</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-slate-400 font-medium">Applied &amp; Tracked</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{modeCounts.tracked}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Saved in Tracker</div>
            </div>
          </section>

          {/* Filter & Search Control Bar */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Work Mode Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setModeFilter("ALL")}
                className={\`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                  modeFilter === "ALL"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                }\`}
              >
                All Jobs ({modeCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setModeFilter("Hybrid")}
                className={\`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                  modeFilter === "Hybrid"
                    ? "bg-emerald-600 border-emerald-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                }\`}
              >
                Hybrid ({modeCounts.hybrid})
              </button>

              <button
                type="button"
                onClick={() => setModeFilter("On-site")}
                className={\`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                  modeFilter === "On-site"
                    ? "bg-amber-600 border-amber-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                }\`}
              >
                On-site ({modeCounts.onsite})
              </button>

              <button
                type="button"
                onClick={() => setModeFilter("Remote")}
                className={\`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                  modeFilter === "Remote"
                    ? "bg-sky-600 border-sky-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                }\`}
              >
                Remote ({modeCounts.remote})
              </button>

              <button
                type="button"
                onClick={() => setModeFilter("TRACKED")}
                className={\`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                  modeFilter === "TRACKED"
                    ? "bg-purple-600 border-purple-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                }\`}
              >
                Tracked ({modeCounts.tracked})
              </button>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search title, company, city, SQL..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    &times;
                  </button>
                )}
              </div>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortOption)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="score">Sort: Highest ATS Score</option>
                <option value="miles">Sort: Closest to Virginia Beach</option>
                <option value="salary">Sort: Highest Compensation</option>
              </select>
            </div>
          </section>

          {/* Active Filter Status Banner */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Showing <strong className="text-white">{visibleJobs.length}</strong>{" "}
              {modeFilter !== "ALL" ? (
                <span className="text-indigo-400 font-semibold">{modeFilter}</span>
              ) : (
                "verified"
              )}{" "}
              requisitions
              {searchQuery ? \` matching "\${searchQuery}"\` : ""}
            </span>
            {(modeFilter !== "ALL" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setModeFilter("ALL");
                  setSearchQuery("");
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Job Cards Grid */}
          {visibleJobs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
              <h3 className="text-base font-semibold text-white">No requisitions match the current filter</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Try switching back to All Jobs, clearing your search query, or expanding your target titles and mile radius in the Preferences tab.
              </p>
              <button
                type="button"
                onClick={() => {
                  setModeFilter("ALL");
                  setSearchQuery("");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white"
              >
                Show All {modeCounts.all} Verified Jobs
              </button>
            </div>
          ) : (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleJobs.map(job => {
                const isTracked = trackedIds.includes(String(job.id));
                const modeBadgeClass =
                  job.normalizedMode === "Hybrid"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : job.normalizedMode === "On-site"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-sky-500/15 text-sky-300 border-sky-500/30";

                return (
                  <article
                    key={job.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Top Row: Badges + ATS Score */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={\`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border \${modeBadgeClass}\`}>
                            {job.normalizedMode}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">
                            {job.normalizedMode === "Remote"
                              ? "US Remote"
                              : \`\${job.miles_from_home} mi from VB\`}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400">
                            {job.source}
                          </span>
                        </div>

                        <div className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                          ATS {job.score} pts
                        </div>
                      </div>

                      {/* Title, Company & Location */}
                      <div>
                        <h2
                          onClick={() => setSelectedJob(job)}
                          className="text-base font-bold text-white hover:text-indigo-400 cursor-pointer transition-colors"
                        >
                          {job.title}
                        </h2>
                        <p className="text-xs text-slate-300 font-medium mt-0.5">
                          {job.company} &bull; <span className="text-slate-400">{job.location}</span>
                        </p>
                        {job.salary_range && (
                          <p className="text-xs text-emerald-400 font-semibold mt-1">
                            {job.salary_range} / yr &bull; 12 Yrs Experience Match
                          </p>
                        )}
                      </div>

                      {/* Description Snippet */}
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {String(job.summary || job.description || "")}
                      </p>

                      {/* Tech Stack Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {(job.keywords || []).slice(0, 6).map((kw: string) => (
                          <span
                            key={kw}
                            className="px-2 py-0.5 text-[11px] font-medium rounded bg-slate-950 border border-slate-800 text-slate-300"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedJob(job)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                      >
                        Full Details
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTrackJob(job)}
                          className={\`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors \${
                            isTracked
                              ? "bg-emerald-900/60 border-emerald-500/50 text-emerald-200"
                              : "bg-slate-950 border-slate-700 hover:border-slate-500 text-slate-200"
                          }\`}
                        >
                          {isTracked ? "✓ Applied & Tracked" : "Mark Applied & Track"}
                        </button>

                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors inline-flex items-center gap-1"
                        >
                          Apply Direct &rarr;
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </main>
      )}

      {/* TAB 2: PREFERENCES (TITLE & MILES) */}
      {activeTab === "preferences" && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Target Job Titles (Gate 1)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Master Gate evaluates all requisitions against these approved titles ({modeCounts.all} jobs matched).
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-lg">
                {prefs.targetTitles.length} Active Titles
              </span>
            </div>

            <form onSubmit={handleAddTitle} className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Add new target title (e.g. Director of Business Intelligence)..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white"
              >
                + Add Title
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-2">
              {prefs.targetTitles.map(title => (
                <span
                  key={title}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  {title}
                  <button
                    type="button"
                    onClick={() => handleRemoveTitle(title)}
                    className="text-slate-400 hover:text-rose-400 font-bold"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Commute Radius &amp; Work Mode Rules</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Centered on Virginia Beach, VA. Changes immediately update your Jobs &amp; ATS tab.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Maximum Commute Distance:</span>
                <span className="font-bold text-indigo-400">{prefs.maxMiles} miles</span>
              </div>
              <input
                type="range"
                min={10}
                max={150}
                step={5}
                value={prefs.maxMiles}
                onChange={e => updatePrefs({ ...prefs, maxMiles: Number(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>10 mi (VB Local)</span>
                <span>50 mi (Hampton Roads)</span>
                <span>100 mi (+ Richmond)</span>
                <span>150 mi</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3.5 rounded-xl cursor-pointer">
                <span className="text-xs font-medium text-slate-200">Include Hybrid</span>
                <input
                  type="checkbox"
                  checked={prefs.includeHybrid ?? true}
                  onChange={e => updatePrefs({ ...prefs, includeHybrid: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3.5 rounded-xl cursor-pointer">
                <span className="text-xs font-medium text-slate-200">Include On-site</span>
                <input
                  type="checkbox"
                  checked={prefs.includeOnsite ?? true}
                  onChange={e => updatePrefs({ ...prefs, includeOnsite: e.target.checked })}
                  className="h-4 w-4 accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between bg-slate-950 border border-slate-800 p-3.5 rounded-xl cursor-pointer">
                <span className="text-xs font-medium text-slate-200">Include US Remote</span>
                <input
                  type="checkbox"
                  checked={prefs.includeRemote}
                  onChange={e => updatePrefs({ ...prefs, includeRemote: e.target.checked })}
                  className="h-4 w-4 accent-sky-500"
                />
              </label>
            </div>
          </div>
        </main>
      )}

      {/* FULL JOB REQUISITION MODAL */}
      {selectedJob && (
        <div
          onClick={() => setSelectedJob(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
          >
            <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {selectedJob.normalizedMode}
                  </span>
                  <span className="text-xs text-slate-400">{selectedJob.source}</span>
                  <span className="text-xs font-bold text-emerald-400">ATS {selectedJob.score}/100</span>
                </div>
                <h2 className="text-lg font-bold text-white">{selectedJob.title}</h2>
                <p className="text-xs text-slate-300">
                  {selectedJob.company} &bull; {selectedJob.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-white text-xl font-bold px-2"
              >
                &times;
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
              {selectedJob.description}
            </div>

            <div className="p-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 rounded-b-2xl">
              <button
                type="button"
                onClick={() => toggleTrackJob(selectedJob)}
                className={\`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors \${
                  trackedIds.includes(String(selectedJob.id))
                    ? "bg-emerald-900/60 border-emerald-500/50 text-emerald-200"
                    : "bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200"
                }\`}
              >
                {trackedIds.includes(String(selectedJob.id))
                  ? "✓ Applied & Tracked"
                  : "Mark Applied & Track"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Close
                </button>
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Apply Direct on Employer Site &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync("app/dashboard/page.tsx", ENTERPRISE_DASHBOARD_PAGE, "utf8");
console.log("✅ Replaced app/dashboard/page.tsx with deterministic enterprise-ready UI");
