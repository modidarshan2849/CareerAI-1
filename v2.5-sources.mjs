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

const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|junior|jr\.|recruiter|counsel|registered nurse|mechanic|driver|janitor)\b/i;
const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i;

function isAllowedLocation(loc) {
  if (!loc) return true;
  if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) return false;
  return true;
}

function buildRow(base) {
  const isRemote = /remote|anywhere|united states|usa/i.test(base.location || "");
  return {
    id: base.id,
    req_id: base.req_id || "EXT",
    title: base.title,
    company: base.company,
    location: base.location || "Remote, US",
    url: base.url,
    score: base.score || 86,
    is_remote: isRemote,
    miles_from_home: isRemote ? 0 : 120,
    work_mode: isRemote ? "Remote" : "Hybrid",
    zone: isRemote ? "US Remote" : "Virginia / DMV & Regional",
    sponsorship_status: base.sponsorship_status || "Not Specified / Open",
    sponsorship_code: base.sponsorship_code || "NOT_SPECIFIED",
    posted_label: base.posted_label || "Recent",
    last_date: "Rolling / Until Filled",
    keywords: base.keywords || ["SQL", "Python", "Analytics"],
    salary_range: base.salary_range || "$130,000 - $175,000 / yr",
    source: base.source,
    description: (base.description || "").slice(0, 3200),
    is_active: true,
    last_verified_at: new Date().toISOString()
  };
}

// Additional External Source 1: Arbeitnow Public Job Board API
async function fetchArbeitnow() {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api");
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    for (const j of data.data || []) {
      const title = j.title || "";
      const loc = j.location || (j.remote ? "Remote, US" : "United States");
      if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
      if (!isAllowedLocation(loc)) continue;
      if (!j.url?.startsWith("https://")) continue;

      out.push(
        buildRow({
          id: `arbeitnow-${j.slug || Buffer.from(j.url).toString("base64url").slice(-10)}`,
          title,
          company: j.company_name || "External Employer",
          location: loc,
          url: j.url.split("?")[0],
          source: "Arbeitnow Feed",
          description: (j.description || "").replace(/<[^>]+>/g, " ")
        })
      );
    }
    return out;
  } catch {
    return [];
  }
}

// Additional External Source 2: RemoteOK Public JSON API
async function fetchRemoteOK() {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": "CareerAI-v2.5" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    for (const item of Array.isArray(data) ? data.slice(1) : []) {
      const title = item.position || "";
      const loc = item.location || "Remote, US";
      if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
      if (!isAllowedLocation(loc)) continue;
      const applyUrl = item.apply_url || item.url;
      if (!applyUrl?.startsWith("https://")) continue;

      out.push(
        buildRow({
          id: `remoteok-${item.id || Buffer.from(applyUrl).toString("base64url").slice(-10)}`,
          title,
          company: item.company || "Remote Employer",
          location: loc,
          url: applyUrl.split("?")[0],
          salary_range: item.salary_min && item.salary_max ? `$${item.salary_min} - $${item.salary_max}` : undefined,
          source: "RemoteOK Feed",
          description: (item.description || "").replace(/<[^>]+>/g, " ")
        })
      );
    }
    return out;
  } catch {
    return [];
  }
}

// Additional External Source 3: Jobicy Remote Jobs API
async function fetchJobicy() {
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&tag=data");
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    for (const j of data.jobs || []) {
      const title = j.jobTitle || "";
      const loc = j.jobGeo || "Remote, US";
      if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
      if (!isAllowedLocation(loc)) continue;
      if (!j.url?.startsWith("https://")) continue;

      out.push(
        buildRow({
          id: `jobicy-${j.id || Buffer.from(j.url).toString("base64url").slice(-10)}`,
          title,
          company: j.companyName || "Remote Employer",
          location: loc,
          url: j.url.split("?")[0],
          source: "Jobicy Feed",
          description: (j.jobDescription || j.jobExcerpt || "").replace(/<[^>]+>/g, " ")
        })
      );
    }
    return out;
  } catch {
    return [];
  }
}

async function runAdditionalSources() {
  const { data: existing } = await supabase.from("verified_jobs").select("url");
  const existingUrls = new Set((existing || []).map((r) => (r.url || "").replace(/\/$/, "")));

  const [arbeitnow, remoteok, jobicy] = await Promise.all([
    fetchArbeitnow(),
    fetchRemoteOK(),
    fetchJobicy()
  ]);

  console.log("📊 Additional External Source Counts:");
  console.log(`   • Arbeitnow: ${arbeitnow.length} matching jobs`);
  console.log(`   • RemoteOK:  ${remoteok.length} matching jobs`);
  console.log(`   • Jobicy:    ${jobicy.length} matching jobs`);

  const allNewCandidates = [...arbeitnow, ...remoteok, ...jobicy];
  const dedup = new Map();
  let netNewAdded = 0;

  for (const row of allNewCandidates) {
    const normUrl = row.url.replace(/\/$/, "");
    if (dedup.has(normUrl)) continue;
    dedup.set(normUrl, { ...row, url: normUrl });
    if (!existingUrls.has(normUrl)) netNewAdded++;
  }

  const rows = Array.from(dedup.values());
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from("verified_jobs").upsert(rows.slice(i, i + 50), { onConflict: "url" });
    if (error) console.error("⚠️ Upsert error:", error.message);
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Total candidate jobs from new sources: ${allNewCandidates.length}`);
  console.log(`➕ Net-new unique URLs not previously in DB: ${netNewAdded}`);
  console.log(`📌 Total active jobs in verified_jobs: ${count}`);
}

runAdditionalSources();
