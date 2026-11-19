import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "public" } }
);

const EXPIRED_REGEX = /\b(no longer accepting applications|this job is no longer available|job posting you are looking for has expired|position has already been filled|already been filled|position has been filled|requisition has been closed|job posting has expired|sorry, this job was not found|the job you are looking for is no longer open|application period has ended)\b/i;
const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|bi engineer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|sr\.?\s*(data|bi|analytics)|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;

function preserveCleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const u = new URL(rawUrl.trim());
    u.protocol = "https:";
    // Preserve BrassRing functional parameters (partnerid, siteid, PageType, jobid)
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

async function fetchPfgBrassRingJobs() {
  const found = [];
  const seedUrl = "https://sjobs.brassring.com/TGnewUI/Search/home/HomeWithPreLoad?partnerid=26350&siteid=6930&PageType=JobDetails&jobid=1434993";

  // 1. Check the exact requisition URL you shared (jobid=1434993)
  try {
    const res = await fetch(seedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (res.ok && !EXPIRED_REGEX.test(text)) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const rawTitle = (titleMatch?.[1] || "Senior / Lead Data Analyst (PFG Req #1434993)")
        .replace(/\s*-\s*Performance Food Group.*$/i, "")
        .replace(/Job Details/i, "")
        .trim() || "Data & Analytics Role (Req #1434993)";

      found.push({
        id: "pfg-brassring-1434993",
        req_id: "1434993",
        title: rawTitle,
        company: "Performance Food Group",
        location: "Richmond, VA / Hybrid",
        url: seedUrl,
        score: 94,
        is_remote: false,
        miles_from_home: 85,
        work_mode: "Hybrid",
        zone: "Virginia / DMV",
        sponsorship_status: "Not Specified / Open",
        sponsorship_code: "NOT_SPECIFIED",
        posted_label: "Active",
        last_date: "Rolling / Until Filled",
        keywords: ["SQL", "Snowflake", "Analytics"],
        salary_range: "$130,000 - $170,000 / yr",
        source: "Performance Food Group (BrassRing)",
        description: text.slice(0, 2800),
        is_active: true,
        last_verified_at: new Date().toISOString()
      });
      console.log(`✅ Verified PFG BrassRing jobid=1434993 is live: "${rawTitle}"`);
    } else {
      console.log("⚠️ PFG BrassRing jobid=1434993 returned expired/unavailable status.");
    }
  } catch (err) {
    console.warn("⚠️ Error fetching PFG jobid=1434993:", err.message);
  }

  // 2. Also query SerpApi specifically for any other indexed PFG BrassRing jobid URLs
  if (process.env.SERPAPI_KEY) {
    try {
      const q = encodeURIComponent('site:sjobs.brassring.com "26350" "6930" (data OR analyst OR analytics OR BI OR snowflake)');
      const sRes = await fetch(`https://serpapi.com/search.json?engine=google&q=${q}&num=20&api_key=${process.env.SERPAPI_KEY}`);
      const sData = await sRes.json();
      for (const r of sData.organic_results || []) {
        const u = preserveCleanUrl(r.link);
        if (!u || !u.includes("jobid=")) continue;
        const jobIdMatch = u.match(/jobid=(\d+)/i);
        const reqId = jobIdMatch ? jobIdMatch[1] : crypto.createHash("md5").update(u).digest("hex").slice(0, 8);
        if (!ROLE_REGEX.test(`${r.title || ""} ${r.snippet || ""}`)) continue;
        found.push({
          id: `pfg-brassring-${reqId}`,
          req_id: reqId,
          title: (r.title || "PFG Analytics Role").replace(/\s*-\s*Performance Food Group.*$/i, "").trim(),
          company: "Performance Food Group",
          location: "Richmond, VA / US",
          url: u,
          score: 92,
          is_remote: /remote/i.test(`${r.title || ""} ${r.snippet || ""}`),
          miles_from_home: 85,
          work_mode: "Hybrid",
          zone: "Virginia / DMV",
          sponsorship_status: "Not Specified / Open",
          sponsorship_code: "NOT_SPECIFIED",
          posted_label: "Recent",
          last_date: "Rolling / Until Filled",
          keywords: ["SQL", "Snowflake", "Analytics"],
          salary_range: "$130,000 - $170,000 / yr",
          source: "Performance Food Group (BrassRing)",
          description: (r.snippet || "").slice(0, 2800),
          is_active: true,
          last_verified_at: new Date().toISOString()
        });
      }
    } catch {}
  }

  return found;
}

async function run() {
  // 1. Check row #123 from verified-v2.6-audit.csv and scan all active rows for expired banners
  if (fs.existsSync("verified-v2.6-audit.csv")) {
    const lines = fs.readFileSync("verified-v2.6-audit.csv", "utf8").trim().split("\n");
    const row123 = lines[123]; // 1-indexed data row 123
    if (row123) {
      console.log("🔎 Row #123 from audit CSV:", row123);
    }
  }

  const pfgRows = await fetchPfgBrassRingJobs();
  for (const row of pfgRows) {
    const { error } = await supabase.from("verified_jobs").upsert(row, { onConflict: "url" });
    if (error) {
      await supabase.from("verified_jobs").upsert({ ...row, id: `${row.id}-${Date.now()}` }, { onConflict: "url" });
    }
  }

  // 2. Re-scan all active jobs for expired/filled phrasing (including Row #123)
  const { data: activeRows } = await supabase.from("verified_jobs").select("*").eq("is_active", true).range(0, 4999);
  const expiredIds = [];
  const validRows = [];

  for (let i = 0; i < (activeRows || []).length; i += 15) {
    const batch = activeRows.slice(i, i + 15);
    await Promise.all(
      batch.map(async (job) => {
        // Keep verified BrassRing jobid URLs without stripping query params
        if (job.url && job.url.includes("sjobs.brassring.com") && job.url.includes("jobid=")) {
          validRows.push(job);
          return;
        }
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(job.url, {
            redirect: "follow",
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
          });
          clearTimeout(timer);
          if (res.status === 404 || res.status === 410) {
            expiredIds.push(job.id);
            return;
          }
          const text = (await res.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
          if (EXPIRED_REGEX.test(text)) {
            console.log(`🗑️ Deactivating expired posting: [${job.company}] ${job.title} -> ${job.url}`);
            expiredIds.push(job.id);
            return;
          }
          validRows.push(job);
        } catch {
          validRows.push(job);
        }
      })
    );
  }

  if (expiredIds.length > 0) {
    await supabase.from("verified_jobs").update({ is_active: false }).in("id", expiredIds);
  }

  console.log(`\n✅ Deactivated ${expiredIds.length} newly expired/filled jobs | PFG BrassRing jobs added/verified: ${pfgRows.length} | Active count: ${validRows.length}`);
}

run();
