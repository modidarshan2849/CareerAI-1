import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateJobUrl } from "@/lib/linkValidator";
import { logApiUsage } from "@/lib/usageTelemetry";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const NON_US_REGEX =
  /\b(india|hyderabad|bengaluru|bangalore|pune|chennai|mumbai|telangana|malaysia|penang|netherlands|united kingdom|london|canada|toronto|poland|philippines|manila|singapore|germany|wiesbaden)\b/i;

const EXCLUDE_TITLE_REGEX = /\b(intern|internship|co-op|coop)\b/i;

interface CandidateJob {
  req_id: string | null;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  is_remote: boolean;
  work_mode: string;
  zone: string;
  sponsorship_status: string;
  sponsorship_code: string;
  posted_label: string;
  keywords: string[];
  source: string;
  description: string;
}

function normalizePair(company: string, title: string): string {
  return `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}::${title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;
}

function extractReqId(url: string): string | null {
  const spg = url.match(/\/jobs\/(\d+)/);
  if (spg) return `SPG-${spg[1]}`;
  const jk = url.match(/[?&]jk=([a-z0-9]+)/i);
  if (jk) return `IND-${jk[1]}`;
  const wd = url.match(/_([A-Z0-9-]{4,20})(?:[/?#]|$)/);
  if (wd) return wd[1];
  const li = url.match(/-(\d{8,12})(?:[/?#]|$)/);
  if (li) return `LI-${li[1]}`;
  const usa = url.match(/\/job\/(\d+)/);
  if (usa) return `USA-${usa[1]}`;
  return null;
}

function extractKeywords(text: string): string[] {
  const dict = ["SQL", "Snowflake", "Python", "Power BI", "Tableau", "Excel", "ETL", "AWS", "BI", "Analytics"];
  const lower = text.toLowerCase();
  return dict.filter((k) => lower.includes(k.toLowerCase()));
}

function inferZoneAndMode(text: string): { zone: string; is_remote: boolean; work_mode: string } {
  const lower = text.toLowerCase();
  const isRemote = /\bremote\b/.test(lower);
  const isVaDmv =
    /\b(virginia|va|richmond|mclean|arlington|reston|norfolk|virginia beach|dc|washington|maryland|md|bethesda)\b/.test(
      lower
    );
  return {
    zone: isVaDmv ? "VA_DMV" : isRemote ? "REMOTE" : "US_NATIONAL",
    is_remote: isRemote,
    work_mode: isRemote ? "Remote" : "Hybrid",
  };
}

function computeInitialScore(title: string, company: string, location: string): number {
  let score = 84;
  const hay = `${title} ${company} ${location}`.toLowerCase();
  if (/senior|lead|principal|staff|manager/.test(hay)) score += 6;
  if (/snowflake|sql|bi|analytics|financial/.test(hay)) score += 4;
  if (/s&p global|synchrony|capital one|dominion|carmax|freddie mac|fannie mae|leidos|geico/.test(hay)) score += 3;
  if (/virginia|mclean|richmond|arlington|remote/.test(hay)) score += 2;
  return Math.min(98, score);
}

async function fetchSerperBatch(
  label: string,
  companyFallback: string,
  query: string,
  urlFilter: RegExp
): Promise<CandidateJob[]> {
  const key = (process.env.SERPER_API_KEY || "").trim();
  if (!key) return [];
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(6000),
    });
    await logApiUsage({
      provider: "serper",
      endpoint: "/search",
      unitsUsed: 1,
      unitType: "search",
      statusCode: res.status,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: CandidateJob[] = [];
    for (const r of data.organic || []) {
      const link = String(r.link || "").trim();
      const rawTitle = String(r.title || "").replace(/\s*[-|].*$/, "").trim();
      const snippet = String(r.snippet || "");
      const combined = `${rawTitle} ${snippet} ${link}`;
      if (!urlFilter.test(link)) continue;
      if (NON_US_REGEX.test(combined) || EXCLUDE_TITLE_REGEX.test(rawTitle)) continue;

      let company = companyFallback;
      if (company === "Workday Enterprise") {
        const hostMatch = link.match(/^https?:\/\/([^.]+)\.wd\d+\.myworkdayjobs\.com/i);
        if (hostMatch) {
          company = hostMatch[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        }
      }

      const locMatch = combined.match(
        /\b(New York, NY|McLean, VA|Richmond, VA|Charlotte, NC|Stamford, CT|Virginia|Remote|United States)\b/i
      );
      const location = locMatch ? locMatch[0] : "United States";
      const meta = inferZoneAndMode(`${rawTitle} ${snippet} ${location}`);

      results.push({
        req_id: extractReqId(link),
        title: rawTitle,
        company,
        location,
        url: link,
        score: computeInitialScore(rawTitle, company, location),
        is_remote: meta.is_remote,
        work_mode: meta.work_mode,
        zone: meta.zone,
        sponsorship_status: "Not Specified",
        sponsorship_code: "NOT_SPECIFIED",
        posted_label: String(r.date || "Live Sync"),
        keywords: extractKeywords(`${rawTitle} ${snippet}`),
        source: label,
        description: snippet,
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchLinkedInGuest24h(keywords: string): Promise<CandidateJob[]> {
  try {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
      keywords
    )}&location=United%20States&f_TPR=r86400&start=0`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const jobs: CandidateJob[] = [];
    for (const [block] of html.matchAll(/<li[\s\S]*?<\/li>/g)) {
      const title = (block.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/)?.[1] || "")
        .replace(/&amp;/g, "&")
        .trim();
      const company = (block.match(/class="hidden-nested-link"[^>]*>([\s\S]*?)<\/a>/)?.[1] || "")
        .replace(/&amp;/g, "&")
        .trim();
      const location = (block.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "").trim();
      const link = (block.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/)?.[1] || "").trim();
      if (!title || !link) continue;
      if (NON_US_REGEX.test(`${title} ${location}`) || EXCLUDE_TITLE_REGEX.test(title)) continue;
      const meta = inferZoneAndMode(`${title} ${location}`);
      const cleanCompany = company || "LinkedIn Employer";
      jobs.push({
        req_id: extractReqId(link),
        title,
        company: cleanCompany,
        location: location || "United States",
        url: link,
        score: computeInitialScore(title, cleanCompany, location),
        is_remote: meta.is_remote,
        work_mode: meta.work_mode,
        zone: meta.zone,
        sponsorship_status: "Not Specified",
        sponsorship_code: "NOT_SPECIFIED",
        posted_label: "Past 24h",
        keywords: extractKeywords(title),
        source: "LinkedIn Live",
        description: `${title} at ${cleanCompany} (${location})`,
      });
    }
    return jobs;
  } catch {
    return [];
  }
}

async function fetchUsajobsLive(): Promise<CandidateJob[]> {
  const apiKey = (process.env.USAJOBS_API_KEY || "").trim();
  const ua = (process.env.USAJOBS_USER_AGENT || "modi.darshan268@gmail.com").trim();
  if (!apiKey) return [];
  try {
    const res = await fetch(
      "https://data.usajobs.gov/api/search?Keyword=Data%20Analyst&ResultsPerPage=15",
      {
        headers: { "Authorization-Key": apiKey, "User-Agent": ua, Host: "data.usajobs.gov" },
        signal: AbortSignal.timeout(6000),
      }
    );
    await logApiUsage({
      provider: "usajobs",
      endpoint: "/api/search",
      unitsUsed: 1,
      unitType: "request",
      statusCode: res.status,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.SearchResult?.SearchResultItems || [];
    const out: CandidateJob[] = [];
    for (const item of items) {
      const m = item?.MatchedObjectDescriptor;
      if (!m?.PositionTitle || !m?.PositionURI) continue;
      const loc = String(m.PositionLocationDisplay || "United States");
      if (NON_US_REGEX.test(loc) || EXCLUDE_TITLE_REGEX.test(m.PositionTitle)) continue;
      const meta = inferZoneAndMode(`${m.PositionTitle} ${loc}`);
      const org = m.OrganizationName || "Federal Agency";
      out.push({
        req_id: extractReqId(m.PositionURI),
        title: m.PositionTitle,
        company: org,
        location: loc,
        url: m.PositionURI,
        score: computeInitialScore(m.PositionTitle, org, loc),
        is_remote: meta.is_remote,
        work_mode: meta.work_mode,
        zone: meta.zone,
        sponsorship_status: "US Citizen Required",
        sponsorship_code: "GC_OR_CITIZEN_REQ",
        posted_label: "USAJOBS Live",
        keywords: extractKeywords(`${m.PositionTitle} ${m.QualificationSummary || ""}`),
        source: "USAJOBS",
        description: String(m.UserArea?.Details?.JobSummary || m.QualificationSummary || "").slice(0, 1500),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();

  // 1. Discover fresh US roles across S&P Global, Synchrony, Indeed, Fortune 500 Workday, LinkedIn (24h), and USAJOBS
  const [spg1, spg2, syn, ind, wd, li, usa] = await Promise.all([
    fetchSerperBatch(
      "S&P Global Direct",
      "S&P Global",
      "site:careers.spglobal.com Data Analyst New York",
      /careers\.spglobal\.com\/jobs\/\d+/i
    ),
    fetchSerperBatch(
      "S&P Global Direct",
      "S&P Global",
      "site:careers.spglobal.com Analyst Virginia",
      /careers\.spglobal\.com\/jobs\/\d+/i
    ),
    fetchSerperBatch(
      "Synchrony Direct",
      "Synchrony",
      "site:synchronycareers.com Data Analyst Remote",
      /synchronycareers\.com\/job\//i
    ),
    fetchSerperBatch(
      "Indeed Live",
      "Indeed Employer",
      "site:indeed.com/viewjob Senior Data Analyst Remote",
      /indeed\.com\/viewjob/i
    ),
    fetchSerperBatch(
      "Workday Enterprise",
      "Workday Enterprise",
      "site:myworkdayjobs.com Senior Data Analyst",
      /myworkdayjobs\.com\/.+\/job\//i
    ),
    fetchLinkedInGuest24h("Senior Data Analyst Snowflake"),
    fetchUsajobsLive(),
  ]);

  const deduped = new Map<string, CandidateJob>();
  for (const job of [...spg1, ...spg2, ...syn, ...ind, ...wd, ...li, ...usa]) {
    const key = normalizePair(job.company, job.title);
    if (!deduped.has(key)) deduped.set(key, job);
  }
  const candidates = Array.from(deduped.values());

  // Load existing active URLs & company/title pairs from verified_jobs to prevent duplicates
  const { data: existingRows } = await supabase
    .from("verified_jobs")
    .select("url, company, title")
    .limit(3000);

  const existingUrlSet = new Set<string>();
  const existingPairSet = new Set<string>();
  for (const r of existingRows || []) {
    if (r.url) existingUrlSet.add(r.url);
    if (r.company && r.title) existingPairSet.add(normalizePair(r.company, r.title));
  }

  const matchedExistingUrls: string[] = [];
  const newRows: any[] = [];

  for (const c of candidates) {
    if (existingUrlSet.has(c.url)) {
      matchedExistingUrls.push(c.url);
      continue;
    }
    if (existingPairSet.has(normalizePair(c.company, c.title))) continue;

    newRows.push({
      id: crypto.randomUUID(),
      req_id: c.req_id,
      title: c.title,
      company: c.company,
      location: c.location,
      url: c.url,
      score: c.score,
      is_remote: c.is_remote,
      work_mode: c.work_mode,
      zone: c.zone,
      sponsorship_status: c.sponsorship_status,
      sponsorship_code: c.sponsorship_code,
      posted_label: c.posted_label,
      keywords: c.keywords,
      source: c.source,
      description: c.description,
      is_active: true,
      applied: false,
      first_seen_at: nowIso,
      last_verified_at: nowIso,
    });
  }

  let insertedRows: any[] = [];
  let insertError: string | null = null;
  if (newRows.length > 0) {
    const { data: ins, error } = await supabase.from("verified_jobs").insert(newRows).select("*");
    if (error) insertError = error.message;
    insertedRows = ins || [];
  }

  if (matchedExistingUrls.length > 0) {
    await supabase
      .from("verified_jobs")
      .update({ is_active: true, last_verified_at: nowIso })
      .in("url", matchedExistingUrls);
  }

  // 2. Sweep the 20 oldest-verified active jobs in Supabase to purge mid-day withdrawn postings (0 search credits)
  const { data: staleCandidates } = await supabase
    .from("verified_jobs")
    .select("id, url")
    .eq("is_active", true)
    .order("last_verified_at", { ascending: true, nullsFirst: true })
    .limit(20);

  const removedIds: string[] = [];
  const removedUrls: string[] = [];
  const verifiedIds: string[] = [];

  await Promise.all(
    (staleCandidates || []).map(async (row: any) => {
      if (!row?.url) return;
      const check = await validateJobUrl(row.url, 3500);
      if (!check.valid) {
        removedIds.push(row.id);
        removedUrls.push(row.url);
      } else {
        verifiedIds.push(row.id);
      }
    })
  );

  if (removedIds.length > 0) {
    await supabase
      .from("verified_jobs")
      .update({ is_active: false, last_verified_at: nowIso })
      .in("id", removedIds);
  }
  if (verifiedIds.length > 0) {
    await supabase
      .from("verified_jobs")
      .update({ last_verified_at: nowIso })
      .in("id", verifiedIds);
  }

  return NextResponse.json({
    success: true,
    syncedAt: nowIso,
    discoveredTotal: candidates.length,
    addedCount: insertedRows.length,
    addedJobs: insertedRows,
    removedCount: removedIds.length,
    removedUrls,
    insertError,
  });
}
