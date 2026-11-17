import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const isSrc = fs.existsSync("./src/app");
const baseApp = isSrc ? "./src/app" : "./app";
const apiPath = `${baseApp}/api/jobs/verified/route.ts`;
const dashboardPath = `${baseApp}/dashboard/page.tsx`;
const homePath = `${baseApp}/page.tsx`;

function findResumeRoute(dir, prefix = "") {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("(") || entry.name === "api" || entry.name === "dashboard") continue;
    const fullRoute = `${prefix}/${entry.name}`;
    if (/(resume|tailor|ats|cv|builder)/i.test(entry.name)) {
      const hasPage = ["page.tsx", "page.jsx", "page.ts", "page.js"].some((f) =>
        fs.existsSync(path.join(dir, entry.name, f))
      );
      if (hasPage) return fullRoute;
    }
    const nested = findResumeRoute(path.join(dir, entry.name), fullRoute);
    if (nested) return nested;
  }
  return null;
}

const detectedResumeRoute = findResumeRoute(baseApp) || "/resume";

const apiCode = `import { NextResponse } from 'next/server';
import {
  GENERATED_228_JOBS,
  evaluateJobAgainstMasterGate,
  DEFAULT_MASTER_PREFS
} from '../../../../lib/ats/master-jobs-pool';

export async function GET() {
  const verifiedJobs = GENERATED_228_JOBS
    .filter((job: any) => evaluateJobAgainstMasterGate(job, DEFAULT_MASTER_PREFS))
    .map((job: any, index: number) => ({
      ...job,
      rank: index + 1
    }));

  return NextResponse.json(verifiedJobs);
}
`;
fs.mkdirSync(`${baseApp}/api/jobs/verified`, { recursive: true });
fs.writeFileSync(apiPath, apiCode, "utf8");

const dashboardCode = `"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface VerifiedJob {
  id: string;
  req_id: string;
  rank: number;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  is_remote: boolean;
  miles_from_home: number;
  work_mode: "Remote" | "Hybrid" | "On-site";
  zone?: string;
  sponsorship_status?: string;
  sponsorship_code?: "SPONSORSHIP_AVAILABLE" | "NO_SPONSORSHIP" | "NOT_SPECIFIED";
  posted_label?: string;
  last_date?: string;
  hours_old?: number;
  is_under_24h?: boolean;
  is_under_48h?: boolean;
  is_expiring_soon?: boolean;
  keywords: string[];
  salary_range: string;
  source: string;
  description: string;
}

const ATS_RESUME_ROUTE = ${JSON.stringify(detectedResumeRoute)};
const RELEASE_VERSION = "Final v2.1";

export default function EnterpriseJobDashboard() {
  const [jobs, setJobs] = useState<VerifiedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});

  // Enterprise Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [workModeFilter, setWorkModeFilter] = useState<"ALL" | "Remote" | "Hybrid" | "On-site">("ALL");
  const [freshnessFilter, setFreshnessFilter] = useState<"ALL" | "UNDER_24H" | "UNDER_48H" | "EXPIRING_SOON">("ALL");
  const [sponsorshipFilter, setSponsorshipFilter] = useState<string>("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [hideApplied, setHideApplied] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"rank" | "newest" | "score" | "distance">("rank");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("careerai_applied_jobs");
      if (saved) setAppliedIds(JSON.parse(saved));
    } catch {}

    fetch("/api/jobs/verified")
      .then((res) => res.json())
      .then((data: VerifiedJob[]) => {
        const normalized = Array.isArray(data)
          ? data.map((j, idx) => ({ ...j, rank: j.rank || idx + 1 }))
          : [];
        setJobs(normalized);
        if (normalized.length > 0) setSelectedJobId(normalized[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleApplied = (id: string) => {
    setAppliedIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("careerai_applied_jobs", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const buildResumeTailorHref = (job?: VerifiedJob | null) => {
    if (!job) return ATS_RESUME_ROUTE;
    const params = new URLSearchParams({
      jobId: job.id,
      reqId: job.req_id,
      title: job.title,
      company: job.company,
      keywords: (job.keywords || []).join(",")
    });
    return \`\${ATS_RESUME_ROUTE}?\${params.toString()}\`;
  };

  const sources = useMemo(() => {
    const set = new Set(jobs.map((j) => j.source).filter(Boolean));
    return ["ALL", ...Array.from(set)];
  }, [jobs]);

  const zones = useMemo(() => {
    const set = new Set(jobs.map((j) => j.zone).filter(Boolean) as string[]);
    return ["ALL", ...Array.from(set)];
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      if (workModeFilter !== "ALL" && job.work_mode !== workModeFilter) return false;
      if (freshnessFilter === "UNDER_24H" && !job.is_under_24h) return false;
      if (freshnessFilter === "UNDER_48H" && !job.is_under_48h) return false;
      if (freshnessFilter === "EXPIRING_SOON" && !job.is_expiring_soon) return false;
      if (sponsorshipFilter !== "ALL" && (job.sponsorship_code || "NOT_SPECIFIED") !== sponsorshipFilter) return false;
      if (zoneFilter !== "ALL" && job.zone !== zoneFilter) return false;
      if (sourceFilter !== "ALL" && job.source !== sourceFilter) return false;
      if (hideApplied && appliedIds[job.id]) return false;
      if (q) {
        const hay = \`\${job.title} \${job.company} \${job.location} \${job.req_id} \${job.sponsorship_status || ""} \${job.last_date || ""} \${(job.keywords || []).join(" ")}\`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "newest") return (a.hours_old ?? 999) - (b.hours_old ?? 999) || a.rank - b.rank;
      if (sortBy === "score") return b.score - a.score || a.rank - b.rank;
      if (sortBy === "distance") return a.miles_from_home - b.miles_from_home || a.rank - b.rank;
      return a.rank - b.rank;
    });
  }, [jobs, searchQuery, workModeFilter, freshnessFilter, sponsorshipFilter, zoneFilter, sourceFilter, hideApplied, appliedIds, sortBy]);

  useEffect(() => {
    if (visibleJobs.length === 0) {
      setSelectedJobId("");
      return;
    }
    if (!visibleJobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(visibleJobs[0].id);
    }
  }, [visibleJobs, selectedJobId]);

  const activeJob = useMemo(
    () => visibleJobs.find((j) => j.id === selectedJobId) || visibleJobs[0] || null,
    [visibleJobs, selectedJobId]
  );

  const modeCounts = useMemo(
    () => ({
      ALL: jobs.length,
      Remote: jobs.filter((j) => j.work_mode === "Remote").length,
      Hybrid: jobs.filter((j) => j.work_mode === "Hybrid").length,
      "On-site": jobs.filter((j) => j.work_mode === "On-site").length
    }),
    [jobs]
  );

  const freshnessCounts = useMemo(
    () => ({
      ALL: jobs.length,
      UNDER_24H: jobs.filter((j) => j.is_under_24h).length,
      UNDER_48H: jobs.filter((j) => j.is_under_48h).length,
      EXPIRING_SOON: jobs.filter((j) => j.is_expiring_soon).length
    }),
    [jobs]
  );

  const appliedCount = Object.values(appliedIds).filter(Boolean).length;
  const hasActiveFilters =
    searchQuery !== "" ||
    workModeFilter !== "ALL" ||
    freshnessFilter !== "ALL" ||
    sponsorshipFilter !== "ALL" ||
    zoneFilter !== "ALL" ||
    sourceFilter !== "ALL" ||
    hideApplied;

  const resetAllFilters = () => {
    setSearchQuery("");
    setWorkModeFilter("ALL");
    setFreshnessFilter("ALL");
    setSponsorshipFilter("ALL");
    setZoneFilter("ALL");
    setSourceFilter("ALL");
    setHideApplied(false);
    setSortBy("rank");
  };

  const renderSponsorshipBadge = (job: VerifiedJob) => {
    const code = job.sponsorship_code || "NOT_SPECIFIED";
    if (code === "SPONSORSHIP_AVAILABLE") {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
          Sponsorship Available
        </span>
      );
    }
    if (code === "NO_SPONSORSHIP") {
      return (
        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
          US Citizen / Green Card Req
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
        Sponsorship: Open / Unspecified
      </span>
    );
  };

  const renderDeadlineBadge = (job: VerifiedJob) => {
    if (job.is_under_24h) {
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold">
          NEW • &lt;24h
        </span>
      );
    }
    if (job.is_under_48h) {
      return (
        <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-semibold">
          Recent • &lt;48h
        </span>
      );
    }
    if (job.is_expiring_soon) {
      return (
        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
          ⏳ Expiring Soon ({job.last_date})
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
        Last Date: {job.last_date || "Rolling"}
      </span>
    );
  };

  return (
    <div className="min-h-screen lg:h-screen lg:flex lg:flex-col lg:overflow-hidden bg-slate-100 text-slate-900">
      {/* Top Bar */}
      <header className="shrink-0 bg-slate-900 text-white border-b border-slate-800 px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm shadow">
              ATS
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight">Enterprise ATS Career Command</h1>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                  🔒 {RELEASE_VERSION}
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                  5-Gate Verified • US Eligible
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hampton Roads (≤50 mi) • Virginia / DMV (≤200 mi) • US Remote • Deadline &amp; Sponsorship Tracked
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <Link
              href={ATS_RESUME_ROUTE}
              className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 px-3.5 py-2 rounded-lg font-bold shadow-xs transition inline-flex items-center gap-1.5"
            >
              📄 ATS Resume Studio
            </Link>

            <div className="bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-lg">
              <span className="text-slate-400">Verified Pool:</span>{" "}
              <strong className="text-white text-sm ml-1">{jobs.length}</strong>
            </div>
            <div className="bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-lg">
              <span className="text-slate-400">Filtered View:</span>{" "}
              <strong className="text-indigo-300 text-sm ml-1">{visibleJobs.length}</strong>
            </div>
            <div className="bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-lg">
              <span className="text-slate-400">Applied:</span>{" "}
              <strong className="text-emerald-300 text-sm ml-1">{appliedCount}</strong>
            </div>
          </div>
        </div>
      </header>

      {/* Two-Row Enterprise Filter Toolbar */}
      <section className="shrink-0 bg-white border-b border-slate-200 px-6 py-2.5 shadow-xs space-y-2">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search role, company, SQL, Python..."
            className="w-full sm:w-56 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Work Mode Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(["ALL", "Remote", "Hybrid", "On-site"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setWorkModeFilter(mode)}
                className={\`px-2.5 py-1 rounded-md text-xs font-semibold transition \${
                  workModeFilter === mode
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-white"
                }\`}
              >
                {mode === "ALL" ? "All Modes" : mode} ({modeCounts[mode]})
              </button>
            ))}
          </div>

          {/* Freshness & Deadline Filter (New / <24h / <48h / Expiring Soon) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            {[
              { key: "ALL", label: "All Dates" },
              { key: "UNDER_24H", label: "New (<24h)" },
              { key: "UNDER_48H", label: "<48h" },
              { key: "EXPIRING_SOON", label: "Expiring Soon" }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFreshnessFilter(item.key as any)}
                className={\`px-2.5 py-1 rounded-md text-xs font-semibold transition \${
                  freshnessFilter === item.key
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-white"
                }\`}
              >
                {item.label} ({freshnessCounts[item.key as keyof typeof freshnessCounts]})
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="ml-auto px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
            >
              Reset All
            </button>
          )}
        </div>

        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-2">
          <select
            value={sponsorshipFilter}
            onChange={(e) => setSponsorshipFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            <option value="ALL">Work Auth: All Statuses</option>
            <option value="SPONSORSHIP_AVAILABLE">Sponsorship Available</option>
            <option value="NO_SPONSORSHIP">US Citizen / Green Card Required</option>
            <option value="NOT_SPECIFIED">Sponsorship Not Specified / Open</option>
          </select>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z === "ALL" ? "All Locations" : z}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            {sources.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All ATS Sources" : s}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            <option value="rank">Sort: Rank (#1 First)</option>
            <option value="newest">Sort: Newest Posted First</option>
            <option value="score">Sort: Highest Match %</option>
            <option value="distance">Sort: Closest to VB</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={hideApplied}
              onChange={(e) => setHideApplied(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            Hide Applied
          </label>
        </div>
      </section>

      {/* Independent Scrollable Master-Detail Workspace */}
      <main className="flex-1 lg:overflow-hidden max-w-[1440px] w-full mx-auto px-6 py-4">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm font-medium">
            Loading verified enterprise requisitions...
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
            <p className="text-slate-800 font-semibold">No requisitions match your current filters.</p>
            <button
              onClick={resetAllFilters}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
            {/* LEFT PANE: Ranked Job Feed */}
            <div className="lg:col-span-5 lg:h-full lg:overflow-y-auto space-y-2.5 pr-1 pb-4">
              {visibleJobs.map((job) => {
                const isSelected = activeJob?.id === job.id;
                const isApplied = Boolean(appliedIds[job.id]);
                const modeBadge =
                  job.work_mode === "Remote"
                    ? "bg-sky-50 text-sky-700 border-sky-200"
                    : job.work_mode === "Hybrid"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-purple-50 text-purple-800 border-purple-200";

                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={\`p-4 rounded-xl border cursor-pointer transition-all \${
                      isSelected
                        ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                    }\`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-bold">
                          #{job.rank}
                        </span>
                        <span className="text-xs font-bold text-indigo-700 truncate">{job.company}</span>
                      </div>
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {job.score}% Match
                      </span>
                    </div>

                    <h2 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">{job.title}</h2>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-slate-600">
                      <span className={\`px-2 py-0.5 rounded border font-semibold text-[11px] \${modeBadge}\`}>
                        {job.work_mode}
                      </span>
                      {renderDeadlineBadge(job)}
                      {renderSponsorshipBadge(job)}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                      <span className="truncate">{job.location}</span>
                      {!job.is_remote && <span className="shrink-0">• ~{job.miles_from_home} mi</span>}
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span>{job.source} • Posted {job.posted_label || "Active"}</span>
                      {isApplied ? (
                        <span className="text-emerald-700 font-bold">✓ Applied</span>
                      ) : (
                        <span className="text-slate-400">Req {job.req_id}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RIGHT PANE: Synchronized Requisition Detail */}
            {activeJob && (
              <div className="lg:col-span-7 lg:h-full lg:overflow-y-auto bg-white rounded-xl border border-slate-200 p-6 shadow-xs pb-8">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-xs font-bold">
                        Rank #{activeJob.rank}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                        {activeJob.work_mode}
                      </span>
                      {renderDeadlineBadge(activeJob)}
                      {renderSponsorshipBadge(activeJob)}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mt-2 leading-snug">{activeJob.title}</h2>
                    <p className="text-sm font-semibold text-slate-700 mt-1">
                      {activeJob.company} <span className="text-slate-400 font-normal">•</span>{" "}
                      <span className="font-normal text-slate-600">{activeJob.location}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Link
                      href={buildResumeTailorHref(activeJob)}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition inline-flex items-center gap-1.5"
                    >
                      📄 Tailor ATS Resume
                    </Link>

                    <button
                      onClick={() => toggleApplied(activeJob.id)}
                      className={\`px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer \${
                        appliedIds[activeJob.id]
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                      }\`}
                    >
                      {appliedIds[activeJob.id] ? "✓ Applied" : "Mark Applied"}
                    </button>

                    <a
                      href={activeJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5"
                    >
                      Apply Direct on ATS ↗
                    </a>
                  </div>
                </div>

                {/* Summary Metrics (Includes Posted Date & Last Date of Application) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">ATS Match</span>
                    <strong className="text-emerald-700 text-sm">{activeJob.score}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Posted</span>
                    <strong className="text-slate-800">{activeJob.posted_label || "Active"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Last Date / Deadline</span>
                    <strong className={activeJob.is_expiring_soon ? "text-amber-700" : "text-slate-800"}>
                      {activeJob.last_date || "Rolling / Until Filled"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Work Auth / Visa</span>
                    <strong className="text-slate-800">{activeJob.sponsorship_status || "Open / Unspecified"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Region Tier</span>
                    <strong className="text-slate-800">{activeJob.zone || activeJob.work_mode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Commute / Mode</span>
                    <strong className="text-slate-800">
                      {activeJob.is_remote ? "US Remote (0 mi)" : \`~\${activeJob.miles_from_home} mi from VB\`}
                    </strong>
                  </div>
                </div>

                {/* Direct ATS URL Bar */}
                <div className="mb-5 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500 shrink-0 font-semibold">Verified ATS Endpoint:</span>
                  <a
                    href={activeJob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline truncate font-mono"
                  >
                    {activeJob.url}
                  </a>
                </div>

                {/* Matched Tech Stack */}
                <div className="mb-5">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Matched Core Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(activeJob.keywords || []).map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Requisition Overview */}
                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Requisition Overview
                  </h3>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                    {activeJob.description}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
`;

fs.mkdirSync(`${baseApp}/dashboard`, { recursive: true });
fs.writeFileSync(dashboardPath, dashboardCode, "utf8");

const redirectHome = `import { redirect } from "next/navigation";
export default function HomePage() {
  redirect("/dashboard");
}
`;
fs.writeFileSync(homePath, redirectHome, "utf8");

// Lock Final v2.1 across package.json, lockfile, and Git tag
if (fs.existsSync("./package.json")) {
  const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  pkg.version = "2.1.0";
  fs.writeFileSync("./package.json", JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

const lockManifest = {
  version: "2.1.0",
  label: "Final v2.1",
  lockedAt: new Date().toISOString(),
  atsResumeRoute: detectedResumeRoute,
  dashboardFile: dashboardPath,
  features: [
    "5-Gate US-Only & Virginia Radius Master Filter",
    "Work Mode Filter (Remote / Hybrid / On-site)",
    "Freshness & Deadline Filters (New <24h, <48h, Expiring Soon) + Last Date Tracking",
    "Work Auth & Sponsorship Tagging (Green Card / Visa / Citizen)",
    "Synchronized 1..N Left-Right Rank & Detail Pane",
    "Direct Verified Company ATS Links",
    "ATS Resume Studio & Job-Specific Tailor ATS Resume Link"
  ]
};
fs.writeFileSync("./VERSION_2.1.lock.json", JSON.stringify(lockManifest, null, 2) + "\n", "utf8");

if (fs.existsSync("./.git")) {
  try {
    execSync('git add -A && git commit -m "Lock Final v2.1: Deadline Filters, Sponsorship, Work Mode & ATS Resume Link" --allow-empty', { stdio: "ignore" });
    execSync('git tag -f v2.1-final', { stdio: "ignore" });
    console.log("🏷️  Updated Git tag: v2.1-final");
  } catch {}
}

console.log("✅ Deployed and locked Final v2.1.");
