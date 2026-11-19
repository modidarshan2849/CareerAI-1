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

const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|bi engineer|analytics engineer|data scientist|decision science|decision scientist|product analyst|marketing analyst|financial analyst|operations analyst|operations research|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|sr\.?\s*(data|bi|analytics)|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor)\b/i;
const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|chesterfield|richmond|norfolk|virginia beach|arlington|mclean|reston|tysons|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i;

const SMARTRECRUITERS_COMPANIES = [
  { slug: "Visa", name: "Visa" },
  { slug: "Equinix", name: "Equinix" },
  { slug: "ServiceNow", name: "ServiceNow" },
  { slug: "LinkedIn", name: "LinkedIn" },
  { slug: "Autodesk", name: "Autodesk" },
  { slug: "Arm", name: "Arm" },
  { slug: "Broadcom", name: "Broadcom" },
  { slug: "PayPal", name: "PayPal" },
  { slug: "WesternDigital", name: "Western Digital" },
  { slug: "Sodexo", name: "Sodexo" }
];

const EXTRA_LEVER_BOARDS = [
  { slug: "palantir", name: "Palantir Technologies" },
  { slug: "netflix", name: "Netflix" },
  { slug: "spotify", name: "Spotify" },
  { slug: "atlassian", name: "Atlassian" },
  { slug: "verkada", name: "Verkada" },
  { slug: "anduril", name: "Anduril Industries" },
  { slug: "shieldai", name: "Shield AI" },
  { slug: "zoox", name: "Zoox" },
  { slug: "flexport", name: "Flexport" },
  { slug: "benchling", name: "Benchling" },
  { slug: "wealthfront", name: "Wealthfront" },
  { slug: "sentry", name: "Sentry" },
  { slug: "grammarly", name: "Grammarly" },
  { slug: "thumbtack", name: "Thumbtack" }
];

const EXTRA_ASHBY_BOARDS = [
  { slug: "ramp", name: "Ramp" },
  { slug: "notion", name: "Notion" },
  { slug: "linear", name: "Linear" },
  { slug: "retool", name: "Retool" },
  { slug: "deel", name: "Deel" },
  { slug: "vanta", name: "Vanta" },
  { slug: "posthog", name: "PostHog" },
  { slug: "supabase", name: "Supabase" },
  { slug: "modal", name: "Modal" },
  { slug: "cohere", name: "Cohere" },
  { slug: "perplexity", name: "Perplexity AI" },
  { slug: "harvey", name: "Harvey" },
  { slug: "clay", name: "Clay" },
  { slug: "hex", name: "Hex" },
  { slug: "hightouch", name: "Hightouch" },
  { slug: "montecarlodata", name: "Monte Carlo" },
  { slug: "airbyte", name: "Airbyte" },
  { slug: "dagster", name: "Dagster Labs" },
  { slug: "astronomer", name: "Astronomer" }
];

function cleanUrl(rawUrl) {
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
    const tracking = [
      "gh_jid", "gh_src", "t", "source", "ss", "utm_source", "utm_medium",
      "utm_campaign", "utm_content", "utm_term", "gclid", "gad_source",
      "gad_campaignid", "trk", "refId", "trackingId", "RD", "eBP"
    ];
    for (const p of tracking) u.searchParams.delete(p);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    const qs = u.searchParams.toString();
    return `${u.origin}${cleanPath}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

function isAllowedLocation(loc) {
  if (!loc) return true;
  if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) return false;
  return true;
}

function makeUniqueId(baseId, url, usedIds) {
  let candidate = (baseId || "job").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
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

function toRow({ id, reqId, title, company, location, url, source, description, salaryRange }) {
  const isRemote = /remote|anywhere|united states|usa/i.test(`${location || ""} ${title || ""}`);
  const isVA = /\b(va|virginia|chesterfield|richmond|norfolk|virginia beach|arlington|mclean|reston|tysons|washington,\s*dc|dc|maryland|md)\b/i.test(`${location || ""} ${description || ""}`);
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
    salary_range: salaryRange || "$135,000 - $185,000 / yr",
    source,
    description: (description || "").slice(0, 3200),
    is_active: true,
    last_verified_at: new Date().toISOString()
  };
}

async function fetchSmartRecruiters() {
  const out = [];
  await Promise.all(
    SMARTRECRUITERS_COMPANIES.map(async (c) => {
      try {
        const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${c.slug}/postings?limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        for (const p of data.content || []) {
          const title = p.name || "";
          const loc = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", ") || "United States";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc)) continue;
          const jobUrl = cleanUrl(`https://jobs.smartrecruiters.com/${c.slug}/${p.id}`);
          if (!jobUrl) continue;
          out.push(
            toRow({
              id: `sr-${c.slug.toLowerCase()}-${p.id}`,
              reqId: String(p.id),
              title,
              company: c.name,
              location: loc,
              url: jobUrl,
              source: `${c.name} (SmartRecruiters)`,
              description: `${title} at ${c.name} (${loc})`
            })
          );
        }
      } catch {}
    })
  );
  return out;
}

async function fetchLever() {
  const out = [];
  await Promise.all(
    EXTRA_LEVER_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${b.slug}?mode=json`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data || []) {
          const title = j.text || "";
          const loc = j.categories?.location || "United States";
          const u = cleanUrl(j.hostedUrl);
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !u) continue;
          out.push(
            toRow({
              id: `lever-${b.slug}-${j.id}`,
              reqId: String(j.id).slice(0, 16),
              title,
              company: b.name,
              location: loc,
              url: u,
              source: `${b.name} (Lever ATS)`,
              description: j.descriptionPlain || ""
            })
          );
        }
      } catch {}
    })
  );
  return out;
}

async function fetchAshby() {
  const out = [];
  await Promise.all(
    EXTRA_ASHBY_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${b.slug}`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location || (j.isRemote ? "Remote, US" : "United States");
          const u = cleanUrl(j.jobUrl || j.applyUrl);
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !u) continue;
          out.push(
            toRow({
              id: `ashby-${b.slug}-${j.id}`,
              reqId: String(j.id).slice(0, 18),
              title,
              company: b.name,
              location: loc,
              url: u,
              source: `${b.name} (Ashby ATS)`,
              description: (j.descriptionPlain || j.descriptionHtml || "").replace(/<[^>]+>/g, " "),
              salaryRange: j.compensationTierSummary
            })
          );
        }
      } catch {}
    })
  );
  return out;
}

async function fetchTargetedSerp() {
  if (!serpApiKey) return { linkedin: [], indeed: [], portals: [] };

  const queries = [
    // More LinkedIn queries
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Lead Data Analyst" (Virginia OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Principal Data Analyst" (Virginia OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Data Analyst" (McLean OR Richmond OR Arlington OR Reston)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view "Data Engineer" (McLean OR Richmond OR Arlington OR Remote)' },

    // More Indeed queries
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Lead Data Analyst" (Virginia OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Data Analyst" (McLean OR Richmond OR Arlington OR Chesterfield)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob "Data Engineer" (McLean OR Richmond OR Arlington OR Remote)' },

    // Target enterprise portals + Fortune 500
    { bucket: "portals", source: "Capital One Portal", q: 'site:capitalonecareers.com/job (McLean OR Richmond OR Remote) (data OR analyst OR analytics)' },
    { bucket: "portals", source: "S&P Global Portal", q: 'site:careers.spglobal.com (data OR analyst OR analytics OR science)' },
    { bucket: "portals", source: "PFG Portal", q: 'site:sjobs.brassring.com "partnerid=26350" (data OR analyst OR analytics OR supply)' },
    { bucket: "portals", source: "Fortune 500 Workday", q: 'site:myworkdayjobs.com ("Senior Data Analyst" OR "Data Engineer" OR "Analytics Engineer") Virginia' }
  ];

  const buckets = { linkedin: [], indeed: [], portals: [] };

  for (const item of queries) {
    try {
      const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(item.q)}&num=20&api_key=${serpApiKey}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.organic_results || []) {
        const u = cleanUrl(r.link);
        const title = r.title || "";
        const snippet = r.snippet || "";
        if (!u || !ROLE_REGEX.test(`${title} ${snippet}`) || EXCLUDE_REGEX.test(title)) continue;

        let company = item.source;
        if (u.includes("capitalonecareers.com")) company = "Capital One";
        else if (u.includes("careers.spglobal.com")) company = "S&P Global";
        else if (u.includes("brassring.com")) company = "Performance Food Group";
        else if (u.includes("linkedin.com")) {
          const m = title.match(/\bat\s+([^-|]+)/i);
          company = m ? m[1].trim() : "LinkedIn External Job";
        } else if (u.includes("indeed.com")) {
          company = "Indeed External Job";
        }

        const loc = /\b(virginia|\bva\b|chesterfield|mclean|richmond|arlington|norfolk|virginia beach|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i.test(`${title} ${snippet}`)
          ? "Virginia / DMV"
          : "Remote, US";

        buckets[item.bucket].push(
          toRow({
            id: `${item.bucket}-${crypto.createHash("md5").update(u).digest("hex").slice(0, 12)}`,
            title,
            company,
            location: loc,
            url: u,
            source: item.source,
            description: snippet
          })
        );
      }
    } catch {}
  }

  return buckets;
}

async function run() {
  const { data: existingRows } = await supabase
    .from("verified_jobs")
    .select("id, url")
    .range(0, 4999);

  const urlToId = new Map();
  const usedIds = new Set();
  for (const r of existingRows || []) {
    const cUrl = cleanUrl(r.url || "");
    if (cUrl) urlToId.set(cUrl, r.id);
    if (r.id) usedIds.add(r.id);
  }

  const [sr, lever, ashby, serp] = await Promise.all([
    fetchSmartRecruiters(),
    fetchLever(),
    fetchAshby(),
    fetchTargetedSerp()
  ]);

  console.log("📊 Additional Source Counts:");
  console.log(`   • SmartRecruiters (${SMARTRECRUITERS_COMPANIES.length} cos): ${sr.length}`);
  console.log(`   • Extra Lever (${EXTRA_LEVER_BOARDS.length} boards):        ${lever.length}`);
  console.log(`   • Extra Ashby (${EXTRA_ASHBY_BOARDS.length} boards):        ${ashby.length}`);
  console.log(`   • LinkedIn (extra queries):     ${serp.linkedin.length}`);
  console.log(`   • Indeed (extra queries):       ${serp.indeed.length}`);
  console.log(`   • Target/F500 Portals:          ${serp.portals.length}`);

  const all = [...sr, ...lever, ...ashby, ...serp.linkedin, ...serp.indeed, ...serp.portals];
  const uniqueByUrl = new Map();
  let netNew = 0;

  for (const cand of all) {
    const cUrl = cleanUrl(cand.url);
    if (!cUrl || uniqueByUrl.has(cUrl)) continue;
    const existingId = urlToId.get(cUrl);
    const finalId = existingId || makeUniqueId(cand.id, cUrl, usedIds);
    uniqueByUrl.set(cUrl, { ...cand, id: finalId, url: cUrl });
    if (!existingId) netNew++;
  }

  const rows = Array.from(uniqueByUrl.values());
  let saved = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (!error) {
      saved += batch.length;
    } else {
      for (const single of batch) {
        const retryId = makeUniqueId(`${single.id}-ext`, single.url, usedIds);
        const { error: sErr } = await supabase
          .from("verified_jobs")
          .upsert({ ...single, id: retryId }, { onConflict: "url" });
        if (!sErr) saved++;
      }
    }
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Saved ${saved} / ${rows.length} unique URLs | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

run();
