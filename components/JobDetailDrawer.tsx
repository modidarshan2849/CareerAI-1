"use client";

import React from "react";
import type { JobPosting, UserScenario } from "@/lib/careerai/scenarioFilter";

export interface DashboardJobRow extends JobPosting {
  fitScore: number;
  redFlags: string[];
  isWithdrawn: boolean;
  userStatus?: "new" | "saved" | "tailored" | "applied" | "hidden";
}

interface Props {
  job: DashboardJobRow | null;
  activeScenario: UserScenario | null;
  onClose: () => void;
  onStatusChange: (jobId: string, status: DashboardJobRow["userStatus"]) => void;
  onTriggerTailor?: (job: DashboardJobRow) => void;
}

export function JobDetailDrawer({
  job,
  activeScenario,
  onClose,
  onStatusChange,
  onTriggerTailor,
}: Props) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {job.source_company}
              </span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Fit: {job.fitScore}%
              </span>
              {job.isWithdrawn && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Withdrawn / Closed Mid-Day
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {job.title ?? "Untitled Role"}
            </h2>
            {job.location && (
              <p className="text-xs text-slate-500">{job.location}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {/* Scenario & Red-Flag Callouts */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-600">
            <span>
              Evaluated against:{" "}
              <strong className="text-slate-900">
                {activeScenario?.scenario_name ?? "Default Scenario"}
              </strong>
            </span>
            <span className="uppercase">{activeScenario?.highest_degree ?? "bachelors"}</span>
          </div>

          {job.redFlags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {job.redFlags.includes("MANDATORY_MASTERS") && (
                <span className="rounded-md bg-rose-100 px-2 py-1 font-semibold text-rose-800">
                  Red Flag: Mandatory Master&apos;s Degree Detected
                </span>
              )}
              {job.redFlags.includes("SPONSORSHIP_RISK") && (
                <span className="rounded-md bg-rose-100 px-2 py-1 font-semibold text-rose-800">
                  Red Flag: No Visa Sponsorship / Clearance Required
                </span>
              )}
            </div>
          )}
        </div>

        {/* Description Body */}
        <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
          {job.description || "No full description stored yet for this posting. Use the direct apply link below to inspect the live ATS requisition."}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStatusChange(job.job_id, "saved")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {job.userStatus === "saved" ? "Saved" : "Save Role"}
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(job.job_id, "hidden")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Hide
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onTriggerTailor && !job.isWithdrawn && (
              <button
                type="button"
                onClick={() => onTriggerTailor(job)}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Tailor Resume &amp; Cover Letter
              </button>
            )}
            {job.apply_url && (
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white ${
                  job.isWithdrawn
                    ? "bg-slate-400 pointer-events-none"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {job.isWithdrawn ? "Posting Closed" : "Apply Direct"}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
