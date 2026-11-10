"use client";

import { JobPreferences } from "@/lib/types";
import { validateSalaryPreferences } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PreferencesForm({ initial }: { initial: JobPreferences | null }) {
  const router = useRouter();
  const [location, setLocation] = useState(initial?.location ?? "");
  const [remote, setRemote] = useState(initial?.remote ?? false);
  const [hybrid, setHybrid] = useState(initial?.hybrid ?? false);
  const [onsite, setOnsite] = useState(initial?.onsite ?? false);
  const [targetSalary, setTargetSalary] = useState(initial?.targetSalary?.toString() ?? "");
  const [absoluteMinimumSalary, setAbsoluteMinimumSalary] = useState(
    initial?.absoluteMinimumSalary?.toString() ?? ""
  );
  const [workAuthorization, setWorkAuthorization] = useState(initial?.workAuthorization ?? "");
  // Tri-state, explicitly: true | false | null (unsure/unset). This is
  // rendered as three radio options rather than a checkbox specifically so
  // "unsure" is a first-class, selectable state rather than a default.
  const [sponsorshipRequired, setSponsorshipRequired] = useState<boolean | null>(
    initial?.sponsorshipRequired ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedTarget = targetSalary ? Number(targetSalary) : null;
    const parsedMinimum = absoluteMinimumSalary ? Number(absoluteMinimumSalary) : null;
    const salaryError = validateSalaryPreferences(parsedTarget, parsedMinimum);
    if (salaryError) {
      setError(salaryError);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        location,
        remote,
        hybrid,
        onsite,
        targetSalary: parsedTarget,
        absoluteMinimumSalary: parsedMinimum,
        workAuthorization,
        sponsorshipRequired,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong saving your preferences.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-signal-red-bg text-signal-red text-sm px-3 py-2.5">{error}</div>
      )}
      <div>
        <label className="label">Preferred location</label>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Austin, TX" />
      </div>

      <div>
        <label className="label">Work setting</label>
        <div className="flex gap-4 text-sm">
          {[
            ["Remote", remote, setRemote],
            ["Hybrid", hybrid, setHybrid],
            ["Onsite", onsite, setOnsite],
          ].map(([label, value, setter]: any) => (
            <label key={label} className="flex items-center gap-2">
              <input type="checkbox" checked={value} onChange={() => setter((v: boolean) => !v)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Target salary</label>
          <input
            type="number"
            className="input"
            value={targetSalary}
            onChange={(e) => setTargetSalary(e.target.value)}
            placeholder="Preference, not a filter"
          />
        </div>
        <div>
          <label className="label">Absolute minimum</label>
          <input
            type="number"
            className="input"
            value={absoluteMinimumSalary}
            onChange={(e) => setAbsoluteMinimumSalary(e.target.value)}
            placeholder="Will exclude jobs below this"
          />
        </div>
      </div>

      <div>
        <label className="label">Work authorization</label>
        <input
          className="input"
          value={workAuthorization}
          onChange={(e) => setWorkAuthorization(e.target.value)}
          placeholder="e.g. U.S. Citizen, H-1B, requires sponsorship"
        />
      </div>

      <div>
        <label className="label">Do you require visa sponsorship?</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sponsorship"
              checked={sponsorshipRequired === true}
              onChange={() => setSponsorshipRequired(true)}
            />
            Yes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sponsorship"
              checked={sponsorshipRequired === false}
              onChange={() => setSponsorshipRequired(false)}
            />
            No
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sponsorship"
              checked={sponsorshipRequired === null}
              onChange={() => setSponsorshipRequired(null)}
            />
            Not sure / prefer not to say
          </label>
        </div>
        <p className="text-xs text-slate-light mt-1.5">
          &quot;Not sure&quot; is kept as unknown — it will never be silently treated as compatible or
          incompatible when matching jobs.
        </p>
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "Saving…" : "Save and find best jobs"}
      </button>
    </form>
  );
}
