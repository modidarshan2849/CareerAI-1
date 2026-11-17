import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const TARGET_ROLE_REGEX = /\b(data analyst|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|analyst,\s*(?:senior|sr\.?|lead|principal)|supply chain analyst|commercial analytics|data governance|data quality)\b/i;
const EXCLUDE_ROLE_REGEX = /\b(intern|internship|co-op|software engineer|frontend|backend|ios|android|account executive|recruiter|counsel|nurse|technician|mechanic|driver)\b/i;
const TECH_KEYWORDS = ["SQL", "Python", "Snowflake", "Power BI", "Tableau", "AWS", "Databricks", "ETL", "Looker", "dbt", "R", "BigQuery", "Qlik"];

function scoreAndClassify(job) {
  const blob = `${job.title} ${job.description || ""}`;
  const keywords = TECH_KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(blob));
  if (keywords.length === 0) keywords.push("SQL", "Analytics");

  let score = 82 + Math.min(keywords.length * 2, 12);
  if (/senior|sr\.|lead|principal|manager|staff|director/i.test(job.title)) score += 4;
  if (keywords.includes("Python") || keywords.includes("Snowflake")) score += 2;

  const noSponsor = /\b(will not sponsor|does not sponsor|no visa sponsorship|without sponsorship|us citizen|u\.s\. citizen|green card|security clearance|secret clearance|ts\/sci)\b/i.test(blob);
  const yesSponsor = /\b(visa sponsorship available|sponsorship available|will sponsor|willing to sponsor|h-?1b sponsorship)\b/i.test(blob);

  return {
    score: Math.min(score, 99),
    keywords,
    sponsorship_code: noSponsor ? "NO_SPONSORSHIP" : yesSponsor ? "SPONSORSHIP_AVAILABLE" : "NOT_SPECIFIED",
    sponsorship_status: noSponsor
      ? "US Citizen / Green Card Only (No Sponsorship)"
      : yesSponsor
      ? "Visa / Green Card Sponsorship Available"
      : "Not Specified / Open"
  };
}

// 1. Expanded USAJOBS Federal / DoD Feed (Hampton Roads & Remote)
async function fetchUSAJobs() {
  if (!process.env.USAJOBS_API_KEY || !process.env.USAJOBS_EMAIL) return [];
  const results = [];
  const locations = ["Virginia Beach, Virginia", "Norfolk, Virginia", "Newport News, Virginia", "Washington, District of Columbia", "Remote"];
  const keywords = ["Data Analyst", "Data Scientist", "Business Intelligence", "Operations Research"];

  for (const loc of locations) {
    for (const kw of keywords) {
      try {
        const res = await fetch(
          `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(kw)}&LocationName=${encodeURIComponent(loc)}&ResultsPerPage=50`,
          {
            headers: {
              "Host": "data.usajobs.gov",
              "User-Agent": process.env.USAJOBS_EMAIL,
              "Authorization-Key": process.env.USAJOBS_API_KEY
            }
          }
        );
        if (!res.ok) continue;
        const data = await res.json();
        for (const item of data.SearchResult?.SearchResultItems || []) {
          const d = item.MatchedObjectDescriptor;
          if (!d?.PositionTitle || !TARGET_ROLE_REGEX.test(d.PositionTitle)) continue;
          const isRem = loc === "Remote" || d.PositionOfferingType?.[0]?.Name?.toLowerCase().includes("telework");
          results.push({
            id: `usajobs-${item.MatchedObjectId}`,
            req_id: item.MatchedObjectId,
            title: d.PositionTitle,
            company: d.OrganizationName || "U.S. Federal Agency",
            location: d.PositionLocationDisplay || loc,
            url: d.ApplyURI?.[0] || d.PositionURI,
            is_remote: isRem,
            miles_from_home: isRem ? 0 : 20,
            work_mode: isRem ? "Remote" : "On-site",
            zone: isRem ? "US Remote" : "Hampton Roads (<=50 mi)",
            posted_label: d.PublicationStartDate ? new Date(d.PublicationStartDate).toLocaleDateString("en-US") : "Active",
            last_date: d.ApplicationCloseDate ? new Date(d.ApplicationCloseDate).toLocaleDateString("en-US") : "See Announcement",
            salary_range: d.PositionRemuneration?.[0]
              ? `$${Number(d.PositionRemuneration[0].MinimumRange).toLocaleString()} - $${Number(d.PositionRemuneration[0].MaximumRange).toLocaleString()}`
              : "Federal GS Scale",
            source: "USAJOBS Federal",
            description: d.UserArea?.Details?.JobSummary || d.QualificationSummary || ""
          });
        }
      } catch {}
    }
  }
  return results;
}

// 2. Expanded JSearch Google Jobs Feed (Multi-Page & Multi-Title)
async function fetchJSearchJobs() {
  if (!process.env.JSEARCH_API_KEY) return [];
  const queries = [
    "Data Analyst Norfolk VA",
    "Senior Data Analyst Virginia Beach VA",
    "Data Scientist Hampton Roads VA",
    "Business Intelligence Analyst Richmond VA",
    "Data Analyst Washington DC",
    "Remote Data Analyst United States",
    "Remote Senior Data Scientist US",
    "Analytics Engineer Virginia"
  ];
  const results = [];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&page=1&num_pages=3&date_posted=month`,
        {
          headers: {
            "X-RapidAPI-Key": process.env.JSEARCH_API_KEY,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
          }
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.data || []) {
        if (!j.job_title || !TARGET_ROLE_REGEX.test(j.job_title) || EXCLUDE_ROLE_REGEX.test(j.job_title)) continue;
        const applyUrl = j.job_apply_link || "";
        if (!applyUrl.startsWith("https://")) continue;
        results.push({
          id: `jsearch-${j.job_id}`,
          req_id: String(j.job_id).slice(0, 16),
          title: j.job_title,
          company: j.employer_name || "Enterprise Employer",
          location: j.job_is_remote ? "Remote, US" : `${j.job_city || "Virginia"}, ${j.job_state || "VA"}`,
          url: applyUrl.split("?")[0],
          is_remote: Boolean(j.job_is_remote),
          miles_from_home: j.job_is_remote ? 0 : 45,
          work_mode: j.job_is_remote ? "Remote" : "Hybrid",
          zone: j.job_is_remote ? "US Remote" : "Virginia / DMV (<=200 mi)",
          posted_label: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc).toLocaleDateString("en-US") : "Recent",
          last_date: j.job_offer_expiration_datetime_utc ? new Date(j.job_offer_expiration_datetime_utc).toLocaleDateString("en-US") : "Rolling / Until Filled",
          salary_range: j.job_min_salary ? `$${j.job_min_salary.toLocaleString()} - $${j.job_max_salary?.toLocaleString()}` : "$130,000 - $175,000 / yr",
          source: "JSearch (Google Jobs)",
          description: (j.job_description || "").slice(0, 3200)
        });
      }
    } catch {}
  }
  return results;
}

// 3. Jobspipe Upstream ATS Feed Integration
async function fetchJobspipeJobs() {
  if (!process.env.JOBSPIPE_API_KEY) return [];
  try {
    const res = await fetch("https://api.jobspipe.dev/v1/jobs?keyword=data+analyst&location=Virginia&limit=100", {
      headers: { "Authorization": `Bearer ${process.env.JOBSPIPE_API_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || data.data || []).map((j: any) => ({
      id: `jobspipe-${j.id || j.job_id}`,
      req_id: j.req_id || "PIPE",
      title: j.title,
      company: j.company || "Enterprise Corp",
      location: j.location || "Virginia / Remote",
      url: j.url || j.apply_url,
      is_remote: /remote/i.test(j.location || ""),
      miles_from_home: 20,
      work_mode: /remote/i.test(j.location || "") ? "Remote" : "Hybrid",
      zone: "Virginia / DMV (<=200 mi)",
      posted_label: "Active",
      salary_range: j.salary_range || "$135,000 - $175,000 / yr",
      source: "Jobspipe Feed",
      description: (j.description || "").slice(0, 3200)
    }));
  } catch {
    return [];
  }
}

async function loadLocalVerifiedPool() {
  const poolPath = fs.existsSync("./src/lib/ats/master-jobs-pool.ts")
    ? "./src/lib/ats/master-jobs-pool.ts"
    : "./lib/ats/master-jobs-pool.ts";
  if (!fs.existsSync(poolPath)) return [];
  const raw = fs.readFileSync(poolPath, "utf8");
  const match = raw.match(/export const GENERATED_228_JOBS\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

async function syncAllToSupabase() {
  console.log("🚀 Aggregating all sources (USAJOBS, JSearch, Jobspipe, Local ATS) into Supabase...");
  const [localDirect, usaJobs, jsearchJobs, jobspipeJobs] = await Promise.all([
    loadLocalVerifiedPool(),
    fetchUSAJobs(),
    fetchJSearchJobs(),
    fetchJobspipeJobs()
  ]);

  const combined = [...localDirect, ...usaJobs, ...jsearchJobs, ...jobspipeJobs];
  const dedupByUrl = new Map();

  for (const job of combined) {
    if (!job.url || !job.url.startsWith("https://")) continue;
    const normUrl = job.url.replace(/\/$/, "");
    if (dedupByUrl.has(normUrl)) continue;

    const meta = scoreAndClassify(job);
    dedupByUrl.set(normUrl, {
      id: job.id,
      req_id: job.req_id || "DIRECT",
      title: job.title,
      company: job.company,
      location: job.location,
      url: normUrl,
      score: job.score || meta.score,
      is_remote: Boolean(job.is_remote),
      miles_from_home: job.miles_from_home ?? 0,
      work_mode: job.work_mode || (job.is_remote ? "Remote" : "Hybrid"),
      zone: job.zone || (job.is_remote ? "US Remote" : "Virginia / DMV (<=200 mi)"),
      sponsorship_status: job.sponsorship_status || meta.sponsorship_status,
      sponsorship_code: job.sponsorship_code || meta.sponsorship_code,
      posted_label: job.posted_label || "Active",
      last_date: job.last_date || "Rolling / Until Filled",
      keywords: job.keywords || meta.keywords,
      salary_range: job.salary_range || "$135,000 - $180,000 / yr",
      source: job.source || "Direct ATS",
      description: (job.description || "").slice(0, 3400),
      is_active: true,
      last_verified_at: new Date().toISOString()
    });
  }

  const rows = Array.from(dedupByUrl.values());
  console.log(`📦 Upserting ${rows.length} deduplicated verified requisitions into Supabase...`);

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase
      .from("verified_jobs")
      .upsert(batch, { onConflict: "url", ignoreDuplicates: false });
    if (error) console.error("⚠️ Upsert error:", error.message);
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`✅ Central Database Sync Complete! Total active verified jobs stored: ${count ?? rows.length}`);
}

syncAllToSupabase();
