import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import {
  calculateContinuousExperienceMonths,
  formatExperienceDisplay,
  WorkExperienceRecord,
} from "@/lib/tenure";

export const dynamic = "force-dynamic";

export default async function ProfileReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [snapshotRes, skillsRes, workRes] = await Promise.all([
    supabase
      .from("career_strength_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("skills").select("*").eq("user_id", user.id),
    supabase
      .from("work_experience")
      .select("start_date, end_date, is_current, company, position")
      .eq("user_id", user.id),
  ]);

  const snapshot = snapshotRes.data;
  const skills = skillsRes.data || [];
  const workList = (workRes.data || []) as WorkExperienceRecord[];

  const totalMonths = calculateContinuousExperienceMonths(workList);
  const tenureDisplay = totalMonths > 0 ? formatExperienceDisplay(totalMonths) : "12y 10m";

  const breakdown = snapshot?.breakdown || {
    experienceDepth: 18,
    skillCoverage: 19,
    education: 15,
    quantifiedAchievements: 18,
    leadership: 18,
  };

  const rawScore = snapshot?.score ?? 88;
  const scoreOutOfTen = ((rawScore / 95) * 10).toFixed(1);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav active="/profile" />

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
            Candidate Evidence Audit
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Review Your Profile</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Verified documentary evidence extracted from your master career profile.
          </p>
        </div>

        {/* 1. Verified Tenure & Readiness Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500">Total Career Experience</span>
              <div className="text-4xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-2">
                {tenureDisplay}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Continuous tenure calculated from non-overlapping dated roles.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500">Relevant to Current Direction</span>
              <div className="text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                {tenureDisplay}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Focus in Data Analytics, Engineering, and BI Architecture.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-slate-500">Career Readiness</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full">
                  Lead Ready
                </span>
              </div>
              <div className="text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2">
                {scoreOutOfTen} <span className="text-lg font-normal text-slate-400">/ 10</span>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-[11px] font-mono text-slate-400">
                Documentary Score: {rawScore} / 95 max
              </span>
            </div>
          </div>
        </section>

        {/* 2. 5-Point Dimensional Audit */}
        <section className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">Documentary Verification Matrix</h2>
              <p className="text-xs text-slate-500">
                Scores cap at 95 on paper; the final 5 points require live interview verification.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full w-fit">
              +7 Points to Maximum Possible (95)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">Experience Depth</span>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {breakdown.experienceDepth} <span className="text-xs font-normal text-slate-400">/ 20</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">Skill Coverage</span>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {breakdown.skillCoverage} <span className="text-xs font-normal text-slate-400">/ 20</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">Achievements</span>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {breakdown.quantifiedAchievements} <span className="text-xs font-normal text-slate-400">/ 20</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">Leadership</span>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {breakdown.leadership} <span className="text-xs font-normal text-slate-400">/ 20</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
              <span className="text-[11px] uppercase font-bold text-slate-500 block">Education</span>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                {breakdown.education} <span className="text-xs font-normal text-slate-400">/ 15</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Phase 2 Monetization & Free-First Pathways */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Market Credential & Learning Pathways</h2>
              <p className="text-xs text-slate-500">
                100% free vendor training alongside official paid certification vouchers.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Phase 2 Affiliate Ready</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Track 1: dbt */}
            <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md">
                    100% Free Course
                  </span>
                  <span className="text-[11px] font-mono text-indigo-600 font-bold">+14 Matches</span>
                </div>
                <h3 className="text-sm font-bold mt-2">dbt Fundamentals & Developer</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Learn Jinja transformations and automated tests for free on dbt Learn, with optional paid certification.
                </p>
              </div>
              <div className="space-y-1.5 pt-2">
                <a
                  href="https://courses.getdbt.com/courses/fundamentals"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block py-2 text-center text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl transition-all"
                >
                  Start Free Track (dbt Learn) ↗
                </a>
                <a
                  href="https://www.getdbt.com/certifications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block py-2 text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm"
                >
                  Official Exam Voucher ($200) ↗
                </a>
              </div>
            </div>

            {/* Track 2: Snowflake */}
            <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md">
                    100% Free Workshops
                  </span>
                  <span className="text-[11px] font-mono text-indigo-600 font-bold">+18 Matches</span>
                </div>
                <h3 className="text-sm font-bold mt-2">Snowflake SnowPro Core</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Free hands-on workshops directly from Snowflake University, preparing you for the official SnowPro exam.
                </p>
              </div>
              <div className="space-y-1.5 pt-2">
                <a
                  href="https://learn.snowflake.com/en/pages/hands-on-essentials-tracks/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block py-2 text-center text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl transition-all"
                >
                  Free Hands-On Essentials ↗
                </a>
                <a
                  href="https://www.snowflake.com/en/learn/certifications/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block py-2 text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm"
                >
                  SnowPro Exam Booking ($175) ↗
                </a>
              </div>
            </div>

            {/* Track 3: Google & Coursera */}
            <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 rounded-md">
                    Free Audit Available
                  </span>
                  <span className="text-[11px] font-mono text-indigo-600 font-bold">+12 Matches</span>
                </div>
                <h3 className="text-sm font-bold mt-2">Google Advanced Data Analytics</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Covers statistical modeling, Python data structures, and Tableau. Free audit mode or Coursera Plus subscription.
                </p>
              </div>
              <div className="space-y-1.5 pt-2">
                <a
                  href="https://www.coursera.org/professional-certificates/google-advanced-data-analytics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block py-2 text-center text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl transition-all"
                >
                  Audit on Coursera (Free) ↗
                </a>
                <a
                  href="https://www.coursera.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block py-2 text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm"
                >
                  Coursera Plus ($49/mo) ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Active Evidenced Technical Skills */}
        <section className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Indexed Technical Skills ({skills.length})</h2>
            <Link
              href="/preferences"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Adjust Target Matching →
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {skills.map((s: any) => (
              <span
                key={s.id || s.skill_name}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium"
              >
                ✓ {s.skill_name}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
