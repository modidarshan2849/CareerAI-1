"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type FreshnessOption = "all" | "24h" | "48h" | "expiring";

export interface FilterableJob {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  is_remote?: boolean;
  posted_at?: string | null;
  created_at?: string | null;
  last_verified_at?: string | null;
  expires_at?: string | null;
}

interface JobFilterBarProps<T extends FilterableJob> {
  jobs: T[];
  onFilteredJobsChange: (filtered: T[]) => void;
}

function extractCityLabel(location?: string, isRemote?: boolean): string {
  if (isRemote || (location && /\bremote\b/i.test(location))) {
    return "Remote";
  }
  if (!location || !location.trim()) return "Unspecified";
  // Normalize "Virginia Beach, VA" or "New York, NY, USA" -> "Virginia Beach, VA"
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1].replace(/\s+\d{5}.*$/, "")}`;
  }
  return parts[0];
}

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; count: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.value.toLowerCase().includes(q));
  }, [options, query]);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-[230px] flex-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="truncate text-slate-700 font-medium">
          {selected.length === 0
            ? label
            : `${label} (${selected.length} selected)`}
        </span>
        <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full min-w-[270px] bg-white border border-slate-200 rounded-xl shadow-lg p-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md mb-2 focus:outline-none focus:border-blue-500"
          />

          <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-slate-500 border-b border-slate-100">
            <span>{filteredOptions.length} options</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-blue-600 hover:underline font-medium"
              >
                Clear ({selected.length})
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto mt-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOption(opt.value)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate text-slate-700">{opt.value}</span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {opt.count}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobFilterBar<T extends FilterableJob>({
  jobs,
  onFilteredJobsChange,
}: JobFilterBarProps<T>) {
  const [freshness, setFreshness] = useState<FreshnessOption>("all");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const titleOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      const t = (j.title || "").trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [jobs]);

  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      const city = extractCityLabel(j.location, j.is_remote);
      counts.set(city, (counts.get(city) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (a.value === "Remote") return -1;
        if (b.value === "Remote") return 1;
        return b.count - a.count || a.value.localeCompare(b.value);
      });
  }, [jobs]);

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const h48 = 48 * 60 * 60 * 1000;
    const expiringWindow = 72 * 60 * 60 * 1000;

    return jobs.filter((job) => {
      // 1. Freshness filter
      if (freshness !== "all") {
        const postedRaw = job.posted_at || job.created_at || job.last_verified_at;
        const postedMs = postedRaw ? new Date(postedRaw).getTime() : NaN;

        if (freshness === "24h" && (Number.isNaN(postedMs) || nowMs - postedMs > h24)) {
          return false;
        }
        if (freshness === "48h" && (Number.isNaN(postedMs) || nowMs - postedMs > h48)) {
          return false;
        }
        if (freshness === "expiring") {
          const expMs = job.expires_at ? new Date(job.expires_at).getTime() : NaN;
          // Fallback: if expires_at is null, treat roles aged 12-14 days as expiring soon
          const ageMs = !Number.isNaN(postedMs) ? nowMs - postedMs : NaN;
          const isClosingSoon =
            (!Number.isNaN(expMs) && expMs > nowMs && expMs - nowMs <= expiringWindow) ||
            (!Number.isNaN(ageMs) && ageMs >= 11 * h24 && ageMs <= 14 * h24);
          if (!isClosingSoon) return false;
        }
      }

      // 2. Multi-choice Title filter
      if (selectedTitles.length > 0) {
        const jobTitle = (job.title || "").trim().toLowerCase();
        const matchesTitle = selectedTitles.some(
          (sel) => jobTitle === sel.toLowerCase() || jobTitle.includes(sel.toLowerCase())
        );
        if (!matchesTitle) return false;
      }

      // 3. Multi-choice City / Location filter
      if (selectedLocations.length > 0) {
        const city = extractCityLabel(job.location, job.is_remote);
        if (!selectedLocations.includes(city)) return false;
      }

      return true;
    });
  }, [jobs, freshness, selectedTitles, selectedLocations]);

  useEffect(() => {
    onFilteredJobsChange(filtered);
  }, [filtered, onFilteredJobsChange]);

  const freshnessPills: { id: FreshnessOption; label: string }[] = [
    { id: "all", label: "All Active" },
    { id: "24h", label: "< 24h" },
    { id: "48h", label: "< 48h" },
    { id: "expiring", label: "Expiring Soon" },
  ];

  const hasActiveFilters =
    freshness !== "all" || selectedTitles.length > 0 || selectedLocations.length > 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-3">
      {/* Row 1: Freshness pills + Multi-select Title & Location dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {freshnessPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setFreshness(pill.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${
                freshness === pill.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <MultiSelectDropdown
          label="Job Title"
          placeholder="Search titles (e.g. Data Analyst)..."
          options={titleOptions}
          selected={selectedTitles}
          onChange={setSelectedTitles}
        />

        <MultiSelectDropdown
          label="City / Location"
          placeholder="Search cities (e.g. New York, Remote)..."
          options={locationOptions}
          selected={selectedLocations}
          onChange={setSelectedLocations}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFreshness("all");
              setSelectedTitles([]);
              setSelectedLocations([]);
            }}
            className="text-xs font-medium text-rose-600 hover:underline px-2 py-1"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Row 2: Active selection badges */}
      {(selectedTitles.length > 0 || selectedLocations.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/70">
          {selectedTitles.map((title) => (
            <span
              key={`t-${title}`}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
            >
              Title: {title}
              <button
                type="button"
                onClick={() =>
                  setSelectedTitles(selectedTitles.filter((t) => t !== title))
                }
                className="hover:text-blue-900 font-bold"
              >
                ×
              </button>
            </span>
          ))}
          {selectedLocations.map((loc) => (
            <span
              key={`l-${loc}`}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              City: {loc}
              <button
                type="button"
                onClick={() =>
                  setSelectedLocations(selectedLocations.filter((l) => l !== loc))
                }
                className="hover:text-emerald-900 font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
