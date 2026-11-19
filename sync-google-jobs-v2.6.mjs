import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serpApiKey = process.env.SERPAPI_KEY;

if (!supabaseUrl || !supabaseKey || !serpApiKey) {
  console.error("❌ Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SERPAPI_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|bi engineer|analytics engineer|data scientist|decision science|decision scientist|product analyst|marketing analyst|financial analyst|operations analyst|operations research|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|sr\.?\s*(data|bi|analytics)|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor)\b/i;
const DIRECTORY_URL_REGEX = /(simplyhired\.com\/q-|ziprecruiter\.com\/Jobs\/|indeed\.com\/q-|glassdoor\.com\/Job\/|linkedin\.com\/jobs\/search|google\.com\/goto|top\s+\d+.*jobs)/i;

function cleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    const tracking = [
      "gh_jid", "gh_src", "t", "source", "ss", "utm_source", "utm_medium",
      "utm_campaign", "utm_content", "utm_term", "gclid", "gad_source",
      "gad_campaignid", "trk", "refId", "trackingId", "RD", "eBP", "ref"
    ];
    for (const p of tracking) u.searchParams.delete(p);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    const qs = u.searchParams.toString();
    return `${u.origin}${cleanPath}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

function makeUniqueId(baseId, url, usedIds) {
  let candidate = (baseId || "gjob").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  const hash = crypto.createHash("sha256").update(`${baseId}::${url}`).digest("hex").slice(0, 12);
  candidate = `${candidate.slice(0, 46)}-${hash}`;
  let n = 1;
  while (usedIds.has(candidate)) {
    candidate = `${candidate.slice(0, 42)}-${hash}-${n++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function pickBestApplyLink(applyOptions = []) {
  if (!Array.isArray(applyOptions) || applyOptions.length === 0) return null;
  // Prefer direct company ATS/portal over aggregators, then LinkedIn, then Indeed
  const direct = applyOptions.find((o) => o.link && !/linkedin\.com|indeed\.com|ziprecruiter\.com|simplyhired\.com|glassdoor\.com|bebee\.com|talent\.com/i.test(o.link));
  if (direct) return { link: cleanUrl(direct.link), via: direct.title || "Direct Employer Portal" };
  const li = applyOptions.find((o) => o.link && /linkedin\.com/i.test(o.link));
  if (li) return { link: cleanUrl(li.link), via: "LinkedIn" };
  const ind = applyOptions.find((o) => o.link && /indeed\.com/i.test(o.link));
  if (ind) return { link: cleanUrl(ind.link), via: "Indeed" };
  const fallback = applyOptions.find((o) => o.link && !/bebee\.com|talent\.com/i.test(o.link));
  return fallback ? { link: cleanUrl(fallback.link), via: fallback.title || "Job Board" } : null;
}

async function fetchGoogleJobsPages(q, location, maxPages = 3) {
  const results = [];
  let nextPageToken = null;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      engine: "google_jobs",
      q,
      hl: "en",
      gl: "us",
      api_key: serpApiKey
    });
    if (location) params.set("location", location);
    if (nextPageToken) params.set("next_page_token", nextPageToken);

    try {
      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!res.ok) break;
      const data = await res.json();
      if (data.error) {
        console.warn(`⚠️ SerpApi warning for "${q}":`, data.error);
        break;
      }
      const jobs = data.jobs_results || [];
      results.push(...jobs);
      nextPageToken = data.serpapi_pagination?.next_page_token || null;
      if (!nextPageToken || jobs.length === 0) break;
    } catch {
      break;
    }
  }
  return results;
}

async function run() {
  // 1. Deactivate directory/search pages that slipped into verified_jobs
  const { data: activeRows } = await supabase
    .from("verified_jobs")
    .select("id, url, title")
    .eq("is_active", true)
    .range(0, 4999);

  const dirIds = (activeRows || [])
    .filter((r) => DIRECTORY_URL_REGEX.test(`${r.url || ""} ${r.title || ""}`))
    .map((r) => r.id);

  if (dirIds.length > 0) {
    await supabase.from("verified_jobs").update({ is_active: false }).in("id", dirIds);
    console.log(`🧹 Deactivated ${dirIds.length} aggregator directory/search pages.`);
  }

  // 2. Query Google Jobs engine across targeted titles & locations
  const searches = [
    { q: "Senior Data Analyst", location: "Virginia, United States", pages: 3 },
    { q: "Senior Data Analyst Remote", location: "United States", pages: 3 },
    { q: "Lead Data Analyst OR Principal Data Analyst", location: "Virginia, United States", pages: 2 },
    { q: "Analytics Engineer OR BI Engineer", location: "Virginia, United States", pages: 2 },
    { q: "Data Engineer", location: "Virginia, United States", pages: 2 },
    { q: "Data Scientist", location: "Virginia, United States", pages: 2 }
  ];

  const rawJobs = [];
  for (const s of searches) {
    const batch = await fetchGoogleJobsPages(s.q, s.location, s.pages);
    console.log(`   • google_jobs ["${s.q}" | ${s.location}]: ${batch.length} postings`);
    rawJobs.push(...batch);
  }

  const { data: allExisting } = await supabase.from("verified_jobs").select("id, url").range(0, 4999);
  const urlToId = new Map();
  const usedIds = new Set();
  for (const r of allExisting || []) {
    const c = cleanUrl(r.url || "");
    if (c) urlToId.set(c, r.id);
    if (r.id) usedIds.add(r.id);
  }

  const dedup = new Map();
  let netNew = 0;

  for (const item of rawJobs) {
    const title = (item.title || "").trim();
    const company = (item.company_name || "").trim();
    const loc = (item.location || "United States").trim();
    const desc = (item.description || "").trim();

    if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(`${title} ${item.detected_extensions?.schedule_type || ""}`)) continue;
    if (DIRECTORY_URL_REGEX.test(`${title} ${company}`)) continue;

    const best = pickBestApplyLink(item.apply_options);
    if (!best || !best.link || DIRECTORY_URL_REGEX.test(best.link)) continue;

    const cUrl = best.link;
    if (dedup.has(cUrl)) continue;

    const isRemote = /remote|anywhere/i.test(`${loc} ${title} ${item.detected_extensions?.work_from_home ? "remote" : ""}`);
    const isVA = /\b(va|virginia|chesterfield|richmond|norfolk|virginia beach|arlington|mclean|reston|tysons|washington,\s*dc|dc|maryland|md)\b/i.test(loc);

    const existingId = urlToId.get(cUrl);
    const baseId = `gjobs-${crypto.createHash("md5").update(cUrl).digest("hex").slice(0, 12)}`;
    const id = existingId || makeUniqueId(baseId, cUrl, usedIds);

    dedup.set(cUrl, {
      id,
      req_id: (item.job_id || "GJ").slice(0, 24),
      title,
      company: company || "Employer",
      location: loc,
      url: cUrl,
      score: 90,
      is_remote: isRemote,
      miles_from_home: isVA ? 20 : isRemote ? 0 : 150,
      work_mode: isRemote ? "Remote" : "Hybrid",
      zone: isVA ? "Virginia / DMV" : isRemote ? "US Remote" : "US National",
      sponsorship_status: "Not Specified / Open",
      sponsorship_code: "NOT_SPECIFIED",
      posted_label: item.detected_extensions?.posted_at || "Recent",
      last_date: "Rolling / Until Filled",
      keywords: ["SQL", "Python", "Analytics"],
      salary_range: item.detected_extensions?.salary || "$135,000 - $185,000 / yr",
      source: `${best.via} (Google Jobs)`,
      description: desc.slice(0, 3200),
      is_active: true,
      last_verified_at: new Date().toISOString()
    });

    if (!existingId) netNew++;
  }

  const rows = Array.from(dedup.values());
  let saved = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    const { error } = await supabase.from("verified_jobs").upsert(chunk, { onConflict: "url" });
    if (!error) {
      saved += chunk.length;
    } else {
      for (const row of chunk) {
        const retryId = makeUniqueId(`${row.id}-gj`, row.url, usedIds);
        const { error: sErr } = await supabase.from("verified_jobs").upsert({ ...row, id: retryId }, { onConflict: "url" });
        if (!sErr) saved++;
      }
    }
  }

  const { count } = await supabase.from("verified_jobs").select("*", { count: "exact", head: true }).eq("is_active", true);
  console.log(`\n✅ Google Jobs ingested: ${saved} / ${rows.length} unique postings | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

run();
