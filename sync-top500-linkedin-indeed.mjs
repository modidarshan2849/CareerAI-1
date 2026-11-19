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
const serpApiKey = process.env.SERPAPI_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor)\b/i;
const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i;

const ENTERPRISE_GH_SLUGS = [
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
  { slug: "affirm", name: "Affirm" },
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
  { slug: "netlify", name: "Netlify" },
  { slug: "oscar", name: "Oscar Health" },
  { slug: "docusign", name: "DocuSign" },
  { slug: "pagerduty", name: "PagerDuty" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "datadog", name: "Datadog" },
  { slug: "airtable", name: "Airtable" },
  { slug: "dbt-labs", name: "dbt Labs" },
  { slug: "fivetran", name: "Fivetran" }
];

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
    for (const p of ["gh_jid", "t", "gh_src", "utm_source", "utm_medium", "utm_campaign", "gclid", "gad_source"]) {
      u.searchParams.delete(p);
    }
    const cleanPath = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${cleanPath}${u.search}`;
  } catch {
    return null;
  }
}

function isAllowedLocation(loc) {
  if (!loc) return true;
  if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) return false;
  return true;
}

function makeRecord({ id, reqId, title, company, location, url, source, description }) {
  const isRemote = /remote|anywhere|united states|usa/i.test(location || "");
  const isVA = /\b(va|virginia|virginia beach|norfolk|richmond|arlington|mclean|reston|washington,\s*dc|dc|maryland|md)\b/i.test(location || "");
  return {
    id,
    req_id: reqId || "EXT",
    title: (title || "").replace(/\s*\|\s*LinkedIn.*$/i, "").replace(/\s*-\s*Indeed.*$/i, "").trim(),
    company: company || "Enterprise Employer",
    location: location || "United States / Remote",
    url,
    score: 88,
    is_remote: isRemote,
    miles_from_home: isVA ? 25 : isRemote ? 0 : 180,
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

async function fetchEnterpriseGreenhouse() {
  const out = [];
  await Promise.all(
    ENTERPRISE_GH_SLUGS.map(async (b) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location?.name || "United States";
          const cleanUrl = unwrapAndCleanUrl(j.absolute_url);
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !cleanUrl) continue;
          out.push(
            makeRecord({
              id: `gh-${b.slug}-${j.id}`,
              reqId: String(j.id),
              title,
              company: b.name,
              location: loc,
              url: cleanUrl,
              source: `${b.name} (Enterprise ATS)`,
              description: (j.content || "").replace(/<[^>]+>/g, " ")
            })
          );
        }
      } catch {}
    })
  );
  return out;
}

async function fetchSerpJobs() {
  if (!serpApiKey) {
    console.log("ℹ️ SERPAPI_KEY not set — skipping LinkedIn, Indeed, Capital One, S&P Global & BrassRing search queries.");
    return { linkedin: [], indeed: [], portals: [] };
  }

  const queryGroups = [
    {
      bucket: "linkedin",
      source: "LinkedIn (Indexed)",
      queries: [
        'site:linkedin.com/jobs/view ("Senior Data Analyst" OR "Data Analyst" OR "Analytics Engineer" OR "Data Scientist") (Virginia OR "Washington, DC" OR Remote)',
        'site:linkedin.com/jobs/view ("Data Engineer" OR "Business Intelligence") (Virginia OR DMV OR Remote)'
      ]
    },
    {
      bucket: "indeed",
      source: "Indeed (Indexed)",
      queries: [
        'site:indeed.com/viewjob ("Senior Data Analyst" OR "Data Analyst" OR "Analytics Engineer" OR "Data Scientist") (Virginia OR "Washington, DC" OR Remote)',
        'site:indeed.com/viewjob ("Data Engineer" OR "Business Intelligence") (Virginia OR DMV OR Remote)'
      ]
    },
    {
      bucket: "portals",
      source: "Enterprise Career Portal",
      queries: [
        'site:capitalonecareers.com/job ("Data Analyst" OR "Data Scientist" OR "Analytics")',
        'site:careers.spglobal.com ("Data Analyst" OR "Data Scientist" OR "Analytics")',
        'site:sjobs.brassring.com "partnerid=26350" "siteid=6930" (data OR analyst OR analytics)'
      ]
    }
  ];

  const buckets = { linkedin: [], indeed: [], portals: [] };

  for (const group of queryGroups) {
    for (const q of group.queries) {
      try {
        const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=20&api_key=${serpApiKey}`);
        if (!res.ok) continue;
        const data = await res.json();
        for (const r of data.organic_results || []) {
          const cleanUrl = unwrapAndCleanUrl(r.link);
          const title = r.title || "";
          if (!cleanUrl || !ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;

          let company = group.source;
          if (cleanUrl.includes("capitalonecareers.com")) company = "Capital One";
          else if (cleanUrl.includes("careers.spglobal.com")) company = "S&P Global";
          else if (cleanUrl.includes("brassring.com")) company = "Performance Food Group";
          else if (cleanUrl.includes("linkedin.com")) {
            const atMatch = title.match(/\bat\s+([^-|]+)/i);
            company = atMatch ? atMatch[1].trim() : "LinkedIn Vacancy";
          } else if (cleanUrl.includes("indeed.com")) {
            company = "Indeed Vacancy";
          }

          const loc = /virginia|\bva\b|mclean|richmond|arlington|norfolk|washington,\s*dc|\bdc\b/i.test(`${title} ${r.snippet || ""}`)
            ? "Virginia / DMV"
            : "United States / Remote";

          buckets[group.bucket].push(
            makeRecord({
              id: `${group.bucket}-${Buffer.from(cleanUrl).toString("base64url").slice(-12)}`,
              title,
              company,
              location: loc,
              url: cleanUrl,
              source: group.source,
              description: r.snippet || ""
            })
          );
        }
      } catch {}
    }
  }

  return buckets;
}

async function run() {
  const { data: existingRows } = await supabase
    .from("verified_jobs")
    .select("id, url")
    .range(0, 4999);

  const urlToId = new Map();
  const idToUrl = new Map();
  for (const r of existingRows || []) {
    const norm = unwrapAndCleanUrl(r.url || "");
    if (norm) urlToId.set(norm, r.id);
    if (r.id) idToUrl.set(r.id, norm || (r.url || "").trim());
  }

  const [ghRows, serp] = await Promise.all([
    fetchEnterpriseGreenhouse(),
    fetchSerpJobs()
  ]);

  console.log("📊 Source Discovery Counts:");
  console.log(`   • Enterprise ATS Boards: ${ghRows.length}`);
  console.log(`   • LinkedIn (Indexed):    ${serp.linkedin.length}`);
  console.log(`   • Indeed (Indexed):      ${serp.indeed.length}`);
  console.log(`   • Target Portals:        ${serp.portals.length}`);

  const combined = [...ghRows, ...serp.linkedin, ...serp.indeed, ...serp.portals];
  const dedup = new Map();
  const usedIds = new Set();
  let netNew = 0;

  for (const item of combined) {
    const cleanUrl = unwrapAndCleanUrl(item.url);
    if (!cleanUrl || dedup.has(cleanUrl)) continue;

    let safeId = urlToId.get(cleanUrl) || item.id;
    const ownerUrl = idToUrl.get(safeId);
    if ((ownerUrl && ownerUrl !== cleanUrl) || usedIds.has(safeId)) {
      safeId = `${item.id}-${Buffer.from(cleanUrl).toString("base64url").slice(-10)}`;
    }
    usedIds.add(safeId);

    dedup.set(cleanUrl, { ...item, id: safeId, url: cleanUrl });
    if (!urlToId.has(cleanUrl)) netNew++;
  }

  const rows = Array.from(dedup.values());
  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (!error) {
      saved += batch.length;
    } else {
      for (const single of batch) {
        const { error: sErr } = await supabase.from("verified_jobs").upsert(single, { onConflict: "url" });
        if (!sErr) saved++;
        else console.warn("⚠️ Skipped conflicting row:", single.url, sErr.message);
      }
    }
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Upserted ${saved} / ${rows.length} deduplicated rows | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

run();
