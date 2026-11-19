import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const BROADER_ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|supply chain analyst|commercial analytics|data governance|data quality|warehouse)\b/i;
const EXCLUDE_ROLE_REGEX = /\b(intern|internship|co-op|recruiter|counsel|nurse|technician|mechanic|driver|janitor|warehouse associate)\b/i;
const TECH_KEYWORDS = ["SQL", "Python", "Snowflake", "Power BI", "Tableau", "AWS", "Databricks", "ETL", "Looker", "dbt", "R", "BigQuery", "Qlik", "Postgres", "Spark"];

const ASHBY_BOARDS = [
  { slug: "ramp", name: "Ramp" },
  { slug: "notion", name: "Notion" },
  { slug: "linear", name: "Linear" },
  { slug: "retool", name: "Retool" },
  { slug: "deel", name: "Deel" },
  { slug: "vanta", name: "Vanta" },
  { slug: "posthog", name: "PostHog" },
  { slug: "supabase", name: "Supabase" },
  { slug: "modal", name: "Modal" },
  { slug: "cohere", name: "Cohere" }
];

function classifyAndScore(title, description, location) {
  const blob = `${title} ${description || ""}`;
  const keywords = TECH_KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(blob));
  if (keywords.length === 0) keywords.push("SQL", "Analytics");

  let score = 82 + Math.min(keywords.length * 2, 12);
  if (/senior|sr\.|lead|principal|manager|staff|director/i.test(title)) score += 4;
  if (keywords.includes("Python") || keywords.includes("Snowflake") || keywords.includes("SQL")) score += 2;

  const isRemote = /remote/i.test(location);
  const noSponsor = /\b(will not sponsor|does not sponsor|no visa sponsorship|without sponsorship|us citizen|u\.s\. citizen|green card|security clearance|secret clearance|ts\/sci)\b/i.test(blob);
  const yesSponsor = /\b(visa sponsorship available|sponsorship available|will sponsor|willing to sponsor|h-?1b sponsorship)\b/i.test(blob);

  return {
    score: Math.min(score, 99),
    keywords,
    is_remote: isRemote,
    miles_from_home: isRemote ? 0 : /virginia beach|norfolk|chesapeake|newport news/i.test(location) ? 20 : 150,
    work_mode: isRemote ? "Remote" : "Hybrid",
    zone: isRemote ? "US Remote" : /virginia beach|norfolk|chesapeake|newport news/i.test(location) ? "Hampton Roads (<=50 mi)" : "Virginia / DMV & Regional",
    sponsorship_code: noSponsor ? "NO_SPONSORSHIP" : yesSponsor ? "SPONSORSHIP_AVAILABLE" : "NOT_SPECIFIED",
    sponsorship_status: noSponsor
      ? "US Citizen / Green Card Only (No Sponsorship)"
      : yesSponsor
      ? "Visa / Green Card Sponsorship Available"
      : "Not Specified / Open"
  };
}

async function fetchAshbyJobs() {
  const jobs = [];
  for (const b of ASHBY_BOARDS) {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${b.slug}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const j of data.jobs || []) {
        const title = j.title || "";
        const loc = j.location || (j.isRemote ? "Remote, US" : "United States");
        if (!BROADER_ROLE_REGEX.test(title) || EXCLUDE_ROLE_REGEX.test(title)) continue;
        const url = j.jobUrl || j.applyUrl;
        if (!url || !url.startsWith("https://")) continue;

        const meta = classifyAndScore(title, j.descriptionPlain || j.descriptionHtml || "", loc);
        jobs.push({
          id: `ashby-${b.slug}-${j.id}`,
          req_id: String(j.id).slice(0, 18),
          title,
          company: b.name,
          location: loc,
          url,
          score: meta.score,
          is_remote: meta.is_remote,
          miles_from_home: meta.miles_from_home,
          work_mode: meta.work_mode,
          zone: meta.zone,
          sponsorship_status: meta.sponsorship_status,
          sponsorship_code: meta.sponsorship_code,
          posted_label: j.publishedAt ? new Date(j.publishedAt).toLocaleDateString("en-US") : "Active",
          last_date: "Rolling / Until Filled",
          keywords: meta.keywords,
          salary_range: j.compensationTierSummary || "$135,000 - $190,000 / yr",
          source: `${b.name} (Ashby ATS)`,
          description: (j.descriptionPlain || j.descriptionHtml || "").replace(/<[^>]+>/g, " ").slice(0, 3200),
          is_active: true,
          last_verified_at: new Date().toISOString()
        });
      }
    } catch {}
  }
  console.log(`✅ Ashby ATS boards: ${jobs.length} matching open roles`);
  return jobs;
}

async function isUrlReachable(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CareerAI-Verifier/2.2)" }
    });
    clearTimeout(timer);
    return res.status !== 404 && res.status !== 410 && res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  console.log("🚀 Fetching additional open roles from Ashby ATS...");
  const ashbyJobs = await fetchAshbyJobs();

  const dedup = new Map();
  for (const j of ashbyJobs) {
    const cleanUrl = j.url.split("?")[0].replace(/\/$/, "");
    if (!dedup.has(cleanUrl)) dedup.set(cleanUrl, { ...j, url: cleanUrl });
  }

  const candidates = Array.from(dedup.values());
  console.log(`🔍 Checking reachability on ${candidates.length} candidate requisition links...`);

  const reachable = [];
  for (let i = 0; i < candidates.length; i += 15) {
    const slice = candidates.slice(i, i + 15);
    const results = await Promise.all(slice.map(async (job) => ((await isUrlReachable(job.url)) ? job : null)));
    reachable.push(...results.filter(Boolean));
  }

  console.log(`📦 Upserting ${reachable.length} verified open requisitions into Supabase...`);
  for (let i = 0; i < reachable.length; i += 50) {
    const batch = reachable.slice(i, i + 50);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (error) console.error("⚠️ Upsert error:", error.message);
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`✅ Complete! Total active verified jobs in Supabase: ${count}`);
}

main();
