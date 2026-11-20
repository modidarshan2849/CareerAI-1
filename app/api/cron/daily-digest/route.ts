import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateJobForScenario, type UserScenario } from "@/lib/careerai/scenarioFilter";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorized(req: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return true;
  return req.headers.get("authorization") === `Bearer ${expectedSecret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: scenarios, error: scenErr } = await supabase
      .from("user_scenarios")
      .select("*")
      .eq("is_active", true);

    if (scenErr) {
      return NextResponse.json({ error: scenErr.message }, { status: 500 });
    }

    const { data: recentJobs, error: jobsErr } = await supabase
      .from("enterprise_jobs")
      .select("job_id, source_company, title, apply_url, description, location, withdrawn_at, created_at")
      .is("withdrawn_at", null)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(150);

    if (jobsErr) {
      return NextResponse.json({ error: jobsErr.message }, { status: 500 });
    }

    const digestItems = ((scenarios ?? []) as Array<UserScenario & { user_id?: string }>).map((scenario) => {
      const highSignal = (recentJobs ?? [])
        .map((job) => ({
          job,
          evalResult: evaluateJobForScenario(job, scenario),
        }))
        .filter(
          ({ evalResult }) =>
            !evalResult.isWithdrawn &&
            evalResult.redFlags.length === 0 &&
            evalResult.titleMatches
        )
        .slice(0, 15)
        .map(({ job }) => ({
          job_id: job.job_id,
          company: job.source_company,
          title: job.title,
          location: job.location ?? "Not specified",
          apply_url: job.apply_url,
        }));

      return {
        user_id: scenario.user_id ?? null,
        scenario_id: scenario.id,
        scenario_name: scenario.scenario_name,
        match_count: highSignal.length,
        matches: highSignal,
      };
    });

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.DIGEST_FROM_EMAIL;
    let emailsSent = 0;

    if (resendKey && fromEmail) {
      for (const entry of digestItems) {
        if (entry.matches.length === 0) continue;
        const userId = entry.user_id;
        if (!userId) continue;
        const { data: userLookup } = await supabase.auth.admin.getUserById(userId);
        const toEmail = userLookup?.user?.email;
        if (!toEmail) continue;

        const textBody = [
          `CareerAI-1 Daily High-Signal Digest (${entry.scenario_name})`,
          `Found ${entry.matches.length} active, clean matches in the last 24h:`,
          "",
          ...entry.matches.map(
            (m, idx) =>
              `${idx + 1}. ${m.title ?? "Role"} — ${m.company} (${m.location})\n   Apply: ${m.apply_url ?? "N/A"}`
          ),
        ].join("\n");

        const mailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            subject: `CareerAI-1: ${entry.matches.length} high-signal roles for ${entry.scenario_name}`,
            text: textBody,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (mailRes.ok) {
          emailsSent += 1;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      windowHours: 24,
      emailsSent,
      digestItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Digest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
