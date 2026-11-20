"use client";

import React, { useState } from "react";
import type { UserScenario } from "@/lib/careerai/scenarioFilter";

interface Props {
  scenarios: UserScenario[];
  activeScenario: UserScenario | null;
  onScenarioChange: (scenario: UserScenario) => void;
  onScenarioCreated: (scenario: UserScenario) => void;
  onCompanyAdded: () => void;
}

export function ScenarioAndCompanyBar({
  scenarios,
  activeScenario,
  onScenarioChange,
  onScenarioCreated,
  onCompanyAdded,
}: Props) {
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [careerUrl, setCareerUrl] = useState("");
  const [cohort, setCohort] = useState("Enterprise");
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyFeedback, setCompanyFeedback] = useState<string | null>(null);

  const [showNewScenario, setShowNewScenario] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [highestDegree, setHighestDegree] = useState<"bachelors" | "masters" | "phd">("bachelors");
  const [requiresSponsorship, setRequiresSponsorship] = useState(false);
  const [targetTitlesRaw, setTargetTitlesRaw] = useState("Senior Data Analyst, Lead Data Analyst, BI Analyst");
  const [savingScenario, setSavingScenario] = useState(false);

  async function handleSelectScenario(id: string) {
    const found = scenarios.find((s) => s.id === id);
    if (!found) return;
    onScenarioChange(found);
    await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activate_id: id }),
    });
  }

  async function handleCreateScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!scenarioName.trim()) return;
    setSavingScenario(true);
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_name: scenarioName.trim(),
          highest_degree: highestDegree,
          requires_sponsorship: requiresSponsorship,
          target_titles: targetTitlesRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (res.ok && json.scenario) {
        onScenarioCreated(json.scenario);
        setShowNewScenario(false);
        setScenarioName("");
      }
    } finally {
      setSavingScenario(false);
    }
  }

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !careerUrl.trim()) return;
    setSavingCompany(true);
    setCompanyFeedback(null);
    try {
      const res = await fetch("/api/companies/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          career_url: careerUrl.trim(),
          cohort,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCompanyFeedback(`Error: ${json.error ?? "Failed to add company"}`);
      } else {
        setCompanyFeedback(
          `Added ${json.company.company_name} (${json.company.ats_provider} connector)`
        );
        setCompanyName("");
        setCareerUrl("");
        onCompanyAdded();
      }
    } finally {
      setSavingCompany(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Scenario Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Scenario:
          </span>
          <select
            value={activeScenario?.id ?? ""}
            onChange={(e) => handleSelectScenario(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            {scenarios.length === 0 && (
              <option value="">Default (Bachelors Analyst)</option>
            )}
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.scenario_name} ({s.highest_degree.toUpperCase()}
                {s.requires_sponsorship ? " • Sponsorship" : ""})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewScenario((v) => !v)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            + New Scenario
          </button>
        </div>

        {/* Add Company + Career URL Toggle */}
        <button
          type="button"
          onClick={() => setShowAddCompany((v) => !v)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          + Add Company &amp; Career URL
        </button>
      </div>

      {/* Inline New Scenario Form */}
      {showNewScenario && (
        <form
          onSubmit={handleCreateScenario}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4"
        >
          <input
            type="text"
            placeholder="Scenario name (e.g. FinTech SQL Lead)"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            required
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          />
          <select
            value={highestDegree}
            onChange={(e) =>
              setHighestDegree(e.target.value as "bachelors" | "masters" | "phd")
            }
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="bachelors">Highest Degree: Bachelor&apos;s</option>
            <option value="masters">Highest Degree: Master&apos;s</option>
            <option value="phd">Highest Degree: PhD</option>
          </select>
          <input
            type="text"
            placeholder="Target titles (comma-separated)"
            value={targetTitlesRaw}
            onChange={(e) => setTargetTitlesRaw(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={requiresSponsorship}
                onChange={(e) => setRequiresSponsorship(e.target.checked)}
              />
              Needs Sponsorship
            </label>
            <button
              type="submit"
              disabled={savingScenario}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {savingScenario ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* Inline Add Company + Career URL Form */}
      {showAddCompany && (
        <form
          onSubmit={handleAddCompany}
          className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-4"
        >
          <input
            type="text"
            placeholder="Company Name (e.g. Stripe)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          />
          <input
            type="url"
            placeholder="Career URL (https://...)"
            value={careerUrl}
            onChange={(e) => setCareerUrl(e.target.value)}
            required
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm md:col-span-2"
          />
          <div className="flex items-center gap-2">
            <select
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="Enterprise">Enterprise</option>
              <option value="Big Banks">Big Banks</option>
              <option value="Custom">Custom</option>
            </select>
            <button
              type="submit"
              disabled={savingCompany}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {savingCompany ? "Adding..." : "Add"}
            </button>
          </div>
          {companyFeedback && (
            <p className="text-xs font-medium text-slate-700 md:col-span-4">
              {companyFeedback}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
