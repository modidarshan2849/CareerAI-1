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

// Expanded public Greenhouse & Lever boards to broaden Fortune 500 / enterprise coverage
const EXTRA_GREENHOUSE = [
  { slug: "axon", name: "Axon" },
  { slug: "coursera", name: "Coursera" },
  { slug: "zillow", name: "Zillow" },
  { slug: "upstart", name: "Upstart" },
  { slug: "netlify", name: "Netlify" },
  { slug: "oscar", name: "Oscar Health" },
  { slug: "xai", name: "xAI" },
  { slug: "polymarket", name: "Polymarket" },
  { slug: "docusign", name: "DocuSign" },
  { slug: "pagerduty", name: "PagerDuty" },
  { slug: "gitlab", name: "GitLab" },
  { slug: "datadog", name: "Datadog" },
  { slug: "benchling", name: "Benchling" },
  { slug: "airtable", name: "Airtable" },
  { slug: "cockroachlabs", name: "Cockroach Labs" },
  { slug: "dbt-labs", name: "dbt Labs" },
  { slug: "fivetran", name: "Fivetran" },
  { slug: "starburstdata", name: "Starburst" },
  { slug: "imply", name: "Imply" },
  { slug: "rockset", name: "Rockset" }
];

const EXTRA_LEVER = [
  { slug: "samsara", name: "Samsara" },
  { slug: "sentry", name: "Sentry" },
  { slug: "figma", name: "Figma" },
  { slug: "color", name: "Color Health" },
  { slug: "coursera", name: "Coursera" },
  { slug: "grammarly", name: "Grammarly" },
  { slug: "thumbtack", name: "Thumbtack" },
  { slug: "creditkarma", name: "Credit Karma" }
];

function normalizeRow(item) {
  const isRemote = /remote|anywhere|united states|usa/i.test(item.location || "");
  const isVA = /\b(va|virginia|virginia beach|norfolk|richmond|arlington|mclean|reston|washington,\s*dc|dc)\b/i.test(item.location || "");
  return {
    id: item.id,
    req_id: item.req_id || "REQ",
    title: item.title,
    company: item.company,
    location: item.location || "United States",
    url: item.url,
    score: item.score || 88,
    is_remote: isRemote,
    miles_from_home: isVA ? 25 : isRemote ? 0 : 180,
    work_mode: isRemote ? "Remote" : "Hybrid",
    zone: isVA ? "Virginia / DMV" : isRemote ? "US Remote" : "US National",
    sponsorship_status: item.sponsorship_status || "Not Specified / Open",
    sponsorship_code: item.sponsorship_code || "NOT_SPECIFIED",
    posted_label: item.posted_label || "Recent",
    last_date: "Rolling / Until Filled",
    keywords: item.keywords || ["SQL", "Python", "Analytics"],
    salary_range: item.salary_range || "$135,000 - $185,000 / yr",
    source: item.source,
    description: (item.description || "").slice(0, 3200),
    is_active: true,
    last_verified_at: new Date().toISOString()
  };
}

async function fetchExtraGreenhouse() {
  const out = [];
  await Promise.all(
    EXTRA_GREENHOUSE.map(async (b) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!j.absolute_url?.startsWith("https://")) continue;
          out.push(
            normalizeRow({
              id: `gh-ext-${b.slug}-${j.id}`,
              req_id: String(j.id),
              title,
              company: b.name,
              location: j.location?.name || "United States",
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

async function fetchExtraLever() {
  const out = [];
  await Promise.all(
    EXTRA_LEVER.map(async (b) => {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${b.slug}?mode=json`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data || []) {
          const title = j.text || "";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!j.hostedUrl?.startsWith("https://")) continue;
          out.push(
            normalizeRow({
              id: `lever-ext-${b.slug}-${j.id}`,
              req_id: String(j.id).slice(0, 16),
              title,
              company: b.name,
              location: j.categories?.location || "United States",
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

// Optional SerpApi discovery for Performance Food Group (BrassRing), Capital One & S&P Global
async function fetchTargetedPortalSearch() {
  if (!process.env.SERPAPI_KEY) {
    console.log("ℹ️ SERPAPI_KEY not set in .env.local — skipping SERP search for BrassRing (PFG), Capital One & S&P Global.");
    return [];
  }
  const queries = [
    'site:sjobs.brassring.com "partnerid=26350" "siteid=6930" (analyst OR data OR analytics)',
    'site:capitalonecareers.com/job ("Data Analyst" OR "Data Scientist" OR "Analytics")',
    'site:careers.spglobal.com ("Data Analyst" OR "Data Scientist" OR "Analytics")'
  ];
  const out = [];
  for (const q of queries) {
    try {
      const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=20&api_key=${process.env.SERPAPI_KEY}`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data.organic_results || []) {
        if (!r.link?.startsWith("https://")) continue;
        const company = r.link.includes("brassring.com")
          ? "Performance Food Group"
          : r.link.includes("capitalonecareers.com")
          ? "Capital One"
          : "S&P Global";
        out.push(
          normalizeRow({
            id: `portal-${Buffer.from(r.link).toString("base64url").slice(-12)}`,
            title: r.title || "Data & Analytics Role",
            company,
            location: "United States / Remote",
            url: r.link,
            source: `${company} Career Portal`,
            description: r.snippet || ""
          })
        );
      }
    } catch {}
  }
  return out;
}

async function run() {
  const { data: existing } = await supabase.from("verified_jobs").select("url");
  const existingUrls = new Set((existing || []).map((r) => (r.url || "").replace(/\/$/, "")));

  const [ghExtra, leverExtra, portalSearch] = await Promise.all([
    fetchExtraGreenhouse(),
    fetchExtraLever(),
    fetchTargetedPortalSearch()
  ]);

  console.log("📊 Expanded Source Discovery Counts:");
  console.log(`   • Extra Greenhouse Boards (20): ${ghExtra.length} matching jobs`);
  console.log(`   • Extra Lever Boards (8):       ${leverExtra.length} matching jobs`);
  console.log(`   • Targeted Portals (PFG/Cap1/S&P): ${portalSearch.length} matching jobs`);

  const all = [...ghExtra, ...leverExtra, ...portalSearch];
  const dedup = new Map();
  let netNew = 0;

  for (const item of all) {
    const normUrl = item.url.replace(/\/$/, "");
    if (dedup.has(normUrl)) continue;
    dedup.set(normUrl, { ...item, url: normUrl });
    if (!existingUrls.has(normUrl)) netNew++;
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

  console.log(`\n✅ Candidate jobs processed: ${all.length}`);
  console.log(`➕ Net-new unique requisitions added: +${netNew}`);
  console.log(`📌 Total active jobs in verified_jobs: ${count}`);
}

run();
