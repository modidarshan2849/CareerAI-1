import { Nav } from "@/components/Nav";
import { StatusPill } from "@/components/StatusPill";
import { createClient } from "@/lib/supabase/server";
import { getFullProfile } from "@/lib/data";
import { calculateMatch } from "@/lib/matching";
import { JobPosting } from "@/lib/types";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function MatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) /* bypassed login redirect */;

  const profile = await getFullProfile(user.id);
  const { data: jobRows } = await supabase.from("jobs").select("*").eq("is_open", true);

  const jobs: JobPosting[] = (jobRows ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    employer: row.employer,
    location: row.location,
    remote: row.remote,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    requiresSponsorship: row.requires_sponsorship,
    requirements: row.requirements ?? [],
    isOpen: row.is_open,
  }));

  const profileForMatching = {
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
  };

  const results = jobs
    .map((job) => ({ job, match: calculateMatch(job, profileForMatching) }))
    .filter((r) => r.match.status !== "RED") // section 11: don't pad results with excluded jobs
    .sort((a, b) => b.match.overallFit - a.match.overallFit);

  return (
    <div className="min-h-screen">
      <Nav active="/matches" />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl mb-2">Your matches</h1>
        <p className="text-slate mb-8">
          {jobs.length === 0
            ? "No jobs are loaded yet — the live job engine is a Phase 2 feature. This screen works against whatever is in the jobs table."
            : `${results.length} of ${jobs.length} open jobs are worth your attention.`}
        </p>

        <div className="space-y-4">
          {results.map(({ job, match }) => (
            <Link
              key={job.id}
              href={`/matches/${job.id}`}
              className="card flex items-center justify-between gap-4 hover:border-verdigris/40 transition-colors"
            >
              <div>
                <p className="font-medium">{job.title}</p>
                <p className="text-sm text-slate">
                  {job.employer} {job.location ? `· ${job.location}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-sm text-slate">{match.overallFit}</span>
                <StatusPill status={match.status} />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
