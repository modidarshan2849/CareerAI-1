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
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor)\b/i;
const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i;

const GREENHOUSE_SLUGS = [
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

const LEVER_SLUGS = [
  { slug: "palantir", name: "Palantir Technologies" },
  { slug: "netflix", name: "Netflix" },
  { slug: "spotify", name: "Spotify" },
  { slug: "atlassian", name: "Atlassian" },
  { slug: "rokt", name: "Rokt" },
  { slug: "verkada", name: "Verkada" },
  { slug: "anduril", name: "Anduril Industries" },
  { slug: "shieldai", name: "Shield AI" },
  { slug: "zoox", name: "Zoox" },
  { slug: "flexport", name: "Flexport" },
  { slug: "includedhealth", name: "Included Health" },
  { slug: "omadahealth", name: "Omada Health" },
  { slug: "benchling", name: "Benchling" },
  { slug: "wealthfront", name: "Wealthfront" },
  { slug: "sentry", name: "Sentry" },
  { slug: "grammarly", name: "Grammarly" },
  { slug: "thumbtack", name: "Thumbtack" }
];

const ASHBY_SLUGS = [
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
  { slug: "census", name: "Census" },
  { slug: "hightouch", name: "Hightouch" },
  { slug: "montecarlodata", name: "Monte Carlo" },
  { slug: "airbyte", name: "Airbyte" },
  { slug: "dagster", name: "Dagster Labs" },
  { slug: "astronomer", name: "Astronomer" }
];

function isAllowedLocation(loc) {
  if (!loc) return true;
  if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) return false;
  return true;
}

function toRecord({ id, reqId, title, company, location, url, source, description, salaryRange }) {
  const isRemote = /remote|anywhere|united states|usa/i.test(location || "");
  const isVA = /\b(va|virginia|virginia beach|norfolk|richmond|arlington|mclean|reston|washington,\s*dc|dc|maryland|md)\b/i.test(location || "");
  return {
    id,
    req_id: reqId || "REQ",
    title,
    company,
    location: location || "United States",
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
    salary_range: salaryRange || "$135,000 - $185,000 / yr",
    source,
    description: (description || "").slice(0, 3200),
    is_active: true,
    last_verified_at: new Date().toISOString()
  };
}

async function fetchGreenhouse() {
  const out = [];
  await Promise.all(
    GREENHOUSE_SLUGS.map(async (b) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location?.name || "United States";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !j.absolute_url?.startsWith("https://")) continue;
          out.push(
            toRecord({
              id: `gh-${b.slug}-${j.id}`,
              reqId: String(j.id),
              title,
              company: b.name,
              location: loc,
              url: j.absolute_url.split("?")[0],
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

async function fetchLever() {
  const out = [];
  await Promise.all(
    LEVER_SLUGS.map(async (b) => {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${b.slug}?mode=json`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data || []) {
          const title = j.text || "";
          const loc = j.categories?.location || "United States";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !j.hostedUrl?.startsWith("https://")) continue;
          out.push(
            toRecord({
              id: `lever-${b.slug}-${j.id}`,
              reqId: String(j.id).slice(0, 16),
              title,
              company: b.name,
              location: loc,
              url: j.hostedUrl.split("?")[0],
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
    ASHBY_SLUGS.map(async (b) => {
      try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${b.slug}`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location || (j.isRemote ? "Remote, US" : "United States");
          const url = j.jobUrl || j.applyUrl;
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isAllowedLocation(loc) || !url?.startsWith("https://")) continue;
          out.push(
            toRecord({
              id: `ashby-${b.slug}-${j.id}`,
              reqId: String(j.id).slice(0, 18),
              title,
              company: b.name,
              location: loc,
              url: url.split("?")[0],
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
      if (!isAllowedLocation(loc) || !j.url?.startsWith("https://")) continue;
      out.push(
        toRecord({
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
      const applyUrl = item.apply_url || item.url;
      if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
      if (!isAllowedLocation(loc) || !applyUrl?.startsWith("https://")) continue;
      out.push(
        toRecord({
          id: `remoteok-${item.id || Buffer.from(applyUrl).toString("base64url").slice(-10)}`,
          title,
          company: item.company || "Remote Employer",
          location: loc,
          url: applyUrl.split("?")[0],
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

async function main() {
  const { data: existingRows } = await supabase.from("verified_jobs").select("id, url").range(0, 4999);
  const urlToId = new Map();
  const existingIds = new Set();
  for (const r of existingRows || []) {
    const norm = (r.url || "").replace(/\/$/, "");
    if (norm) urlToId.set(norm, r.id);
    if (r.id) existingIds.add(r.id);
  }

  const [gh, lever, ashby, arbeitnow, remoteok] = await Promise.all([
    fetchGreenhouse(),
    fetchLever(),
    fetchAshby(),
    fetchArbeitnow(),
    fetchRemoteOK()
  ]);

  console.log("📊 Source Breakdown:");
  console.log(`   • Greenhouse (${GREENHOUSE_SLUGS.length} boards): ${gh.length}`);
  console.log(`   • Lever (${LEVER_SLUGS.length} boards):            ${lever.length}`);
  console.log(`   • Ashby (${ASHBY_SLUGS.length} boards):            ${ashby.length}`);
  console.log(`   • Arbeitnow:                      ${arbeitnow.length}`);
  console.log(`   • RemoteOK:                       ${remoteok.length}`);

  const idToUrl = new Map();
  for (const r of existingRows || []) {
    if (r.id) idToUrl.set(r.id, (r.url || "").replace(/\/$/, ""));
  }

  const merged = [...gh, ...lever, ...ashby, ...arbeitnow, ...remoteok];
  const dedup = new Map();
  const usedIds = new Set();
  let netNew = 0;

  for (const item of merged) {
    const normUrl = item.url.replace(/\/$/, "");
    if (dedup.has(normUrl)) continue;

    let safeId = urlToId.get(normUrl) || item.id;
    const ownerUrl = idToUrl.get(safeId);
    const idTakenByDifferentUrl = ownerUrl && ownerUrl !== normUrl;
    if (idTakenByDifferentUrl || usedIds.has(safeId)) {
      safeId = `${item.id}-${Buffer.from(normUrl).toString("base64url").slice(-10)}`;
    }
    usedIds.add(safeId);

    dedup.set(normUrl, { ...item, id: safeId, url: normUrl });
    if (!urlToId.has(normUrl)) netNew++;
  }

  const rows = Array.from(dedup.values());
  let savedRows = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (!error) {
      savedRows += batch.length;
    } else {
      for (const single of batch) {
        const { error: singleErr } = await supabase.from("verified_jobs").upsert(single, { onConflict: "url" });
        if (!singleErr) savedRows++;
        else console.error("⚠️ Skipped single row:", single.url, singleErr.message);
      }
    }
  }
  console.log(`💾 Successfully upserted ${savedRows} / ${rows.length} deduplicated rows.`);

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Deduplicated candidates: ${rows.length} | Net-new added: +${netNew} | Total active in DB: ${count}`);
}

main();
