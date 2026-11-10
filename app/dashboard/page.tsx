import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { CandidatePreferences, RawDbJob } from "@/lib/jobMatching";
import {
  calculateContinuousExperienceMonths,
  formatExperienceDisplay,
  WorkExperienceRecord,
} from "@/lib/tenure";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

const VALID_VISA_STATUSES = [
  "US_Citizen",
  "Green_Card",
  "EAD_OPT",
  "H1B_Transfer",
  "Requires_Sponsorship",
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffIso = thirtyDaysAgo.toISOString();

  const [snapshotRes, skillsRes, prefsRes, jobsRes, interactionsRes, workRes] = await Promise.all([
    supabase
      .from("career_strength_snapshots")
      .select("score, breakdown, strengths, gaps, computed_at")
      .eq("user_id", user.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("skills").select("skill_name").eq("user_id", user.id),
    supabase
      .from("user_preferences")
      .select(
        "target_titles, work_modes, min_salary, target_locations, requires_sponsorship, citizenship_status, preferred_industries, experience_years, max_commute_miles"
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("*")
      .eq("is_active", true)
      .gte("posted_at", cutoffIso)
      .order("posted_at", { ascending: false })
      .limit(200),
    supabase.from("job_interactions").select("job_id, status").eq("user_id", user.id),
    supabase
      .from("work_experience")
      .select("start_date, end_date, is_current, company, position")
      .eq("user_id", user.id),
  ]);

  const snapshot = snapshotRes.data;
  const userSkills: string[] = (skillsRes.data || []).map((s: { skill_name: string }) => s.skill_name);
  const prefs = prefsRes.data;
  const allJobs = (jobsRes.data || []) as RawDbJob[];
  const workList = (workRes.data || []) as WorkExperienceRecord[];

  const totalMonths = calculateContinuousExperienceMonths(workList);
  const tenureDisplay = totalMonths > 0 ? formatExperienceDisplay(totalMonths) : "10y 5m";

  const interactionMap: Record<string, "saved" | "applied" | "hidden"> = {};
  (interactionsRes.data || []).forEach((row: { job_id: string; status: "saved" | "applied" | "hidden" }) => {
    interactionMap[row.job_id] = row.status;
  });

  const defaultSkills: string[] = [
    "SQL",
    "Snowflake",
    "Python",
    "ETL",
    "Data Modeling",
    "Data Warehousing",
    "dbt",
    "Tableau",
    "Power BI",
    "Qlik Sense",
    "Business Intelligence",
    "AWS",
  ];

  const parsedVisa =
    prefs?.citizenship_status &&
    (VALID_VISA_STATUSES as readonly string[]).includes(prefs.citizenship_status)
      ? (prefs.citizenship_status as CandidatePreferences["citizenshipStatus"])
      : "US_Citizen";

  const candidateContext: CandidatePreferences = {
    targetTitles: prefs?.target_titles ?? ["Senior Data Analyst", "Lead Data Analyst"],
    workModes: prefs?.work_modes ?? ["remote", "hybrid"],
    minSalary: prefs?.min_salary ?? 120000,
    citizenshipStatus: parsedVisa,
    requiresSponsorship: Boolean(prefs?.requires_sponsorship),
    totalExperienceYears: Math.max(8, Math.floor(totalMonths / 12)),
    preferredIndustries: prefs?.preferred_industries ?? [],
    homeCity: (prefs?.target_locations?.[0] || "Virginia Beach").split(",")[0].trim(),
    homeState: "VA",
    maxCommuteMiles: prefs?.max_commute_miles ?? 50,
  };

  const readinessScoreNumber =
    typeof snapshot?.score === "number" ? snapshot.score : 88;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav active="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <DashboardClient
          rawJobs={allJobs}
          candidateSkills={userSkills.length > 0 ? userSkills : defaultSkills}
          basePreferences={candidateContext}
          readinessScore={readinessScoreNumber}
          activeSkillCount={userSkills.length > 0 ? userSkills.length : 12}
          homeLocation={prefs?.target_locations?.[0] || "Virginia Beach, VA"}
          totalTenureDisplay={tenureDisplay}
          initialInteractions={interactionMap}
        />
      </main>
    </div>
  );
}
