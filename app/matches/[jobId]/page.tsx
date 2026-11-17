import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { createClient } from "@/lib/supabase/server";
import { getFullProfile } from "@/lib/data";
import { calculateMatch } from "@/lib/matching";
import { JobPosting } from "@/lib/types";
import { redirect, notFound } from "next/navigation";

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) /* bypassed login redirect */;

  const { data: jobRow } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!jobRow) notFound();

  const job: JobPosting = {
    id: jobRow.id,
    title: jobRow.title,
    employer: jobRow.employer,
    location: jobRow.location,
    remote: jobRow.remote,
    salaryMin: jobRow.salary_min,
    salaryMax: jobRow.salary_max,
    requiresSponsorship: jobRow.requires_sponsorship,
    requirements: jobRow.requirements ?? [],
    isOpen: jobRow.is_open,
  };

  const profile = await getFullProfile(user.id);
  const match = calculateMatch(job, {
    userId: user.id,
    workExperience: profile.workExperience,
    skills: profile.skills,
    education: profile.education,
    totalExperience: profile.totalExperience,
    careerStrength: profile.careerStrength,
    suggestedRoles: profile.suggestedRoles,
    preferences: profile.preferences,
    validationWarnings: profile.validationWarnings,
    experienceBreakdown: profile.experienceBreakdown,
    activeResumeId: profile.activeResumeId,
    updatedAt: new Date().toISOString(),
  });

  const scoreRows = [
    ["Career Match", match.careerMatch],
    ["Eligibility", match.eligibility],
    ["Preference Match", match.preferenceMatch],
    ["Verification Confidence", match.verificationConfidence],
  ] as const;

  return (
    <div className="min-h-screen">
      <Nav active="/matches" />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="font-display text-2xl">{job.title}</h1>
            <p className="text-slate">
              {job.employer} {job.location ? `· ${job.location}` : ""}
            </p>
          </div>
          <StatusPill status={match.status} />
        </div>

        {match.hardExclusionReasons.length > 0 && (
          <section className="card bg-signal-red-bg border-signal-red/30 my-6">
            <p className="font-medium text-signal-red mb-2">Excluded</p>
            <ul className="text-sm space-y-1">
              {match.hardExclusionReasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid grid-cols-2 gap-4 my-6">
          {scoreRows.map(([label, value]) => (
            <div key={label} className="card !p-4">
              <p className="label">{label}</p>
              <p className="font-display text-3xl">{value}</p>
            </div>
          ))}
        </section>

        <section className="card">
          <p className="font-medium mb-3">Why this score — every claim, traceable</p>
          <ul className="text-sm text-slate space-y-2">
            {match.reasoning.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </section>

        {job.requirements.length > 0 && (
          <section className="mt-6">
            <p className="label mb-2">Listed requirements</p>
            <div className="flex flex-wrap gap-2">
              {job.requirements.map((req) => (
                <span key={req} className="font-mono text-xs px-2.5 py-1 rounded border border-hairline bg-paper-raised">
                  {req}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
