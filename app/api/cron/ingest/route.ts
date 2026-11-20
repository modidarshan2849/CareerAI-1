import { logApiUsage } from "@/lib/usageTelemetry";
import { aggregateUniversalDirectJobs, VerifiedJobPosting } from "@/lib/universalAtsEngine";

export const dynamic = "force-dynamic";

async function generateGeminiEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: text.slice(0, 5000) }] },
      }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.embedding?.values || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized cron trigger" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const { searchParams } = new URL(req.url);
  const fullSweep = searchParams.get("full") === "true";
  const sweepQueries = fullSweep
    ? ["Data Analyst", "Business Intelligence", "Analytics Engineer", "Product Manager", "Software Engineer"]
    : ["Data Analyst", "Business Intelligence", "Analytics Engineer"];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => {
        console.log(msg);
        controller.enqueue(encoder.encode(msg + "\n"));
      };

      const startedAt = Date.now();
      send(`[1/4] Connected. Starting ${sweepQueries.length}-track Fortune 500 & offsite ATS sweep...`);

      const allVerified = new Map<string, VerifiedJobPosting>();
      let totalRejectedDead = 0;
      let totalNetNewAggregators = 0;

      for (const q of sweepQueries) {
        send(`[1/4] Scanning & validating track: "${q}"...`);
        const { jobs, audit } = await aggregateUniversalDirectJobs(
          { query: q, skills: [], location: "US", includeAggregators: true },
          { verifyLiveUrls: true }
        );
        totalRejectedDead += audit.rejectedInactiveOrDeadUrl;
        totalNetNewAggregators += audit.netNewFromLinkedInOrIndeed;
        jobs.forEach((j) => {
          const key = `${j.canonicalCompany}::${j.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
          if (!allVerified.has(key)) allVerified.set(key, j);
        });
        send(`      -> "${q}" done: ${jobs.length} verified open, ${audit.rejectedInactiveOrDeadUrl} dead rejected.`);
      }

      const uniqueJobs = Array.from(allVerified.values());
      const nowIso = new Date().toISOString();
      send(`[2/4] Deduplicated total: ${uniqueJobs.length} active roles. Generating embeddings...`);

      const rows: any[] = [];
      const embedChunkSize = 25;
      for (let i = 0; i < uniqueJobs.length; i += embedChunkSize) {
        const slice = uniqueJobs.slice(i, i + embedChunkSize);
        const built = await Promise.all(
          slice.map(async (job) => {
            const dedupKey = `${job.canonicalCompany}::${job.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
            const embedding = geminiKey
              ? await generateGeminiEmbedding(`${job.title} at ${job.company}. ${job.description}`, geminiKey)
              : null;

            return {
              dedup_key: dedupKey,
              requisition_id: job.requisitionId,
              title: job.title,
              company: job.company,
              canonical_company: job.canonicalCompany,
              ats_platform: job.atsPlatform,
              location: job.location,
              is_remote: job.isRemote,
              apply_url: job.applyUrl,
              verification_method: job.verificationMethod,
              description: job.description,
              visa_sponsorship: job.visaSponsorship,
              clearance_required: job.clearanceOrCitizenRequired,
              status: "ACTIVE",
              last_verified_at: nowIso,
              ...(embedding ? { embedding } : {}),
            };
          })
        );
        rows.push(...built);
      }

      send(`[3/4] Upserting ${rows.length} rows into Supabase...");
        await logApiUsage({ provider: "gemini", endpoint: "embeddings-batch", unitsUsed: 1.5, unitType: "tokens" });
      const upsertBatchSize = 200;
      for (let i = 0; i < rows.length; i += upsertBatchSize) {
        const batch = rows.slice(i, i + upsertBatchSize);
        const upsertRes = await fetch(`${supabaseUrl}/rest/v1/verified_requisitions?on_conflict=dedup_key`, {
          method: "POST",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify(batch),
        });

        if (!upsertRes.ok) {
          const errText = await upsertRes.text();
          send(`[ERROR] Supabase upsert failed: ${errText}`);
          controller.close();
          return;
        }
      }

      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      await fetch(
        `${supabaseUrl}/rest/v1/verified_requisitions?status=eq.ACTIVE&last_verified_at=lt.${encodeURIComponent(sixHoursAgo)}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "CLOSED" }),
        }
      );

      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      send(
        `[4/4] COMPLETE in ${durationSeconds}s: ${JSON.stringify({
          success: true,
          upsertedActiveCount: rows.length,
          netNewFromLinkedInOrIndeed: totalNetNewAggregators,
          rejectedDeadLinksCount: totalRejectedDead,
          durationSeconds,
          timestamp: nowIso,
        })}`
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
