"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

const POPULAR_ROLES = [
  "Senior Data Analyst",
  "Lead Data Analyst",
  "Analytics Engineer",
  "BI Developer / Architect",
  "Data Engineer",
  "Enterprise Data Architect",
];

const WORK_MODES = ["remote", "hybrid", "onsite"];

export default function PreferencesPage() {
  const router = useRouter();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    "Senior Data Analyst",
    "Analytics Engineer",
  ]);
  const [customRole, setCustomRole] = useState("");
  const [selectedModes, setSelectedModes] = useState<string[]>(["remote", "hybrid"]);
  const [minSalary, setMinSalary] = useState(120000);
  const [location, setLocation] = useState("Virginia Beach, VA");
  const [maxCommuteMiles, setMaxCommuteMiles] = useState(50);
  const [citizenshipStatus, setCitizenshipStatus] = useState("US_Citizen");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const data = await res.json();
          if (data?.preferences) {
            const p = data.preferences;
            if (Array.isArray(p.target_titles) && p.target_titles.length > 0) setSelectedRoles(p.target_titles);
            if (Array.isArray(p.work_modes) && p.work_modes.length > 0) setSelectedModes(p.work_modes);
            if (typeof p.min_salary === "number") setMinSalary(p.min_salary);
            if (p.max_commute_miles) setMaxCommuteMiles(p.max_commute_miles);
            if (p.citizenship_status) setCitizenshipStatus(p.citizenship_status);
            if (Array.isArray(p.target_locations) && p.target_locations.length > 0) setLocation(p.target_locations[0]);
          }
        }
      } catch (err: any) {
        console.warn("Could not load existing preferences:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, []);

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function addCustomRole(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = customRole.trim();
    if (!trimmed) return;
    if (!selectedRoles.includes(trimmed)) {
      setSelectedRoles((prev) => [...prev, trimmed]);
    }
    setCustomRole("");
  }

  function toggleMode(mode: string) {
    setSelectedModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      setError("Please select at least one target role.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_titles: selectedRoles,
          work_modes: selectedModes,
          min_salary: minSalary,
          target_locations: [location],
          max_commute_miles: maxCommuteMiles,
          citizenship_status: citizenshipStatus,
          requires_sponsorship: citizenshipStatus === "Requires_Sponsorship",
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save preferences.");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to save preferences.");
      setIsSaving(false);
    }
  }

  const needsCommuteRadius = selectedModes.includes("hybrid") || selectedModes.includes("onsite");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Nav active="/preferences" />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading career targets...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav active="/preferences" />

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
            Step 2 of 3: Target Alignment
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Set Your Career Target</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Specify your desired roles, compensation floor, work modes, and legal authorization to unlock accurate matching.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-sm rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Target Job Titles */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Target Job Titles
            </h2>
            <div className="flex flex-wrap gap-2">
              {POPULAR_ROLES.map((role) => {
                const active = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      active
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                    }`}
                  >
                    {role} {active && "✓"}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Add other target role (e.g., Staff BI Architect)..."
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className="flex-1 px-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
              />
              <button
                type="button"
                onClick={addCustomRole}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 rounded-xl text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>

          {/* Work Authorization & Citizenship */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Work Authorization Status
              </h2>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Used for deterministic visa gating
              </span>
            </div>

            <select
              value={citizenshipStatus}
              onChange={(e) => setCitizenshipStatus(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium"
            >
              <option value="US_Citizen">U.S. Citizen (Eligible for defense & clearance roles)</option>
              <option value="Green_Card">Permanent Resident (Green Card holder)</option>
              <option value="EAD_OPT">EAD / STEM OPT (Requires future authorization)</option>
              <option value="H1B_Transfer">H-1B Holder (Eligible for H-1B transfer)</option>
              <option value="Requires_Sponsorship">Requires Direct Visa Sponsorship</option>
            </select>
          </div>

          {/* Compensation & Work Arrangement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Minimum Base Salary Floor
              </h2>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-zinc-900 dark:text-zinc-100">
                  ${minSalary.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">/ year</span>
              </div>
              <input
                type="range"
                min="70000"
                max="250000"
                step="5000"
                value={minSalary}
                onChange={(e) => setMinSalary(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Work Arrangement Modes
              </h2>
              <div className="flex gap-2">
                {WORK_MODES.map((mode) => {
                  const active = selectedModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => toggleMode(mode)}
                      className={`flex-1 py-2.5 capitalize rounded-xl text-sm font-semibold border transition-all ${
                        active
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Candidate Home Location (e.g. Virginia Beach, VA)"
                className="w-full px-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
              />
            </div>
          </div>

          {/* Conditional Commute Radius */}
          {needsCommuteRadius && (
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Maximum Commute Radius
                </h2>
                <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {maxCommuteMiles} miles from {location}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={maxCommuteMiles}
                onChange={(e) => setMaxCommuteMiles(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Roles requiring onsite presence beyond {maxCommuteMiles} miles will be automatically gated unless tagged with a nationwide remote option.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-all text-sm"
          >
            {isSaving ? "Saving Alignment..." : "Save Preferences & Re-Rank Job Feed →"}
          </button>
        </form>
      </main>
    </div>
  );
}
