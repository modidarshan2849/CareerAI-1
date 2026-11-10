"use client";

import { EvidenceChip } from "@/components/EvidenceChip";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WorkExperience } from "@/lib/types";

type ProfileData = Awaited<ReturnType<typeof import("@/lib/data").getFullProfile>>;

export function ProfileReviewClient({ initialProfile }: { initialProfile: ProfileData }) {
  const router = useRouter();
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>(initialProfile.workExperience);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField(id: string, field: "jobTitle" | "employer", value: string) {
    setSaved(false);
    setWorkExperience((prev) => prev.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp)));
  }

  function updateDate(id: string, field: "startDate" | "endDate", value: string) {
    setSaved(false);
    setWorkExperience((prev) =>
      prev.map((exp) =>
        exp.id === id ? { ...exp, period: { ...exp.period, [field]: value || null } } : exp
      )
    );
  }

  function toggleCurrent(id: string) {
    setSaved(false);
    setWorkExperience((prev) =>
      prev.map((exp) =>
        exp.id === id
          ? { ...exp, period: { ...exp.period, isCurrent: !exp.period.isCurrent, endDate: null } }
          : exp
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workExperience }),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  return (
    <div className="space-y-8">
      {initialProfile.validationWarnings.length > 0 && (
        <section className="card border-signal-amber/30 bg-signal-amber-bg/40">
          <p className="font-medium text-signal-amber mb-2">
            {initialProfile.validationWarnings.length} thing(s) need your attention
          </p>
          <ul className="text-sm text-ink space-y-1.5">
            {initialProfile.validationWarnings.map((w) => (
              <li key={w.id}>• {w.message}</li>
            ))}
          </ul>
        </section>
      )}

      {initialProfile.experienceBreakdown && !initialProfile.experienceBreakdown.needsUserConfirmation && (
        <section className="card">
          <p className="label">Experience</p>
          <div className="grid grid-cols-2 gap-6 mt-2">
            <div>
              <p className="text-xs text-slate-light uppercase tracking-wide mb-1">Total career experience</p>
              <p className="font-display text-3xl">
                {initialProfile.experienceBreakdown.totalYears ?? "—"}y {initialProfile.experienceBreakdown.totalMonths ?? 0}m
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-light uppercase tracking-wide mb-1">
                Relevant to {initialProfile.experienceBreakdown.currentDomain ?? "current direction"}
              </p>
              <p className="font-display text-3xl">
                {initialProfile.experienceBreakdown.currentDomainYears ?? "—"}y{" "}
                {initialProfile.experienceBreakdown.currentDomainMonths ?? 0}m
              </p>
            </div>
          </div>
          {initialProfile.experienceBreakdown.currentDomain &&
            initialProfile.experienceBreakdown.currentDomainYears !== initialProfile.experienceBreakdown.totalYears && (
              <p className="text-xs text-slate mt-3">
                Your total experience includes time outside {initialProfile.experienceBreakdown.currentDomain}. Only
                the experience within your confirmed direction counts toward current-domain matching.
              </p>
            )}
        </section>
      )}

      {initialProfile.experienceBreakdown?.needsUserConfirmation && (
        <section className="card border-hairline">
          <p className="text-sm text-slate">
            Your career direction hasn&apos;t been confirmed yet — see the prompt above. Once confirmed, your
            total vs. current-domain experience breakdown will appear here.
          </p>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl mb-4">Work experience</h2>
        <div className="space-y-4">
          {workExperience.length === 0 && (
            <p className="text-sm text-slate">No work experience was extracted from your resume.</p>
          )}
          {workExperience.map((exp) => (
            <div key={exp.id} className="card">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Job title</label>
                  <input
                    className="input"
                    value={exp.jobTitle}
                    onChange={(e) => updateField(exp.id, "jobTitle", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Employer</label>
                  <input
                    className="input"
                    value={exp.employer}
                    onChange={(e) => updateField(exp.id, "employer", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Start date</label>
                  <input
                    type="month"
                    className="input"
                    value={exp.period.startDate ?? ""}
                    onChange={(e) => updateDate(exp.id, "startDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label flex items-center justify-between">
                    <span>End date</span>
                    <span className="flex items-center gap-1.5 normal-case font-normal text-ink">
                      <input
                        type="checkbox"
                        checked={exp.period.isCurrent}
                        onChange={() => toggleCurrent(exp.id)}
                      />
                      Current role
                    </span>
                  </label>
                  <input
                    type="month"
                    className="input"
                    disabled={exp.period.isCurrent}
                    value={exp.period.endDate ?? ""}
                    onChange={(e) => updateDate(exp.id, "endDate", e.target.value)}
                  />
                </div>
              </div>
              {exp.needsReview && (
                <p className="text-xs text-signal-amber font-medium">
                  This role needs review — confirm the title/employer above.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl mb-4">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {initialProfile.skills.length === 0 && <p className="text-sm text-slate">No skills extracted yet.</p>}
          {initialProfile.skills.map((skill) => (
            <div key={skill.skillName} className="card !p-3 flex items-center gap-2">
              <span className="text-sm font-medium">{skill.skillName}</span>
              <EvidenceChip
                confidence={skill.confidence}
                label={skill.yearsOfExperience != null ? `${skill.yearsOfExperience}y` : undefined}
              />
            </div>
          ))}
        </div>
      </section>

      {initialProfile.careerStrength && (
        <section className="card">
          <p className="label">Career Strength</p>
          <p className="font-display text-4xl mb-4">{initialProfile.careerStrength.score}/95</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-4">
            {Object.entries(initialProfile.careerStrength.breakdown).map(([key, value]) => (
              <div key={key}>
                <p className="text-slate-light text-xs uppercase tracking-wide">
                  {key.replace(/([A-Z])/g, " $1")}
                </p>
                <p className="font-mono">{value}</p>
              </div>
            ))}
          </div>
          {initialProfile.careerStrength.reasoning.length > 0 && (
            <ul className="text-sm text-slate space-y-1">
              {initialProfile.careerStrength.reasoning.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-3 sticky bottom-6">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save corrections"}
        </button>
        {saved && <span className="text-sm text-signal-green">Saved</span>}
        <button onClick={() => router.push("/preferences")} className="btn-secondary ml-auto">
          Continue to preferences →
        </button>
      </div>
    </div>
  );
}
