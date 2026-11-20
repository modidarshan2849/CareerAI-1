"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  evaluateJobForScenario,
  type JobPosting,
  type UserScenario,
} from "@/lib/careerai/scenarioFilter";
import { computeFitScore } from "@/lib/careerai/semanticMatch";
import { ScenarioAndCompanyBar } from "@/components/ScenarioAndCompanyBar";
import { JobDetailDrawer, type DashboardJobRow } from "@/components/JobDetailDrawer";

interface TrackedCompanySummary {
  id: string;
  company_name: string;
  cohort: string;
  sync_status: string;
  last_synced_at: string | null;
}

export function EnterpriseJobsDashboard({ initialJobs = [] }: { initialJobs?: DashboardJobRow[] } = {}) {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) return null;
    return createBrowserClient(url, key);
  }, []);

  const [scenarios, setScenarios] = useState<UserScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<UserScenario | null>(null);
  const [companies, setCompanies] = useState<TrackedCompanySummary[]>([]);
  const [rawJobs, setRawJobs] = useState<JobPosting[]>(initialJobs);
  const [jobStates, setJobStates] = useState<Record<string, DashboardJobRow["userStatus"]>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  const [hideRedFlags, setHideRedFlags] = useState(true);
  const [hideWithdrawn, setHideWithdrawn] = useState(false);
  const [sortBy, setSortBy] = useState<"fit" | "newest">("fit");
  const [selectedJob, setSelectedJob] = useState<DashboardJobRow | null>(null);

  async function loadAllData() {
    setLoading(true);
    try {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const [scenRes, compRes, jobsRes] = await Promise.all([
        fetch("/api/scenarios").then((r) => (r.ok ? r.json() : { scenarios: [] })),
        supabase
          .from("tracked_companies")
          .select("id, company_name, cohort, sync_status, last_synced_at")
          .order("company_name"),
        supabase
          .from("enterprise_jobs")
          .select("job_id, source_company, title, apply_url, description, location, withdrawn_at")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      const loadedScenarios: UserScenario[] = scenRes.scenarios ?? [];
      setScenarios(loadedScenarios);
      const current =
        loadedScenarios.find((s: UserScenario & { is_active?: boolean }) => s.is_active) ??
        loadedScenarios[0] ??
        null;
      setActiveScenario(current);

      setCompanies((compRes.data as TrackedCompanySummary[]) ?? []);
      setRawJobs((jobsRes.data as JobPosting[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fallbackScenario: UserScenario = useMemo(
    () => ({
      id: "default",
      scenario_name: "Default Bachelor's Analyst",
      highest_degree: "bachelors",
      requires_sponsorship: false,
      target_titles: [],
      target_locations: [],
    }),
    []
  );

  const effectiveScenario = activeScenario ?? fallbackScenario;

  const evaluatedJobs: DashboardJobRow[] = useMemo(() => {
    const scenarioText = [
      effectiveScenario.scenario_name,
      ...effectiveScenario.target_titles,
      ...effectiveScenario.target_locations,
    ].join(" ");

    return rawJobs.map((job) => {
      const evalResult = evaluateJobForScenario(job, effectiveScenario);
      const { fitScore } = computeFitScore({
        scenarioText,
        jobText: `${job.title ?? ""} ${job.source_company} ${job.description ?? ""}`,
      });

      return {
        ...job,
        fitScore,
        redFlags: evalResult.redFlags,
        isWithdrawn: evalResult.isWithdrawn,
        userStatus: jobStates[job.job_id] ?? "new",
      };
    });
  }, [rawJobs, effectiveScenario, jobStates]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = evaluatedJobs.filter((job) => {
      if (job.userStatus === "hidden") return false;
      if (selectedCompany !== "ALL" && job.source_company !== selectedCompany) return false;
      if (hideRedFlags && job.redFlags.length > 0) return false;
      if (hideWithdrawn && job.isWithdrawn) return false;
      if (q) {
        const hay = `${job.title ?? ""} ${job.source_company} ${job.location ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "fit") {
      return [...list].sort((a, b) => b.fitScore - a.fitScore);
    }
    return list;
  }, [evaluatedJobs, searchQuery, selectedCompany, hideRedFlags, hideWithdrawn, sortBy]);

  const healthySources = companies.filter((c) => c.sync_status === "healthy").length;
  const withdrawnCount = evaluatedJobs.filter((j) => j.isWithdrawn).length;
  const redFlaggedCount = evaluatedJobs.filter((j) => j.redFlags.length > 0).length;

  async function handleStatusChange(jobId: string, status: DashboardJobRow["userStatus"]) {
    setJobStates((prev) => ({ ...prev, [jobId]: status }));
    if (selectedJob?.job_id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, userStatus: status } : null));
    }

    const client = supabase;
    if (!client) return;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    await client.from("user_job_states").upsert(
      {
        user_id: user.id,
        scenario_id: activeScenario?.id ?? null,
        job_id: jobId,
        status: status ?? "new",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,scenario_id,job_id" }
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      {/* Top Telemetry & Source Health Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <div>
          <h1 className="text-base font-bold tracking-tight">
            CareerAI-1 Enterprise Discovery
          </h1>
          <p className="text-xs text-slate-300">
            {companies.length} Tracked Employers ({healthySources} healthy) •{" "}
            {evaluatedJobs.length} Indexed Roles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 font-medium text-emerald-300">
            Clean Matches: {filteredJobs.length}
          </span>
          <span className="rounded-md bg-rose-500/20 px-2.5 py-1 font-medium text-rose-300">
            Red-Flagged: {redFlaggedCount}
          </span>
          <span className="rounded-md bg-amber-500/20 px-2.5 py-1 font-medium text-amber-300">
            Mid-Day Withdrawn: {withdrawnCount}
          </span>
        </div>
      </div>

      {/* Multi-Scenario Switcher + Add Company & Career URL */}
      <ScenarioAndCompanyBar
        scenarios={scenarios}
        activeScenario={activeScenario}
        onScenarioChange={(s) => setActiveScenario(s)}
        onScenarioCreated={(s) => {
          setScenarios((prev) => [...prev, s]);
          setActiveScenario(s);
        }}
        onCompanyAdded={loadAllData}
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <input
          type="search"
          placeholder="Search role title, skill, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />

        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="ALL">All Employers ({companies.length})</option>
          {companies.map((c) => (
            <option key={c.id} value={c.company_name}>
              {c.company_name} ({c.cohort})
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "fit" | "newest")}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="fit">Sort: Highest Fit Score</option>
          <option value="newest">Sort: Newest Synced</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={hideRedFlags}
            onChange={(e) => setHideRedFlags(e.target.checked)}
          />
          Hide Red-Flagged (Masters / Visa)
        </label>

        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={hideWithdrawn}
            onChange={(e) => setHideWithdrawn(e.target.checked)}
          />
          Hide Withdrawn
        </label>
      </div>

      {/* Results Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading enterprise requisitions and evaluating scenario rules...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No matching jobs for current filters. Try unchecking &ldquo;Hide Red-Flagged&rdquo; or triggering a live-sync.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Fit</th>
                  <th className="px-4 py-3">Role Title</th>
                  <th className="px-4 py-3">Employer</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Flags &amp; Sweep Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.map((job) => (
                  <tr
                    key={job.job_id}
                    onClick={() => setSelectedJob(job)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${
                      job.isWithdrawn ? "bg-amber-50/40 opacity-75" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-blue-700">
                      {job.fitScore}%
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {job.title ?? "Untitled Role"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{job.source_company}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {job.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {job.isWithdrawn && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Withdrawn
                          </span>
                        )}
                        {job.redFlags.includes("MANDATORY_MASTERS") && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                            Master&apos;s Req
                          </span>
                        )}
                        {job.redFlags.includes("SPONSORSHIP_RISK") && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                            No Sponsorship
                          </span>
                        )}
                        {!job.isWithdrawn && job.redFlags.length === 0 && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Active • Clean
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedJob(job)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-Over Detail & Tailoring Drawer */}
      <JobDetailDrawer
        job={selectedJob}
        activeScenario={activeScenario}
        onClose={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export type JobRecord = DashboardJobRow;
export default EnterpriseJobsDashboard;
