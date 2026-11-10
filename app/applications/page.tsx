import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "applied", label: "Applied", color: "border-blue-500 bg-blue-50/40 text-blue-700" },
  { key: "screen", label: "Recruiter Screen", color: "border-indigo-500 bg-indigo-50/40 text-indigo-700" },
  { key: "technical", label: "Technical Screen", color: "border-amber-500 bg-amber-50/40 text-amber-700" },
  { key: "final_round", label: "Final Round", color: "border-purple-500 bg-purple-50/40 text-purple-700" },
  { key: "offer", label: "Offer Received", color: "border-emerald-500 bg-emerald-50/40 text-emerald-700" },
];

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: applications } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("last_interaction_date", { ascending: false });

  const allApps = applications || [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Nav active="/applications" />

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Active Application Pipeline</h1>
            <p className="text-xs text-slate-500 mt-1">
              Track in-flight applications. Roles automatically drop out of your search feed once submitted.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold shadow-sm"
          >
            ← Back to Matches Feed
          </Link>
        </div>

        {/* Kanban Columns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          {STAGES.map((col) => {
            const stageApps = allApps.filter((a) => a.stage === col.key);

            return (
              <div key={col.key} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {col.label}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                    {stageApps.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {stageApps.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-6 text-center italic">No roles</p>
                  ) : (
                    stageApps.map((app) => (
                      <div
                        key={app.id}
                        className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl space-y-2 shadow-sm"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                            {app.job_title}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">{app.company_name}</p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-zinc-200/60 dark:border-zinc-700/40">
                          <span>Applied: {new Date(app.applied_date).toLocaleDateString()}</span>
                          {app.source_url && (
                            <a
                              href={app.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                            >
                              Portal ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
