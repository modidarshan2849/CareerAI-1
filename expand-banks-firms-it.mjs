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

const BANKS_FIRMS_IT_GH = [
  { slug: "marqeta", name: "Marqeta" },
  { slug: "brex", name: "Brex" },
  { slug: "chime", name: "Chime" },
  { slug: "affirm", name: "Affirm" },
  { slug: "sofi", name: "SoFi" },
  { slug: "robinhood", name: "Robinhood" },
  { slug: "coinbase", name: "Coinbase" },
  { slug: "plaid", name: "Plaid" },
  { slug: "stripe", name: "Stripe" },
  { slug: "upstart", name: "Upstart" },
  { slug: "docusign", name: "DocuSign" },
  { slug: "pagerduty", name: "PagerDuty" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "datadog", name: "Datadog" },
  { slug: "snowflake", name: "Snowflake" },
  { slug: "databricks", name: "Databricks" },
  { slug: "elastic", name: "Elastic" },
  { slug: "mongodb", name: "MongoDB" },
  { slug: "confluent", name: "Confluent" },
  { slug: "rubrik", name: "Rubrik" },
  { slug: "cloudflare", name: "Cloudflare" },
  { slug: "zscaler", name: "Zscaler" },
  { slug: "okta", name: "Okta" },
  { slug: "twilio", name: "Twilio" },
  { slug: "hubspot", name: "HubSpot" },
  { slug: "asana", name: "Asana" },
  { slug: "airtable", name: "Airtable" },
  { slug: "dbt-labs", name: "dbt Labs" },
  { slug: "fivetran", name: "Fivetran" },
  { slug: "cockroachlabs", name: "Cockroach Labs" },
  { slug: "starburstdata", name: "Starburst" },
  { slug: "boozallen", name: "Booz Allen Hamilton" },
  { slug: "capitalone", name: "Capital One" }
];

const BANKS_FIRMS_IT_SR = [
  { slug: "Visa", name: "Visa" },
  { slug: "PayPal", name: "PayPal" },
  { slug: "Equinix", name: "Equinix" },
  { slug: "ServiceNow", name: "ServiceNow" },
  { slug: "Autodesk", name: "Autodesk" },
  { slug: "Arm", name: "Arm" },
  { slug: "Broadcom", name: "Broadcom" },
  { slug: "WesternDigital", name: "Western Digital" }
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

function toRow({ id, reqId, title, company, location, url, source, description }) {
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
    company: company || "Enterprise Employer",
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

async function fetchBoards() {
  const out = [];
  await Promise.all([
    ...BANKS_FIRMS_IT_GH.map(async (b) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location?.name || "United States";
          const u = cleanUrl(j.absolute_url);
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title) || !isAllowedLocation(loc) || !u) continue;
          out.push(toRow({ id: `gh-${b.slug}-${j.id}`, reqId: String(j.id), title, company: b.name, location: loc, url: u, source: `${b.name} (Greenhouse ATS)`, description: (j.content || "").replace(/<[^>]+>/g, " ") }));
        }
      } catch {}
    }),
    ...BANKS_FIRMS_IT_SR.map(async (c) => {
      try {
        const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${c.slug}/postings?limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        for (const p of data.content || []) {
          const title = p.name || "";
          const loc = [p.location?.city, p.location?.region, p.location?.country].filter(Boolean).join(", ") || "United States";
          const u = cleanUrl(`https://jobs.smartrecruiters.com/${c.slug}/${p.id}`);
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title) || !isAllowedLocation(loc) || !u) continue;
          out.push(toRow({ id: `sr-${c.slug.toLowerCase()}-${p.id}`, reqId: String(p.id), title, company: c.name, location: loc, url: u, source: `${c.name} (SmartRecruiters)`, description: `${title} at ${c.name} (${loc})` }));
        }
      } catch {}
    })
  ]);
  return out;
}

async function fetchBanksFirmsLinkedInIndeed() {
  if (!serpApiKey) return [];
  const queries = [
    'site:linkedin.com/jobs/view "Senior Data Analyst" (JPMorgan OR Citi OR "Goldman Sachs" OR "Morgan Stanley" OR "Wells Fargo" OR "Bank of America")',
    'site:linkedin.com/jobs/view "Senior Data Analyst" (Deloitte OR PwC OR EY OR KPMG OR Accenture)',
    'site:linkedin.com/jobs/view "Senior Data Analyst" (Virginia OR "Washington, DC" OR Remote)',
    'site:indeed.com/viewjob "Senior Data Analyst" (Virginia OR "Washington, DC" OR Remote)',
    'site:indeed.com/viewjob "Senior Data Analyst" (bank OR financial OR consulting OR technology)'
  ];

  const resultsList = [];
  for (const q of queries) {
    try {
      const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=20&api_key=${serpApiKey}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.organic_results || []) {
        const u = cleanUrl(r.link);
        const title = r.title || "";
        const snippet = r.snippet || "";
        if (!u || !ROLE_REGEX.test(`${title} ${snippet}`) || EXCLUDE_REGEX.test(title)) continue;
        const isLinkedIn = u.includes("linkedin.com");
        const isIndeed = u.includes("indeed.com");
        const companyMatch = title.match(/\bat\s+([^-|]+)/i);
        const company = companyMatch ? companyMatch[1].trim() : (isLinkedIn ? "LinkedIn Employer" : isIndeed ? "Indeed Employer" : "Enterprise Employer");
        const loc = /\b(virginia|\bva\b|mclean|richmond|arlington|norfolk|virginia beach|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i.test(`${title} ${snippet}`)
          ? "Virginia / DMV"
          : "Remote, US";
        resultsList.push(
          toRow({
            id: `${isLinkedIn ? "li" : isIndeed ? "ind" : "ext"}-${crypto.createHash("md5").update(u).digest("hex").slice(0, 12)}`,
            title,
            company,
            location: loc,
            url: u,
            source: isLinkedIn ? "LinkedIn" : isIndeed ? "Indeed" : "Enterprise Search",
            description: snippet
          })
        );
      }
    } catch {}
  }
  return resultsList;
}

async function run() {
  const { data: existingRows } = await supabase.from("verified_jobs").select("id, url").range(0, 4999);
  const urlToId = new Map();
  const usedIds = new Set();
  for (const r of existingRows || []) {
    const c = cleanUrl(r.url || "");
    if (c) urlToId.set(c, r.id);
    if (r.id) usedIds.add(r.id);
  }

  const [boardJobs, searchJobs] = await Promise.all([fetchBoards(), fetchBanksFirmsLinkedInIndeed()]);
  const merged = [...boardJobs, ...searchJobs];
  const dedup = new Map();
  let netNew = 0;

  for (const item of merged) {
    if (!item.url || dedup.has(item.url)) continue;
    const existingId = urlToId.get(item.url);
    const id = existingId || makeUniqueId(item.id, item.url, usedIds);
    dedup.set(item.url, { ...item, id });
    if (!existingId) netNew++;
  }

  const rows = Array.from(dedup.values());
  let saved = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (!error) {
      saved += batch.length;
    } else {
      for (const s of batch) {
        const retryId = makeUniqueId(`${s.id}-b`, s.url, usedIds);
        const { error: sErr } = await supabase.from("verified_jobs").upsert({ ...s, id: retryId }, { onConflict: "url" });
        if (!sErr) saved++;
      }
    }
  }

  const { count } = await supabase.from("verified_jobs").select("*", { count: "exact", head: true }).eq("is_active", true);
  console.log(`📊 Board matches: ${boardJobs.length} | LinkedIn/Indeed/Firm hits: ${searchJobs.length}`);
  console.log(`✅ Upserted ${saved} / ${rows.length} unique URLs | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

run();
