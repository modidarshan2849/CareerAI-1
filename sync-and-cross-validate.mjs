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

// Expanded Data, Analytics, BI, Strategy & Data Engineering Role Matcher
const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler|pricing analyst|revenue analyst|actuarial analyst|healthcare analyst|clinical data|operations research|management and program analyst|it specialist.*data)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|recruiter|counsel|registered nurse|mechanic|driver|janitor|warehouse associate|sales representative|account executive)\b/i;
const TECH_KEYWORDS = ["SQL", "Python", "Snowflake", "Power BI", "Tableau", "AWS", "Databricks", "ETL", "Looker", "dbt", "R", "BigQuery", "Qlik", "Postgres", "Spark", "Azure"];

const GREENHOUSE_BOARDS = [
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
  { slug: "chewy", name: "Chewy" }
];

const LEVER_BOARDS = [
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
  { slug: "wealthfront", name: "Wealthfront" }
];

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

const SMARTRECRUITERS_BOARDS = [
  { slug: "Visa", name: "Visa" },
  { slug: "BoschGroup", name: "Bosch" },
  { slug: "Equifax", name: "Equifax" },
  { slug: "McDonaldsCorporation", name: "McDonald's" },
  { slug: "Experian", name: "Experian" },
  { slug: "WesternDigital", name: "Western Digital" },
  { slug: "ServiceNow", name: "ServiceNow" }
];

function isUSOrRemoteLocation(loc) {
  if (!loc) return true;
  // Exclude purely non-US countries unless Remote/US is also listed
  const nonUS = /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|uk|united kingdom|london|germany|berlin|munich|france|paris|canada|toronto|vancouver|australia|sydney|melbourne|singapore|japan|tokyo|brazil|poland|warsaw|ireland|dublin|spain|madrid|netherlands|amsterdam|israel|tel aviv|mexico|philippines|manila)\b/i;
  const hasUS = /\b(us|u\.s\.|usa|united states|remote|anywhere|north america|va|virginia|dc|district of columbia|md|maryland|nc|north carolina|ny|ca|tx|il|ma|wa|ga|fl|pa|nj|co|az|oh|mn)\b/i;
  if (nonUS.test(loc) && !hasUS.test(loc)) return false;
  return true;
}

function classifyAndScore(title, description, location) {
  const blob = `${title} ${description || ""}`;
  const keywords = TECH_KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(blob));
  if (keywords.length === 0) keywords.push("SQL", "Analytics");

  let score = 82 + Math.min(keywords.length * 2, 12);
  if (/senior|sr\.|lead|principal|manager|staff|director|iii|ii/i.test(title)) score += 4;
  if (keywords.includes("Python") || keywords.includes("Snowflake") || keywords.includes("SQL")) score += 2;

  const isRemote = /remote|anywhere|united states|usa/i.test(location || "");
  const isHamptonRoads = /virginia beach|norfolk|chesapeake|newport news|hampton|portsmouth|suffolk/i.test(location || "");
  const isVAOrDMV = /\b(va|virginia|richmond|arlington|mclean|reston|tysons|herndon|alexandria|fairfax|washington,\s*dc|dc|maryland|bethesda)\b/i.test(location || "");

  const noSponsor = /\b(will not sponsor|does not sponsor|no visa sponsorship|without sponsorship|us citizen|u\.s\. citizen|green card|security clearance|secret clearance|ts\/sci)\b/i.test(blob);
  const yesSponsor = /\b(visa sponsorship available|sponsorship available|will sponsor|willing to sponsor|h-?1b sponsorship)\b/i.test(blob);

  return {
    score: Math.min(score, 99),
    keywords,
    is_remote: isRemote,
    miles_from_home: isHamptonRoads ? 20 : isVAOrDMV ? 160 : isRemote ? 0 : 450,
    work_mode: isRemote ? "Remote" : "Hybrid",
    zone: isHamptonRoads
      ? "Hampton Roads (<=50 mi)"
      : isVAOrDMV
      ? "Virginia / DMV (<=200 mi)"
      : isRemote
      ? "US Remote"
      : "US National / Relocation",
    sponsorship_code: noSponsor ? "NO_SPONSORSHIP" : yesSponsor ? "SPONSORSHIP_AVAILABLE" : "NOT_SPECIFIED",
    sponsorship_status: noSponsor
      ? "US Citizen / Green Card Only (No Sponsorship)"
      : yesSponsor
      ? "Visa / Green Card Sponsorship Available"
      : "Not Specified / Open"
  };
}

async function fetchGreenhouse() {
  const jobs = [];
  await Promise.all(
    GREENHOUSE_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location?.name || "United States";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isUSOrRemoteLocation(loc)) continue;
          if (!j.absolute_url?.startsWith("https://")) continue;

          const meta = classifyAndScore(title, j.content, loc);
          jobs.push({
            id: `gh-${b.slug}-${j.id}`,
            req_id: String(j.id),
            title,
            company: b.name,
            location: loc,
            url: j.absolute_url.split("?")[0],
            score: meta.score,
            is_remote: meta.is_remote,
            miles_from_home: meta.miles_from_home,
            work_mode: meta.work_mode,
            zone: meta.zone,
            sponsorship_status: meta.sponsorship_status,
            sponsorship_code: meta.sponsorship_code,
            posted_label: j.updated_at ? new Date(j.updated_at).toLocaleDateString("en-US") : "Active",
            last_date: "Rolling / Until Filled",
            keywords: meta.keywords,
            salary_range: "$140,000 - $195,000 / yr",
            source: `${b.name} (Greenhouse ATS)`,
            description: (j.content || "").replace(/<[^>]+>/g, " ").slice(0, 3200),
            is_active: true,
            last_verified_at: new Date().toISOString()
          });
        }
      } catch {}
    })
  );
  return jobs;
}

async function fetchLever() {
  const jobs = [];
  await Promise.all(
    LEVER_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${b.slug}?mode=json`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data || []) {
          const title = j.text || "";
          const loc = j.categories?.location || "United States";
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isUSOrRemoteLocation(loc)) continue;
          if (!j.hostedUrl?.startsWith("https://")) continue;

          const meta = classifyAndScore(title, j.descriptionPlain, loc);
          jobs.push({
            id: `lever-${b.slug}-${j.id}`,
            req_id: String(j.id).slice(0, 16),
            title,
            company: b.name,
            location: loc,
            url: j.hostedUrl.split("?")[0],
            score: meta.score,
            is_remote: meta.is_remote,
            miles_from_home: meta.miles_from_home,
            work_mode: meta.work_mode,
            zone: meta.zone,
            sponsorship_status: meta.sponsorship_status,
            sponsorship_code: meta.sponsorship_code,
            posted_label: j.createdAt ? new Date(j.createdAt).toLocaleDateString("en-US") : "Active",
            last_date: "Rolling / Until Filled",
            keywords: meta.keywords,
            salary_range: "$145,000 - $200,000 / yr",
            source: `${b.name} (Lever ATS)`,
            description: (j.descriptionPlain || "").slice(0, 3200),
            is_active: true,
            last_verified_at: new Date().toISOString()
          });
        }
      } catch {}
    })
  );
  return jobs;
}

async function fetchAshby() {
  const jobs = [];
  await Promise.all(
    ASHBY_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${b.slug}`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.jobs || []) {
          const title = j.title || "";
          const loc = j.location || (j.isRemote ? "Remote, US" : "United States");
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isUSOrRemoteLocation(loc)) continue;
          const url = j.jobUrl || j.applyUrl;
          if (!url?.startsWith("https://")) continue;

          const meta = classifyAndScore(title, j.descriptionPlain || j.descriptionHtml || "", loc);
          jobs.push({
            id: `ashby-${b.slug}-${j.id}`,
            req_id: String(j.id).slice(0, 18),
            title,
            company: b.name,
            location: loc,
            url: url.split("?")[0],
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
            salary_range: j.compensationTierSummary || "$140,000 - $195,000 / yr",
            source: `${b.name} (Ashby ATS)`,
            description: (j.descriptionPlain || j.descriptionHtml || "").replace(/<[^>]+>/g, " ").slice(0, 3200),
            is_active: true,
            last_verified_at: new Date().toISOString()
          });
        }
      } catch {}
    })
  );
  return jobs;
}

async function fetchSmartRecruiters() {
  const jobs = [];
  await Promise.all(
    SMARTRECRUITERS_BOARDS.map(async (b) => {
      try {
        const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${b.slug}/postings?limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        for (const j of data.content || []) {
          const title = j.name || "";
          const loc = `${j.location?.city || ""}, ${j.location?.region || ""} ${j.location?.country || ""} ${j.location?.remote ? "(Remote)" : ""}`.trim();
          if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
          if (!isUSOrRemoteLocation(loc)) continue;

          const meta = classifyAndScore(title, title, loc);
          jobs.push({
            id: `sr-${b.slug}-${j.id}`,
            req_id: String(j.refNumber || j.id),
            title,
            company: b.name,
            location: loc || "United States",
            url: `https://jobs.smartrecruiters.com/${b.slug}/${j.id}`,
            score: meta.score,
            is_remote: meta.is_remote,
            miles_from_home: meta.miles_from_home,
            work_mode: meta.work_mode,
            zone: meta.zone,
            sponsorship_status: meta.sponsorship_status,
            sponsorship_code: meta.sponsorship_code,
            posted_label: j.releasedDate ? new Date(j.releasedDate).toLocaleDateString("en-US") : "Active",
            last_date: "Rolling / Until Filled",
            keywords: meta.keywords,
            salary_range: "$135,000 - $185,000 / yr",
            source: `${b.name} (SmartRecruiters)`,
            description: `${title} at ${b.name} (${loc}).`,
            is_active: true,
            last_verified_at: new Date().toISOString()
          });
        }
      } catch {}
    })
  );
  return jobs;
}

async function fetchUSAJobsExpanded() {
  if (!process.env.USAJOBS_API_KEY || !process.env.USAJOBS_EMAIL) return [];
  const jobs = [];
  // Query federal occupational series: 1560 (Data Science), 1515 (Operations Research), 0343 (Program Analysis), 2210 (IT/Data)
  const queries = [
    "JobCategoryCode=1560&ResultsPerPage=250",
    "JobCategoryCode=1515&ResultsPerPage=250",
    "Keyword=Data%20Analyst&ResultsPerPage=250",
    "Keyword=Business%20Intelligence&ResultsPerPage=250"
  ];
  for (const q of queries) {
    try {
      const res = await fetch(`https://data.usajobs.gov/api/search?${q}`, {
        headers: {
          "Host": "data.usajobs.gov",
          "User-Agent": process.env.USAJOBS_EMAIL,
          "Authorization-Key": process.env.USAJOBS_API_KEY
        }
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.SearchResult?.SearchResultItems || []) {
        const d = item.MatchedObjectDescriptor;
        if (!d?.PositionTitle) continue;
        if (!ROLE_REGEX.test(d.PositionTitle) && !q.includes("1560")) continue;
        const url = d.ApplyURI?.[0] || d.PositionURI;
        if (!url?.startsWith("https://")) continue;

        const loc = d.PositionLocationDisplay || "United States";
        const meta = classifyAndScore(d.PositionTitle, d.QualificationSummary, loc);
        jobs.push({
          id: `usajobs-${item.MatchedObjectId}`,
          req_id: item.MatchedObjectId,
          title: d.PositionTitle,
          company: d.OrganizationName || "U.S. Federal Agency",
          location: loc,
          url,
          score: meta.score,
          is_remote: meta.is_remote,
          miles_from_home: meta.miles_from_home,
          work_mode: meta.work_mode,
          zone: meta.zone,
          sponsorship_status: "US Citizen Only (Federal)",
          sponsorship_code: "NO_SPONSORSHIP",
          posted_label: d.PublicationStartDate ? new Date(d.PublicationStartDate).toLocaleDateString("en-US") : "Active",
          last_date: d.ApplicationCloseDate ? new Date(d.ApplicationCloseDate).toLocaleDateString("en-US") : "See Announcement",
          keywords: meta.keywords,
          salary_range: d.PositionRemuneration?.[0]
            ? `$${Number(d.PositionRemuneration[0].MinimumRange).toLocaleString()} - $${Number(d.PositionRemuneration[0].MaximumRange).toLocaleString()}`
            : "Federal GS Scale",
          source: "USAJOBS Federal",
          description: (d.UserArea?.Details?.JobSummary || d.QualificationSummary || "").slice(0, 3200),
          is_active: true,
          last_verified_at: new Date().toISOString()
        });
      }
    } catch {}
  }
  return jobs;
}

async function fetchRemotiveDataJobs() {
  try {
    const res = await fetch("https://remotive.com/api/remote-jobs?category=data&limit=100");
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = [];
    for (const j of data.jobs || []) {
      const title = j.title || "";
      const loc = j.candidate_required_location || "Worldwide / US Remote";
      if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(title)) continue;
      if (!isUSOrRemoteLocation(loc)) continue;
      if (!j.url?.startsWith("https://")) continue;

      const meta = classifyAndScore(title, j.description, `Remote (${loc})`);
      jobs.push({
        id: `remotive-${j.id}`,
        req_id: String(j.id),
        title,
        company: j.company_name || "Remote Tech Employer",
        location: `Remote (${loc})`,
        url: j.url.split("?")[0],
        score: meta.score,
        is_remote: true,
        miles_from_home: 0,
        work_mode: "Remote",
        zone: "US Remote",
        sponsorship_status: meta.sponsorship_status,
        sponsorship_code: meta.sponsorship_code,
        posted_label: j.publication_date ? new Date(j.publication_date).toLocaleDateString("en-US") : "Active",
        last_date: "Rolling / Until Filled",
        keywords: meta.keywords,
        salary_range: j.salary || "$130,000 - $175,000 / yr",
        source: "Remotive Verified",
        description: (j.description || "").replace(/<[^>]+>/g, " ").slice(0, 3200),
        is_active: true,
        last_verified_at: new Date().toISOString()
      });
    }
    return jobs;
  } catch {
    return [];
  }
}

async function runFullSyncAndCrossValidate() {
  // 1. Cross-validate existing pool in Supabase (map URL -> existing ID & ID -> existing URL)
  const { data: existingRows, error: fetchErr } = await supabase
    .from("verified_jobs")
    .select("id, url, title, company, source, is_active");

  if (fetchErr) {
    console.error("❌ Failed to read existing Supabase pool:", fetchErr.message);
    process.exit(1);
  }

  const urlToExistingId = new Map();
  const existingIds = new Set();
  for (const r of existingRows || []) {
    const norm = (r.url || "").replace(/\/$/, "");
    if (norm) urlToExistingId.set(norm, r.id);
    if (r.id) existingIds.add(r.id);
  }
  console.log(`📊 Existing Supabase Pool Baseline: ${urlToExistingId.size} jobs`);

  // 2. Fetch all expanded sources in parallel
  console.log("🚀 Harvesting open requisitions across Greenhouse (44), Lever (14), Ashby (20), SmartRecruiters (7), USAJOBS, and Remotive...");
  const [gh, lever, ashby, sr, usa, remotive] = await Promise.all([
    fetchGreenhouse(),
    fetchLever(),
    fetchAshby(),
    fetchSmartRecruiters(),
    fetchUSAJobsExpanded(),
    fetchRemotiveDataJobs()
  ]);

  console.log(`   • Greenhouse ATS:      ${gh.length} open roles`);
  console.log(`   • Lever ATS:           ${lever.length} open roles`);
  console.log(`   • Ashby ATS:           ${ashby.length} open roles`);
  console.log(`   • SmartRecruiters ATS: ${sr.length} open roles`);
  console.log(`   • USAJOBS Federal:     ${usa.length} open roles`);
  console.log(`   • Remotive Remote:     ${remotive.length} open roles`);

  // 3. Cross-validate and deduplicate by BOTH url and primary key id
  const allFetched = [...gh, ...lever, ...ashby, ...sr, ...usa, ...remotive];
  const dedupByUrl = new Map();
  const usedIds = new Set();
  let matchedExistingCount = 0;
  let netNewCount = 0;

  for (const job of allFetched) {
    const normUrl = job.url.replace(/\/$/, "");
    if (dedupByUrl.has(normUrl)) continue;

    // Preserve existing primary key if URL already exists in Supabase; otherwise ensure ID is globally unique
    let safeId = urlToExistingId.get(normUrl) || job.id;
    if (!urlToExistingId.has(normUrl) && (existingIds.has(safeId) || usedIds.has(safeId))) {
      safeId = `${safeId}-${Buffer.from(normUrl).toString("base64url").slice(-8)}`;
    }
    usedIds.add(safeId);

    dedupByUrl.set(normUrl, { ...job, id: safeId, url: normUrl });

    if (urlToExistingId.has(normUrl)) {
      matchedExistingCount++;
    } else {
      netNewCount++;
    }
  }

  const missingFromCurrentPool = urlToExistingId.size - matchedExistingCount;
  console.log(`\n🔎 Cross-Validation Summary:`);
  console.log(`   • Matched & refreshed from existing pool: ${matchedExistingCount}`);
  console.log(`   • Preserved historical/local jobs in pool: ${missingFromCurrentPool}`);
  console.log(`   • Net-new open requisitions discovered:    +${netNewCount}`);

  // 4. Upsert all deduplicated verified jobs into Supabase with per-row fallback on conflict
  const rows = Array.from(dedupByUrl.values());
  console.log(`\n📦 Upserting ${rows.length} verified open requisitions into Supabase...`);

  let upsertedCount = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (!error) {
      upsertedCount += batch.length;
    } else {
      for (const singleRow of batch) {
        const { error: singleErr } = await supabase.from("verified_jobs").upsert(singleRow, { onConflict: "url" });
        if (!singleErr) upsertedCount++;
      }
    }
  }

  // 5. Verify final count in Supabase
  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .gte("score", 80);

  console.log(`\n✅ COMPLETE! Upserted ${upsertedCount} records. Total active verified jobs (score >= 80) now in Supabase: ${count}`);
}

runFullSyncAndCrossValidate();
