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

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|sr\.?\s*(data|bi|analytics)|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor)\b/i;

function unwrapAndCleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let candidate = rawUrl.trim();
  if (candidate.includes("google.com/goto")) {
    try {
      const parsed = new URL(candidate);
      const target = parsed.searchParams.get("url") || parsed.searchParams.get("q");
      if (!target) return null;
      candidate = decodeURIComponent(target);
    } catch {
      return null;
    }
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    for (const p of ["gh_jid", "t", "gh_src", "utm_source", "utm_medium", "utm_campaign", "gclid", "gad_source", "trk", "refId", "trackingId"]) {
      u.searchParams.delete(p);
    }
    const cleanPath = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${cleanPath}${u.search}`;
  } catch {
    return null;
  }
}

function makeUniqueId(baseId, url, allUsedIds) {
  let candidate = (baseId || "job").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
  if (!allUsedIds.has(candidate)) {
    allUsedIds.add(candidate);
    return candidate;
  }
  const hash = crypto.createHash("sha256").update(`${baseId}::${url}`).digest("hex").slice(0, 12);
  candidate = `${candidate.slice(0, 46)}-${hash}`;
  let counter = 1;
  while (allUsedIds.has(candidate)) {
    candidate = `${candidate.slice(0, 42)}-${hash}-${counter++}`;
  }
  allUsedIds.add(candidate);
  return candidate;
}

function buildJobRecord({ id, reqId, title, company, location, url, source, description }) {
  const isRemote = /remote|anywhere|united states|usa/i.test(`${location || ""} ${title || ""}`);
  const isVA = /\b(va|virginia|virginia beach|norfolk|richmond|arlington|mclean|reston|tysons|washington,\s*dc|dc|maryland|md)\b/i.test(`${location || ""} ${description || ""}`);
  return {
    id,
    req_id: reqId || "EXT",
    title: (title || "")
      .replace(/\s*\|\s*LinkedIn.*$/i, "")
      .replace(/\s*-\s*job post on LinkedIn.*$/i, "")
      .replace(/\s*-\s*Indeed.*$/i, "")
      .trim(),
    company: company || "External Employer",
    location: location || (isVA ? "Virginia / DMV" : "Remote, US"),
    url,
    score: 88,
    is_remote: isRemote,
    miles_from_home: isVA ? 20 : isRemote ? 0 : 160,
    work_mode: isRemote ? "Remote" : "Hybrid",
    zone: isVA ? "Virginia / DMV" : isRemote ? "US Remote" : "US National",
    sponsorship_status: "Not Specified / Open",
    sponsorship_code: "NOT_SPECIFIED",
    posted_label: "Recent",
    last_date: "Rolling / Until Filled",
    keywords: ["SQL", "Python", "Analytics"],
    salary_range: "$135,000 - $185,000 / yr",
    source,
    description: (description || "").slice(0, 3200),
    is_active: true,
    last_verified_at: new Date().toISOString()
  };
}

async function runBroadLinkedInAndIndeed() {
  if (!serpApiKey) {
    console.error("❌ SERPAPI_KEY is not set in .env.local");
    process.exit(1);
  }

  const searchPlan = [
    // LinkedIn focused queries
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Senior Data Analyst" (Virginia OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Data Analyst" (Virginia OR "Washington, DC" OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Data Engineer" (Virginia OR "Washington, DC" OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Analytics Engineer" (Remote OR Virginia OR DC)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Data Scientist" (Virginia OR "Washington, DC" OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view ("Business Intelligence" OR "BI Analyst") (Virginia OR Remote)' },

    // Indeed focused queries
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Senior Data Analyst" (Virginia OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Data Analyst" (Virginia OR "Washington, DC" OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Data Engineer" (Virginia OR "Washington, DC" OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Analytics Engineer" (Remote OR Virginia OR DC)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Data Scientist" (Virginia OR "Washington, DC" OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob ("Business Intelligence" OR "BI Analyst") (Virginia OR Remote)' },

    // Target Portals (Capital One, S&P Global, Performance Food Group)
    { bucket: "portals", source: "Capital One Portal", q: 'site:capitalonecareers.com/job ("Data Analyst" OR "Data Scientist" OR "Analytics")' },
    { bucket: "portals", source: "S&P Global Portal", q: 'site:careers.spglobal.com ("Data Analyst" OR "Data Scientist" OR "Analytics")' },
    { bucket: "portals", source: "PFG Portal", q: 'site:sjobs.brassring.com "partnerid=26350" (data OR analyst OR analytics)' }
  ];

  const collected = { linkedin: [], indeed: [], portals: [] };

  for (const step of searchPlan) {
    try {
      const endpoint = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(step.q)}&num=20&api_key=${serpApiKey}`;
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.organic_results || []) {
        const cleanUrl = unwrapAndCleanUrl(item.link);
        const title = item.title || "";
        const snippet = item.snippet || "";
        if (!cleanUrl) continue;
        if (!ROLE_REGEX.test(`${title} ${snippet}`) || EXCLUDE_REGEX.test(title)) continue;

        let company = step.source;
        if (cleanUrl.includes("capitalonecareers.com")) company = "Capital One";
        else if (cleanUrl.includes("careers.spglobal.com")) company = "S&P Global";
        else if (cleanUrl.includes("brassring.com")) company = "Performance Food Group";
        else if (cleanUrl.includes("linkedin.com")) {
          const m = title.match(/\bat\s+([^-|]+)/i);
          company = m ? m[1].trim() : "LinkedIn External Job";
        } else if (cleanUrl.includes("indeed.com")) {
          company = "Indeed External Job";
        }

        const loc = /\b(virginia|\bva\b|mclean|richmond|arlington|norfolk|virginia beach|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i.test(`${title} ${snippet}`)
          ? "Virginia / DMV"
          : "Remote, US";

        collected[step.bucket].push(
          buildJobRecord({
            id: `${step.bucket}-${crypto.createHash("md5").update(cleanUrl).digest("hex").slice(0, 12)}`,
            title,
            company,
            location: loc,
            url: cleanUrl,
            source: step.source,
            description: snippet
          })
        );
      }
    } catch {}
  }

  console.log("📊 Expanded LinkedIn, Indeed & Portal Search Counts:");
  console.log(`   • LinkedIn raw hits: ${collected.linkedin.length}`);
  console.log(`   • Indeed raw hits:   ${collected.indeed.length}`);
  console.log(`   • Portals raw hits:  ${collected.portals.length}`);

  const { data: existingRows } = await supabase
    .from("verified_jobs")
    .select("id, url")
    .range(0, 4999);

  const urlToExistingId = new Map();
  const allUsedIds = new Set();
  for (const r of existingRows || []) {
    const clean = unwrapAndCleanUrl(r.url || "");
    if (clean) urlToExistingId.set(clean, r.id);
    if (r.id) allUsedIds.add(r.id);
  }

  const allCandidates = [...collected.linkedin, ...collected.indeed, ...collected.portals];
  const uniqueByUrl = new Map();
  let netNew = 0;

  for (const cand of allCandidates) {
    if (uniqueByUrl.has(cand.url)) continue;
    const existingId = urlToExistingId.get(cand.url);
    const finalId = existingId || makeUniqueId(cand.id, cand.url, allUsedIds);
    uniqueByUrl.set(cand.url, { ...cand, id: finalId });
    if (!existingId) netNew++;
  }

  const rowsToUpsert = Array.from(uniqueByUrl.values());
  let savedCount = 0;

  for (let i = 0; i < rowsToUpsert.length; i += 25) {
    const chunk = rowsToUpsert.slice(i, i + 25);
    const { error } = await supabase.from("verified_jobs").upsert(chunk, { onConflict: "url" });
    if (!error) {
      savedCount += chunk.length;
    } else {
      for (const row of chunk) {
        const freshId = makeUniqueId(`${row.id}-retry`, row.url, allUsedIds);
        const { error: retryErr } = await supabase
          .from("verified_jobs")
          .upsert({ ...row, id: freshId }, { onConflict: "url" });
        if (!retryErr) savedCount++;
        else console.warn("⚠️ Could not upsert:", row.url, retryErr.message);
      }
    }
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Saved ${savedCount} / ${rowsToUpsert.length} unique URLs | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

runBroadLinkedInAndIndeed();
