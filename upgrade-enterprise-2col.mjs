import fs from "fs";

const ENTERPRISE_2COL_PAGE = `"use client";

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

export default function EnterpriseMasterDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "preferences">("dashboard");
  const [modeFilter, setModeFilter] = useState<WorkModeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [prefs, setPrefs] = useState<MasterPreferences>(DEFAULT_MASTER_PREFS);
  const [newTitle, setNewTitle] = useState("");
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      // fallback
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const updatePrefs = (next: MasterPreferences) => {
    setPrefs(next);
    localStorage.setItem("careerai_master_prefs", JSON.stringify(next));
    showToast("Preferences updated & Master Gate recalculated!");
  };

  const toggleTrackJob = (job: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const id = String(job.id);
    const exists = trackedIds.includes(id);
    const next = exists ? trackedIds.filter(item => item !== id) : [...trackedIds, id];
    setTrackedIds(next);
    localStorage.setItem("careerai_tracked_ids", JSON.stringify(next));
    showToast(
      exists
        ? \`Removed "\${job.title}" from tracker\`
        : \`Marked "\${job.title}" at \${job.company} as Applied & Tracked\`
    );
  };

  const normalizeWorkMode = (job: any): "Hybrid" | "On-site" | "Remote" => {
    if (job.is_remote === true || job.remote === true) return "Remote";
    const mode = String(job.work_mode || "").toLowerCase();
    if (mode.includes("on-site") || mode.includes("onsite")) return "On-site";
    return "Hybrid";
  };

  // Master Gate evaluation
  const masterApprovedJobs = useMemo(() => {
    return GENERATED_228_JOBS.filter(job => evaluateJobAgainstMasterGate(job, prefs)).map(job => ({
      ...job,
      normalizedMode: normalizeWorkMode(job)
    }));
  }, [prefs]);

  // Default selected job to first item if none selected
  useEffect(() => {
    if (masterApprovedJobs.length > 0 && !selectedJob) {
      setSelectedJob(masterApprovedJobs[0]);
    }
  }, [masterApprovedJobs, selectedJob]);

  // Mode counts
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

  // Filtered & Sorted jobs for Column 2
  const visibleJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = masterApprovedJobs.filter(job => {
      if (modeFilter === "Hybrid" && job.normalizedMode !== "Hybrid") return false;
      if (modeFilter === "On-site" && job.normalizedMode !== "On-site") return false;
      if (modeFilter === "Remote" && job.normalizedMode !== "Remote") return false;
      if (modeFilter === "TRACKED" && !trackedIds.includes(String(job.id))) return false;

      if (activeKpiFilter === "local" && job.normalizedMode === "Remote") return false;
      if (activeKpiFilter === "remote" && !job.is_remote) return false;

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
      const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.normalizedMode === "Remote" ? 1 : 0) - (b.normalizedMode === "Remote" ? 1 : 0);
    });
  }, [masterApprovedJobs, modeFilter, searchQuery, sortBy, trackedIds, activeKpiFilter]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-900/95 border border-emerald-500/50 text-emerald-100 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {toastMessage}
        </div>
      )}

      {/* Top Enterprise Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-inner">
              CA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  CareerAI Enterprise Master
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
              1. Master Dashboard ({modeCounts.all})
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
              2. Preferences (Title &amp; Miles)
            </button>
          </nav>
        </div>
      </header>

      {/* TAB 1: ENTERPRISE 2-COLUMN DASHBOARD */}
      {activeTab === "dashboard" && (
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Interactive KPI Summary Strip (Clickable Cards that update view instantly) */}
          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div
              onClick={() => { setActiveKpiFilter(null); setModeFilter("ALL"); }}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer rounded-xl p-4 transition-all"
            >
              <div className="text-xs text-slate-400 font-medium">Master Gate Pool</div>
              <div className="text-2xl font-bold text-white mt-1">{modeCounts.all}</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">100% HTTP &amp; Radius Verified</div>
            </div>

            <div
              onClick={() => { setActiveKpiFilter("local"); setModeFilter("ALL"); }}
              className={\`bg-slate-900 border cursor-pointer rounded-xl p-4 transition-all \${
                activeKpiFilter === "local" ? "border-emerald-500 bg-emerald-950/20" : "border-slate-800 hover:border-emerald-500/50"
              }\`}
            >
              <div className="text-xs text-slate-400 font-medium">Local (&le;{prefs.maxMiles} mi)</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {modeCounts.hybrid + modeCounts.onsite}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {modeCounts.hybrid} Hybrid &bull; {modeCounts.onsite} On-site
              </div>
            </div>

            <div
              onClick={() => { setActiveKpiFilter("remote"); setModeFilter("ALL"); }}
              className={\`bg-slate-900 border cursor-pointer rounded-xl p-4 transition-all \${
                activeKpiFilter === "remote" ? "border-sky-500 bg-sky-950/20" : "border-slate-800 hover:border-sky-500/50"
              }\`}
            >
              <div className="text-xs text-slate-400 font-medium">US-Eligible Remote</div>
              <div className="text-2xl font-bold text-sky-400 mt-1">{modeCounts.remote}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Non-US / Canada Blocked</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400 font-medium">ATS Profile Strength</div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">{DEFAULT_SNAPSHOT.score}/100</div>
              <div className="text-[11px] text-slate-400 mt-0.5">12 Yrs Senior Data Analyst</div>
            </div>

            <div
              onClick={() => setModeFilter("TRACKED")}
              className={\`bg-slate-900 border cursor-pointer rounded-xl p-4 col-span-2 lg:col-span-1 transition-all \${
                modeFilter === "TRACKED" ? "border-purple-500 bg-purple-950/20" : "border-slate-800 hover:border-purple-500/50"
              }\`}
            >
              <div className="text-xs text-slate-400 font-medium">Applied &amp; Tracked</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">{modeCounts.tracked}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Saved in Tracker</div>
            </div>
          </section>

          {/* Enterprise 2-Column Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMN 1: Search, Filter Pills & Job Cards List (7 Cols) */}
            <section className="lg:col-span-7 space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setModeFilter("ALL"); setActiveKpiFilter(null); }}
                    className={\`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                      modeFilter === "ALL" && !activeKpiFilter
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }\`}
                  >
                    All ({modeCounts.all})
                  </button>

                  <button
                    type="button"
                    onClick={() => setModeFilter("Hybrid")}
                    className={\`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
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
                    className={\`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
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
                    className={\`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border \${
                      modeFilter === "Remote"
                        ? "bg-sky-600 border-sky-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }\`}
                  >
                    Remote ({modeCounts.remote})
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search title, company, skill..."
                    className="bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 w-full sm:w-48"
                  />
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortOption)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="score">ATS Score</option>
                    <option value="miles">Closest</option>
                    <option value="salary">Salary</option>
                  </select>
                </div>
              </div>

              {/* Job Cards Stack */}
              <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
                {visibleJobs.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center space-y-2">
                    <p className="text-sm font-semibold text-white">No jobs found for this filter</p>
                    <button
                      type="button"
                      onClick={() => { setModeFilter("ALL"); setActiveKpiFilter(null); setSearchQuery(""); }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  visibleJobs.map(job => {
                    const isSelected = selectedJob?.id === job.id;
                    const isTracked = trackedIds.includes(String(job.id));
                    const modeBadgeClass =
                      job.normalizedMode === "Hybrid"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : job.normalizedMode === "On-site"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-sky-500/15 text-sky-300 border-sky-500/30";

                    return (
                      <div
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={\`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all \${
                          isSelected
                            ? "border-indigo-500 bg-slate-850 shadow-lg shadow-indigo-500/10"
                            : "border-slate-800 hover:border-slate-700"
                        }\`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={\`px-2 py-0.5 rounded text-[10px] font-semibold border \${modeBadgeClass}\`}>
                                {job.normalizedMode}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {job.normalizedMode === "Remote" ? "US Remote" : \`\${job.miles_from_home} mi from VB\`}
                              </span>
                              <span className="text-[11px] text-slate-500">&bull; {job.source}</span>
                            </div>

                            <h2 className="text-sm font-bold text-white hover:text-indigo-400 transition-colors">
                              {job.title}
                            </h2>
                            <p className="text-xs text-slate-300 font-medium">
                              {job.company} &bull; <span className="text-slate-400">{job.location}</span>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                              {job.score} pts
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-emerald-400 font-medium">
                            {job.salary_range || "$130k - $165k / yr"}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => toggleTrackJob(job, e)}
                              className={\`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors \${
                                isTracked
                                  ? "bg-emerald-900/60 border-emerald-500/50 text-emerald-200"
                                  : "bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500"
                              }\`}
                            >
                              {isTracked ? "✓ Tracked" : "Track"}
                            </button>

                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="px-3 py-1 rounded text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                            >
                              Apply Direct &rarr;
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* COLUMN 2: Pinned Requisition Inspector / Details Drawer (5 Cols) */}
            <section className="lg:col-span-5 sticky top-20 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl max-h-[82vh] flex flex-xl flex-col justify-between overflow-hidden">
              {selectedJob ? (
                <div className="flex flex-col h-full space-y-4 overflow-hidden">
                  {/* Header */}
                  <div className="border-b border-slate-800 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {selectedJob.normalizedMode}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">ATS Score: {selectedJob.score}/100</span>
                    </div>
                    <h2 className="text-base font-bold text-white">{selectedJob.title}</h2>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      {selectedJob.company} &bull; <span className="text-slate-400">{selectedJob.location}</span>
                    </p>
                  </div>

                  {/* Scrollable Body */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                    {selectedJob.description}
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTrackJob(selectedJob)}
                      className={\`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors \${
                        trackedIds.includes(String(selectedJob.id))
                          ? "bg-emerald-900/60 border-emerald-500/50 text-emerald-200"
                          : "bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500"
                      }\`}
                    >
                      {trackedIds.includes(String(selectedJob.id)) ? "✓ Applied & Tracked" : "Mark Applied & Track"}
                    </button>

                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                    >
                      Apply Direct on Site &rarr;
                    </a>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 text-xs">
                  Select a job requisition from the left column to inspect full details and Master Gate verification.
                </div>
              )}
            </section>
          </div>
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
                Centered on Virginia Beach, VA. Changes immediately update your Master Dashboard.
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
    </div>
  );
}
`;

fs.writeFileSync("app/dashboard/page.tsx", ENTERPRISE_2COL_PAGE, "utf8");
console.log("✅ Deployed enterprise 2-column master dashboard to app/dashboard/page.tsx");
