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
const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|chesterfield|richmond|norfolk|virginia beach|arlington|mclean|reston|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i;

const GREENHOUSE_BOARDS = [
  { slug: "affirm", name: "Affirm" },
  { slug: "capitalone", name: "Capital One" },
  { slug: "boozallen", name: "Booz Allen Hamilton" },
  { slug: "databricks", name: "Databricks" },
  { slug: "snowflake", name: "Snowflake" },
  { slug: "stripe", name: "Stripe" },
  { slug: "airbnb", name: "Airbnb" },
  { slug: "doordash", name: "DoorDash" },
  { slug: "instacart", name: "Instacart" },
  { slug: "robinhood", name: "Robinhood" },
  { slug: "coinbase", name: "Coinbase" },
  { slug: "figma", name: "Figma" },
  { slug: "discord", name: "Discord" },
  { slug: "twilio", name: "Twilio" },
  { slug: "okta", name: "Okta" },
  { slug: "cloudflare", name: "Cloudflare" },
  { slug: "zscaler", name: "Zscaler" },
  { slug: "hubspot", name: "HubSpot" },
  { slug: "wayfair", name: "Wayfair" },
  { slug: "chime", name: "Chime" },
  { slug: "plaid", name: "Plaid" },
  { slug: "uber", name: "Uber" },
  { slug: "lyft", name: "Lyft" },
  { slug: "pinterest", name: "Pinterest" },
  { slug: "reddit", name: "Reddit" },
  { slug: "dropbox", name: "Dropbox" },
  { slug: "asana", name: "Asana" },
  { slug: "elastic", name: "Elastic" },
  { slug: "mongodb", name: "MongoDB" },
  { slug: "confluent", name: "Confluent" },
  { slug: "rubrik", name: "Rubrik" },
  { slug: "samsara", name: "Samsara" },
  { slug: "toast", name: "Toast" },
  { slug: "brex", name: "Brex" },
  { slug: "gusto", name: "Gusto" },
  { slug: "sofi", name: "SoFi" },
  { slug: "rivian", name: "Rivian" },
  { slug: "scaleai", name: "Scale AI" },
  { slug: "anthropic", name: "Anthropic" },
  { slug: "openai", name: "OpenAI" },
  { slug: "block", name: "Block" },
  { slug: "duolingo", name: "Duolingo" },
  { slug: "etsy", name: "Etsy" },
  { slug: "chewy", name: "Chewy" },
  { slug: "axon", name: "Axon" },
  { slug: "coursera", name: "Coursera" },
  { slug: "zillow", name: "Zillow" },
  { slug: "upstart", name: "Upstart" },
  { slug: "oscar", name: "Oscar Health" },
  { slug: "docusign", name: "DocuSign" },
  { slug: "pagerduty", name: "PagerDuty" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "datadog", name: "Datadog" },
  { slug: "airtable", name: "Airtable" },
  { slug: "dbt-labs", name: "dbt Labs" },
  { slug: "fivetran", name: "Fivetran" }
];

const WORKDAY_TENANTS = [
  {
    company: "Owens & Minor",
    apiUrl: "https://owensminor.wd1.myworkdayjobs.com/wday/cxs/owensminor/OMCareers/jobs",
    baseSite: "https://owensminor.wd1.myworkdayjobs.com/en-US/OMCareers"
  }
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
    const trackingParams = [
      "gh_jid", "gh_src", "t", "source", "ss", "utm_source", "utm_medium",
      "utm_campaign", "utm_content", "utm_term", "gclid", "gad_source",
      "gad_campaignid", "trk", "refId", "trackingId", "RD"
    ];
    for (const p of trackingParams) u.searchParams.delete(p);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    const queryStr = u.searchParams.toString();
    return `${u.origin}${cleanPath}${queryStr ? `?${queryStr}` : ""}`;
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

async function fetchGreenhouse() {
  const out = [];
  await Promise.all(
    GREENHOUSE_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location?.name || "United States";
          const normalized = cleanUrl(j.absolute_url);
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !normalized) continue;
          out.push(
            toRow({
              id: `gh-${b.slug}-${j.id}`,
              reqId: String(j.id),
              title,
              company: b.name,
              location: loc,
              url: normalized,
              source: `${b.name} (Greenhouse ATS)`,
              description: (j.content || "").replace(/<[^>]+>/g, " ")
            })
          );
        }
      } catch {}
    })
  );
  return out;
}

async function fetchWorkday() {
  const out = [];
  for (const tenant of WORKDAY_TENANTS) {
    try {
      const res = await fetch(tenant.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20, offset: 0, searchText: "Data Analyst" })
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const posting of data.jobPostings || []) {
        const title = posting.title || "";
        const loc = posting.locationsText || "Virginia / Remote";
        if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
        if (!isAllowedLocation(loc) || !posting.externalPath) continue;
        const fullUrl = cleanUrl(`${tenant.baseSite}${posting.externalPath}`);
        if (!fullUrl) continue;
        out.push(
          toRow({
            id: `wd-${crypto.createHash("md5").update(fullUrl).digest("hex").slice(0, 12)}`,
            reqId: posting.bulletFields?.[0] || "WD",
            title,
            company: tenant.company,
            location: loc,
            url: fullUrl,
            source: `${tenant.company} (Workday)`,
            description: `${title} - ${loc}`
          })
        );
      }
    } catch {}
  }
  return out;
}

async function fetchSerpSources() {
  if (!serpApiKey) {
    console.log("ℹ️ SERPAPI_KEY not set — skipping LinkedIn, Indeed & corporate portal search queries.");
    return { linkedin: [], indeed: [], portals: [] };
  }

  const queries = [
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view ("Senior Data Analyst" OR "Data Analyst" OR "Analytics Engineer") (Virginia OR Remote)' },
    { bucket: "linkedin", source: "LinkedIn", q: 'site:linkedin.com/jobs/view ("Data Engineer" OR "Data Scientist" OR "Business Intelligence") (Virginia OR DMV OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob ("Senior Data Analyst" OR "Data Analyst" OR "Analytics Engineer") (Virginia OR Remote)' },
    { bucket: "indeed", source: "Indeed", q: 'site:indeed.com/viewjob ("Data Engineer" OR "Data Scientist" OR "Business Intelligence") (Virginia OR DMV OR Remote)' },
    { bucket: "portals", source: "Capital One Portal", q: 'site:capitalonecareers.com/job ("Data Analyst" OR "Data Scientist" OR "Analytics")' },
    { bucket: "portals", source: "McKesson Portal", q: 'site:careers.mckesson.com ("Data Analyst" OR "Data Scientist" OR "Analytics" OR "Data Engineer")' },
    { bucket: "portals", source: "Workday VA/Remote", q: 'site:myworkdayjobs.com ("Data Analyst" OR "Analytics Engineer" OR "Data Scientist") (Virginia OR Remote)' },
    { bucket: "portals", source: "S&P Global Portal", q: 'site:careers.spglobal.com ("Data Analyst" OR "Data Scientist" OR "Analytics")' },
    { bucket: "portals", source: "PFG Portal", q: 'site:sjobs.brassring.com "partnerid=26350" (data OR analyst OR analytics)' }
  ];

  const buckets = { linkedin: [], indeed: [], portals: [] };

  for (const item of queries) {
    try {
      const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(item.q)}&num=20&api_key=${serpApiKey}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.organic_results || []) {
        const normalized = cleanUrl(r.link);
        const title = r.title || "";
        const snippet = r.snippet || "";
        if (!normalized || !ROLE_REGEX.test(`${title} ${snippet}`) || EXCLUDE_REGEX.test(title)) continue;

        let company = item.source;
        if (normalized.includes("capitalonecareers.com")) company = "Capital One";
        else if (normalized.includes("careers.mckesson.com")) company = "McKesson";
        else if (normalized.includes("careers.spglobal.com")) company = "S&P Global";
        else if (normalized.includes("brassring.com")) company = "Performance Food Group";
        else if (normalized.includes("owensminor")) company = "Owens & Minor";
        else if (normalized.includes("linkedin.com")) {
          const m = title.match(/\bat\s+([^-|]+)/i);
          company = m ? m[1].trim() : "LinkedIn External Job";
        } else if (normalized.includes("indeed.com")) {
          company = "Indeed External Job";
        }

        const loc = /\b(virginia|\bva\b|chesterfield|mclean|richmond|arlington|norfolk|virginia beach|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i.test(`${title} ${snippet}`)
          ? "Virginia / DMV"
          : "Remote, US";

        buckets[item.bucket].push(
          toRow({
            id: `${item.bucket}-${crypto.createHash("md5").update(normalized).digest("hex").slice(0, 12)}`,
            title,
            company,
            location: loc,
            url: normalized,
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

  const [gh, wd, serp] = await Promise.all([
    fetchGreenhouse(),
    fetchWorkday(),
    fetchSerpSources()
  ]);

  console.log("📊 Source Discovery Counts:");
  console.log(`   • Greenhouse Boards:   ${gh.length}`);
  console.log(`   • Workday Portals:     ${wd.length}`);
  console.log(`   • LinkedIn (Indexed):  ${serp.linkedin.length}`);
  console.log(`   • Indeed (Indexed):    ${serp.indeed.length}`);
  console.log(`   • Enterprise Portals:  ${serp.portals.length}`);

  const all = [...gh, ...wd, ...serp.linkedin, ...serp.indeed, ...serp.portals];
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
        const retryId = makeUniqueId(`${single.id}-v2`, single.url, usedIds);
        const { error: sErr } = await supabase
          .from("verified_jobs")
          .upsert({ ...single, id: retryId }, { onConflict: "url" });
        if (!sErr) saved++;
        else console.warn("⚠️ Skipped row:", single.url, sErr.message);
      }
    }
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Upserted ${saved} / ${rows.length} unique URLs | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

run();
