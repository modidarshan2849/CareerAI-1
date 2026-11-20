import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateJobUrl } from "@/lib/linkValidator";
import { logApiUsage } from "@/lib/usageTelemetry";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const NON_US_REGEX =
  /\b(india|hyderabad|bengaluru|bangalore|pune|chennai|mumbai|telangana|malaysia|penang|netherlands|united kingdom|london|canada|toronto|poland|philippines|manila|singapore|germany|wiesbaden|mexico|costa rica|hong kong|tokyo|sydney)\b/i;

const LANDING_PAGE_REGEX = /\b(jobs & positions|search jobs|career opportunities|all jobs|careers home)\b/i;
const EXCLUDE_TITLE_REGEX = /\b(intern|internship|co-op|coop|administrative assistant|wellness coordinator|practice development)\b/i;

// Strict Analyst / BI / Data / Financial Analytics filter so non-analyst roles never pollute the Analyst feed
const ANALYST_FIT_REGEX =
  /\b(data analyst|business intelligence|bi analyst|analytics|analytics engineer|data engineer|financial analyst|finance analyst|reporting analyst|insights analyst|decision science|quantitative analyst|risk analyst|data governance|data quality|sql|snowflake|tableau|power bi|dataops)\b/i;

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
  const syn = url.match(/\/49398\/(\d+)/);
  if (syn) return `SYN-${syn[1]}`;
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
  const dict = [
    "SQL",
    "Snowflake",
    "Python",
    "Power BI",
    "Tableau",
    "Excel",
    "ETL",
    "AWS",
    "BI",
    "Analytics",
    "Financial Modeling",
    "Data Governance",
  ];
  const lower = text.toLowerCase();
  return dict.filter((k) => lower.includes(k.toLowerCase()));
}

function inferZoneAndMode(text: string): { zone: string; is_remote: boolean; work_mode: string } {
  const lower = text.toLowerCase();
  const isRemote = /\bremote\b/.test(lower);
  const isVaDmv =
    /\b(virginia|va|richmond|mclean|arlington|reston|norfolk|virginia beach|dc|washington|maryland|md|bethesda|charlotte|nc)\b/.test(
      lower
    );
  return {
    zone: isVaDmv ? "VA_DMV" : isRemote ? "REMOTE" : "US_NATIONAL",
    is_remote: isRemote,
    work_mode: isRemote ? "Remote" : "Hybrid",
  };
}

function computeInitialScore(title: string, company: string, location: string): number {
  let score = 85;
  const hay = `${title} ${company} ${location}`.toLowerCase();
  if (/senior|lead|principal|staff|manager|director/.test(hay)) score += 5;
  if (/snowflake|sql|bi|analytics|financial/.test(hay)) score += 4;
  if (
    /s&p global|synchrony|sysco|jpmorgan|capital one|wells fargo|bank of america|citigroup|citi|goldman|morgan stanley|pnc|truist|dominion|carmax|freddie mac|fannie mae/.test(
      hay
    )
  )
    score += 3;
  if (/virginia|mclean|richmond|arlington|remote/.test(hay)) score += 2;
  return Math.min(98, score);
}

// 1. Synchrony US Direct Feed (0 paid API credits) — strictly Analyst/BI/Data roles
async function fetchSynchronyUSDirect(): Promise<CandidateJob[]> {
  const keywordsList = ["Analyst", "Data", "Analytics", "Business Intelligence"];
  const collected: CandidateJob[] = [];

  for (const kw of keywordsList) {
    const apiUrl = `https://www.synchronycareers.com/search-jobs/results?ActiveFacetID=0&CurrentPage=1&RecordsPerPage=30&Distance=0&RadiusUnitType=0&Keywords=${encodeURIComponent(
      kw
    )}&Location=United+States&ShowRadius=False&IsPagination=False&FacetType=0&SearchResultsModuleName=Search+Results&SearchFiltersModuleName=Search+Filters&SortCriteria=0&SortDirection=0&SearchType=1&LocationType=2&LocationPath=6252001&OrganizationIds=49398`;
    try {
      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const html = data?.results || "";
      if (!html) continue;

      for (const m of html.matchAll(/<a[^>]+href="(\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const path = m[1];
        const rawBlock = m[2].replace(/&amp;/g, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!rawBlock || rawBlock.length < 4) continue;
        const fullUrl = `https://www.synchronycareers.com${path}`;
        if (NON_US_REGEX.test(`${rawBlock} ${path}`) || EXCLUDE_TITLE_REGEX.test(rawBlock)) continue;

        // Parse trailing "City, ST MM/DD/YYYY" cleanly
        const locDateMatch = rawBlock.match(/^(.*?)\s+([A-Z][a-zA-Z.\s]+,\s*[A-Z]{2})\s+(\d{2}\/\d{2}\/\d{4})$/);
        const title = (locDateMatch ? locDateMatch[1] : rawBlock.replace(/\s+\d{2}\/\d{2}\/\d{4}$/, "")).trim();
        const location = locDateMatch ? locDateMatch[2].trim() : "United States";
        const postedLabel = locDateMatch ? `Posted ${locDateMatch[3]}` : "Synchrony Live";

        if (!ANALYST_FIT_REGEX.test(title)) continue;

        const meta = inferZoneAndMode(`${title} ${location}`);
        collected.push({
          req_id: extractReqId(fullUrl),
          title,
          company: "Synchrony",
          location,
          url: fullUrl,
          score: computeInitialScore(title, "Synchrony", location),
          is_remote: meta.is_remote,
          work_mode: meta.work_mode,
          zone: meta.zone,
          sponsorship_status: "Not Specified",
          sponsorship_code: "NOT_SPECIFIED",
          posted_label: postedLabel,
          keywords: extractKeywords(title),
          source: "Synchrony Direct",
          description: `${title} at Synchrony (${location})`,
        });
      }
    } catch {
      // Continue
    }
  }
  return collected;
}

function inferCompanyFromUrl(link: string, fallback: string): string {
  const lower = link.toLowerCase();
  if (lower.includes("spglobal.com") || lower.includes("spgi.wd")) return "S&P Global";
  if (lower.includes("synchronycareers.com") || lower.includes("synchrony.wd")) return "Synchrony";
  if (lower.includes("sysco.com") || lower.includes("sysco.wd")) return "Sysco";
  if (lower.includes("jpmorgan") || lower.includes("jpmc.")) return "JPMorgan Chase";
  if (lower.includes("capitalone")) return "Capital One";
  if (lower.includes("wellsfargo")) return "Wells Fargo";
  if (lower.includes("bankofamerica")) return "Bank of America";
  if (lower.includes("citi.com") || lower.includes("citigroup")) return "Citigroup";
  if (lower.includes("goldmansachs")) return "Goldman Sachs";
  if (lower.includes("morganstanley")) return "Morgan Stanley";
  if (lower.includes("pnc.com") || lower.includes("pnc.wd")) return "PNC Financial";
  if (lower.includes("truist")) return "Truist";

  if (fallback === "Workday Enterprise") {
    const hostMatch = link.match(/^https?:\/\/([^.]+)\.wd\d+\.myworkdayjobs\.com/i);
    if (hostMatch) {
      return hostMatch[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  } else if (fallback === "Ashby / Greenhouse") {
    const ghMatch = link.match(/boards\.greenhouse\.io\/([^/]+)/i);
    const ashMatch = link.match(/jobs\.ashbyhq\.com\/([^/]+)/i);
    const slug = (ghMatch?.[1] || ashMatch?.[1] || "").trim();
    if (slug) return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return fallback;
}

async function fetchSerperBatch(
  label: string,
  companyFallback: string,
  query: string,
  urlFilter: RegExp,
  page = 1
): Promise<CandidateJob[]> {
  const key = (process.env.SERPER_API_KEY || "").trim();
  if (!key) return [];
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10, page }),
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
      const rawTitle = String(r.title || "").replace(/\s*[-|@].*$/, "").trim();
      const snippet = String(r.snippet || "");
      const combined = `${rawTitle} ${snippet} ${link}`;
      if (!urlFilter.test(link)) continue;
      if (NON_US_REGEX.test(combined) || EXCLUDE_TITLE_REGEX.test(rawTitle)) continue;
      if (LANDING_PAGE_REGEX.test(`${rawTitle} ${snippet}`)) continue;
      if (!ANALYST_FIT_REGEX.test(`${rawTitle} ${snippet}`)) continue;

      const company = inferCompanyFromUrl(link, companyFallback);
      const locMatch = combined.match(
        /\b(New York, NY|McLean, VA|Richmond, VA|Charlotte, NC|Stamford, CT|Houston, TX|Denver, CO|Chicago, IL|Wilmington, DE|Columbus, OH|Virginia|Remote|United States)\b/i
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
      if (!ANALYST_FIT_REGEX.test(title)) continue;
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

async function fetchUsajobsLive(keyword: string): Promise<CandidateJob[]> {
  const apiKey = (process.env.USAJOBS_API_KEY || "").trim();
  const ua = (process.env.USAJOBS_USER_AGENT || "modi.darshan268@gmail.com").trim();
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(keyword)}&ResultsPerPage=15`,
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

  // Rotate across 4 rich Analyst/BI/Enterprise tracks + alternate page 1 & page 2 so every sync uncovers net-new roles
  const cycle = Math.floor(Date.now() / (10 * 60 * 1000));
  const trackIndex = cycle % 4;
  const serperPage = Math.floor(cycle / 4) % 2 === 0 ? 1 : 2;

  const titleTracks = [
    // Track 0: Sysco + Big Banks (JPMorgan, Wells Fargo, BofA, Citi) + Lead Data Analyst
    [
      { label: "Sysco Direct", fallback: "Sysco", q: 'site:careers.sysco.com "Analyst"', rx: /careers\.sysco\.com\/.*job/i },
      { label: "Big Bank Direct", fallback: "JPMorgan Chase", q: 'site:jpmc.fa.oraclecloud.com "Data Analyst"', rx: /jpmc\.fa\.oraclecloud\.com/i },
      { label: "Big Bank Direct", fallback: "Wells Fargo", q: 'site:wellsfargojobs.com "Data Analyst"', rx: /wellsfargojobs\.com\/.*job/i },
      { label: "Workday Enterprise", fallback: "Workday Enterprise", q: 'site:myworkdayjobs.com "Lead Data Analyst"', rx: /myworkdayjobs\.com\/.+\/job\//i },
      { label: "Indeed Live", fallback: "Indeed Employer", q: 'site:indeed.com/viewjob "Senior Data Analyst" Remote', rx: /indeed\.com\/viewjob/i },
    ],
    // Track 1: Bank of America, Citigroup, Capital One + S&P Global + BI Analyst
    [
      { label: "Big Bank Direct", fallback: "Bank of America", q: 'site:careers.bankofamerica.com "Data Analyst"', rx: /careers\.bankofamerica\.com\/.*job/i },
      { label: "Big Bank Direct", fallback: "Citigroup", q: 'site:jobs.citi.com "Data Analyst"', rx: /jobs\.citi\.com\/.*job/i },
      { label: "S&P Global Direct", fallback: "S&P Global", q: 'site:careers.spglobal.com "Data Analyst"', rx: /careers\.spglobal\.com\/jobs\/\d+/i },
      { label: "Workday Enterprise", fallback: "Workday Enterprise", q: 'site:myworkdayjobs.com "Business Intelligence Analyst"', rx: /myworkdayjobs\.com\/.+\/job\//i },
      { label: "Ashby / Greenhouse", fallback: "Ashby / Greenhouse", q: 'site:boards.greenhouse.io "Senior Data Analyst"', rx: /boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/i },
    ],
    // Track 2: Sysco Workday + Goldman Sachs / Morgan Stanley / PNC + Analytics Engineer
    [
      { label: "Sysco Direct", fallback: "Sysco", q: 'site:myworkdayjobs.com "Sysco" "Analyst"', rx: /myworkdayjobs\.com\/.+\/job\//i },
      { label: "Big Bank Direct", fallback: "Capital One", q: 'site:capitalonecareers.com "Data Analyst"', rx: /capitalonecareers\.com\/.*job/i },
      { label: "Workday Enterprise", fallback: "Workday Enterprise", q: 'site:myworkdayjobs.com "Senior Data Analyst" SQL', rx: /myworkdayjobs\.com\/.+\/job\//i },
      { label: "Ashby / Greenhouse", fallback: "Ashby / Greenhouse", q: 'site:jobs.ashbyhq.com "Analytics Engineer"', rx: /jobs\.ashbyhq\.com\/[^/]+\/[a-z0-9-]+/i },
      { label: "Indeed Live", fallback: "Indeed Employer", q: 'site:indeed.com/viewjob "Business Intelligence Analyst" Remote', rx: /indeed\.com\/viewjob/i },
    ],
    // Track 3: Financial Data Analysts + Virginia/DMV + S&P Global
    [
      { label: "S&P Global Direct", fallback: "S&P Global", q: 'site:careers.spglobal.com "Analyst" Virginia', rx: /careers\.spglobal\.com\/jobs\/\d+/i },
      { label: "Workday Enterprise", fallback: "Workday Enterprise", q: 'site:myworkdayjobs.com "Financial Data Analyst"', rx: /myworkdayjobs\.com\/.+\/job\//i },
      { label: "Workday Enterprise", fallback: "Workday Enterprise", q: 'site:myworkdayjobs.com "Data Analyst" Virginia', rx: /myworkdayjobs\.com\/.+\/job\//i },
      { label: "Ashby / Greenhouse", fallback: "Ashby / Greenhouse", q: 'site:boards.greenhouse.io "Business Intelligence"', rx: /boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/i },
      { label: "Indeed Live", fallback: "Indeed Employer", q: 'site:indeed.com/viewjob "Lead Data Analyst" Remote', rx: /indeed\.com\/viewjob/i },
    ],
  ];

  const activeTrack = titleTracks[trackIndex];
  const linkedInQueries = [
    "Senior Data Analyst Snowflake",
    "Lead Data Analyst SQL",
    "Business Intelligence Analyst",
    "Financial Data Analyst",
  ];
  const usajobsKeywords = ["Data Analyst", "Business Intelligence", "Financial Data Analyst", "Data Scientist"];

  const [synDirect, serperResults, li, usa] = await Promise.all([
    fetchSynchronyUSDirect(),
    Promise.all(
      activeTrack.map((t) => fetchSerperBatch(t.label, t.fallback, t.q, t.rx, serperPage))
    ).then((arr) => arr.flat()),
    fetchLinkedInGuest24h(linkedInQueries[trackIndex]),
    fetchUsajobsLive(usajobsKeywords[trackIndex]),
  ]);

  const deduped = new Map<string, CandidateJob>();
  for (const job of [...synDirect, ...serperResults, ...li, ...usa]) {
    const key = normalizePair(job.company, job.title);
    if (!deduped.has(key)) deduped.set(key, job);
  }
  const candidates = Array.from(deduped.values());

  const { data: existingRows } = await supabase
    .from("verified_jobs")
    .select("url, company, title")
    .limit(4500);

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

  // Sweep the 20 oldest-verified active jobs in Supabase to purge mid-day withdrawn postings (0 search credits)
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
    trackIndex,
    serperPage,
    syncedAt: nowIso,
    discoveredTotal: candidates.length,
    addedCount: insertedRows.length,
    addedJobs: insertedRows,
    removedCount: removedIds.length,
    removedUrls,
    insertError,
  });
}
