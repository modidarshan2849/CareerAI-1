import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeGoogleJob, type GoogleJobRaw } from "@/lib/careerai/googleJobsFeed";

interface TrackedCompanyRow {
  id: string;
  company_name: string;
  slug: string;
  cohort: string;
  career_url: string;
  ats_provider: string;
  ats_endpoint_config: Record<string, string> | null;
  sync_status: string;
}

interface IncomingJob {
  job_id: string;
  source_company: string;
  canonical_job_id: string | null;
  title: string;
  apply_url: string | null;
}

interface CompanySyncResult {
  company: string;
  slug: string;
  mode: "live_sync" | "withdrawal_sweep";
  fetched: number;
  withdrawnFlagged: number;
  status: "healthy" | "pending" | "error";
  error?: string;
}

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
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${expectedSecret}`;
}

async function fetchGreenhouseJobs(company: TrackedCompanyRow): Promise<IncomingJob[]> {
  const token = company.ats_endpoint_config?.boardToken?.trim();
  if (!token) {
    throw new Error(`Missing boardToken in ats_endpoint_config for ${company.company_name}`);
  }

  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Greenhouse HTTP ${res.status} for ${company.company_name}`);
  }

  const data = (await res.json()) as {
    jobs?: Array<{ id: number | string; title?: string; absolute_url?: string }>;
  };

  return (data.jobs ?? [])
    .filter((j) => Boolean(j.title))
    .map((j) => ({
      job_id: `gh:${token}:${j.id}`,
      source_company: company.company_name,
      canonical_job_id: String(j.id),
      title: String(j.title).trim(),
      apply_url: j.absolute_url ?? company.career_url,
    }));
}

async function fetchLeverJobs(company: TrackedCompanyRow): Promise<IncomingJob[]> {
  const slug = company.ats_endpoint_config?.companySlug?.trim();
  if (!slug) {
    throw new Error(`Missing companySlug in ats_endpoint_config for ${company.company_name}`);
  }

  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Lever HTTP ${res.status} for ${company.company_name}`);
  }

  const postings = (await res.json()) as Array<{
    id?: string;
    text?: string;
    hostedUrl?: string;
    applyUrl?: string;
  }>;

  return (Array.isArray(postings) ? postings : [])
    .filter((p) => Boolean(p.id && p.text))
    .map((p) => ({
      job_id: `lever:${slug}:${p.id}`,
      source_company: company.company_name,
      canonical_job_id: String(p.id),
      title: String(p.text).trim(),
      apply_url: p.applyUrl || p.hostedUrl || company.career_url,
    }));
}

async function fetchGoogleJobsForCompany(
  company: TrackedCompanyRow
): Promise<{ jobs: IncomingJob[]; configured: boolean }> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return { jobs: [], configured: false };
  }

  const q = `${company.company_name} analyst OR data OR finance jobs`;
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", q);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    throw new Error(`Google Jobs HTTP ${res.status} for ${company.company_name}`);
  }

  const payload = (await res.json()) as { jobs_results?: GoogleJobRaw[] };
  const normalized = (payload.jobs_results ?? [])
    .map((raw) => normalizeGoogleJob(raw, company.company_name))
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { jobs: normalized, configured: true };
}

async function fetchJobsForCompany(
  company: TrackedCompanyRow
): Promise<{ jobs: IncomingJob[]; configured: boolean }> {
  if (company.ats_provider === "greenhouse") {
    return { jobs: await fetchGreenhouseJobs(company), configured: true };
  }
  if (company.ats_provider === "lever") {
    return { jobs: await fetchLeverJobs(company), configured: true };
  }
  return fetchGoogleJobsForCompany(company);
}

async function runSync(
  req: Request,
  bodyOverride?: { mode?: string; limit?: number; slug?: string }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const url = new URL(req.url);

    const rawMode = bodyOverride?.mode ?? url.searchParams.get("mode") ?? "live_sync";
    const mode: "live_sync" | "withdrawal_sweep" =
      rawMode === "withdrawal_sweep" ? "withdrawal_sweep" : "live_sync";

    const rawLimit = bodyOverride?.limit ?? Number(url.searchParams.get("limit") ?? "8");
    const batchSize = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 8, 1), 25);
    const slugFilter = (bodyOverride?.slug ?? url.searchParams.get("slug") ?? "").trim();

    let query = supabase
      .from("tracked_companies")
      .select("id, company_name, slug, cohort, career_url, ats_provider, ats_endpoint_config, sync_status")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (slugFilter) {
      query = query.eq("slug", slugFilter);
    }

    const { data: companies, error: compError } = await query;
    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 500 });
    }

    const summary: CompanySyncResult[] = [];

    for (const company of (companies ?? []) as TrackedCompanyRow[]) {
      try {
        const { jobs: incoming, configured } = await fetchJobsForCompany(company);

        if (!configured) {
          summary.push({
            company: company.company_name,
            slug: company.slug,
            mode,
            fetched: 0,
            withdrawnFlagged: 0,
            status: "pending",
            error: "SERPAPI_KEY not set for Google Jobs fallback connector",
          });
          continue;
        }

        if (incoming.length > 0) {
          // Deduplicate within batch by job_id to prevent Postgres "ON CONFLICT DO UPDATE command cannot affect row a second time"
          const dedupedMap = new Map<string, IncomingJob>();
          for (const item of incoming) {
            dedupedMap.set(item.job_id, item);
          }
          const dedupedIncoming = Array.from(dedupedMap.values());

          const rowsToUpsert = dedupedIncoming.map((job) => ({
            job_id: job.job_id,
            source_company: job.source_company,
            canonical_job_id: job.canonical_job_id,
            title: job.title,
            apply_url: job.apply_url,
            withdrawn_at: null,
          }));

          const { error: upsertError } = await supabase
            .from("enterprise_jobs")
            .upsert(rowsToUpsert, { onConflict: "job_id" });

          if (upsertError) {
            throw new Error(upsertError.message);
          }
        }

        let withdrawnFlagged = 0;

        if (mode === "withdrawal_sweep" && incoming.length > 0) {
          const activeIds = new Set(incoming.map((j) => j.job_id));
          const { data: existingActive, error: existingErr } = await supabase
            .from("enterprise_jobs")
            .select("job_id")
            .eq("source_company", company.company_name)
            .is("withdrawn_at", null);

          if (existingErr) {
            throw new Error(existingErr.message);
          }

          const staleIds = (existingActive ?? [])
            .map((r) => r.job_id)
            .filter((id) => !activeIds.has(id));

          if (staleIds.length > 0) {
            const { error: markErr } = await supabase
              .from("enterprise_jobs")
              .update({ withdrawn_at: new Date().toISOString() })
              .in("job_id", staleIds);

            if (markErr) {
              throw new Error(markErr.message);
            }
            withdrawnFlagged = staleIds.length;
          }
        }

        const syncedAt = new Date().toISOString();
        await supabase
          .from("tracked_companies")
          .update({
            sync_status: "healthy",
            last_synced_at: syncedAt,
          })
          .eq("id", company.id);

        summary.push({
          company: company.company_name,
          slug: company.slug,
          mode,
          fetched: incoming.length,
          withdrawnFlagged,
          status: "healthy",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sync failed";
        await supabase
          .from("tracked_companies")
          .update({ sync_status: "error" })
          .eq("id", company.id);

        summary.push({
          company: company.company_name,
          slug: company.slug,
          mode,
          fetched: 0,
          withdrawnFlagged: 0,
          status: "error",
          error: msg,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      processed: summary.length,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Worker error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return runSync(req);
}

export async function POST(req: Request) {
  let body: { mode?: string; limit?: number; slug?: string } | undefined;
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }
  return runSync(req, body);
}
