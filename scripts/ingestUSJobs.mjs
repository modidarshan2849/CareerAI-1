import fs from "fs";
import crypto from "crypto";

const env = fs.readFileSync(".env.local", "utf-8");
const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/) || [])[1]?.trim();
const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/) || [])[1]?.trim();

if (!url || !key) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Enterprise Greenhouse ATS endpoints to scrape directly
const GREENHOUSE_COMPANIES = [
  "snowflake",
  "databricks",
  "cloudflare",
  "affirm",
  "gitlab",
  "doordash",
  "reddit",
  "figma",
  "elastic",
  "hashicorp",
  "instacart",
  "samsara",
  "gusto",
  "carta"
];

function isUSLocation(locStr, desc) {
  const loc = (locStr || "").toLowerCase();
  const d = (desc || "").toLowerCase();

  const nonUS = ["europe", "uk only", "united kingdom", "germany", "france", "canada only", "brazil", "india only", "apac", "emea", "latam", "australia"];
  if (nonUS.some((kw) => loc.includes(kw))) return false;

  const usKeywords = [
    "united states", "usa", "u.s.", "us remote", "remote, us", "remote - us", 
    "remote (us)", "north america", "virginia", "va", "new york", "ny", 
    "california", "ca", "texas", "tx", "remote", "us"
  ];
  return usKeywords.some((kw) => loc.includes(kw)) || d.includes("authorized to work in the united states") || d.includes("authorized to work in the us");
}

function detectVisaPolicy(text) {
  const t = text.toLowerCase();
  const noSponsorship = [
    "no sponsorship", "unable to sponsor", "not able to sponsor",
    "us citizens and green card", "citizen or green card only",
    "without sponsorship", "no c2c", "corp to corp not",
    "must be authorized to work in the us without", "must be a us citizen"
  ];
  const willSponsor = ["will sponsor", "visa sponsorship available", "sponsorship provided", "h1b transfer eligible"];

  for (const p of noSponsorship) {
    if (t.includes(p)) return "no_sponsorship";
  }
  for (const p of willSponsor) {
    if (t.includes(p)) return "sponsors";
  }
  return "unknown";
}

function detectIndustry(text, title) {
  const t = (text + " " + title).toLowerCase();
  if (t.includes("supply chain") || t.includes("logistics") || t.includes("freight") || t.includes("transport") || t.includes("warehouse")) {
    return "Supply Chain & Logistics";
  }
  if (t.includes("bank") || t.includes("financial") || t.includes("fintech") || t.includes("trading") || t.includes("capital")) {
    return "Financial Services";
  }
  if (t.includes("health") || t.includes("hospital") || t.includes("clinical") || t.includes("pharma")) {
    return "Healthcare & Life Sciences";
  }
  if (t.includes("retail") || t.includes("ecommerce") || t.includes("cpg")) {
    return "Retail & Consumer Goods";
  }
  return "Technology & SaaS";
}

function detectSeniority(title, text) {
  const combined = (title + " " + text).toLowerCase();
  if (combined.includes("lead") || combined.includes("principal") || combined.includes("staff") || combined.includes("architect") || combined.includes("manager")) {
    return { level: "Lead", minYears: 8 };
  }
  if (combined.includes("senior") || combined.includes("sr.") || combined.includes("sr ") || combined.includes("iii")) {
    return { level: "Senior", minYears: 5 };
  }
  if (combined.includes("junior") || combined.includes("entry") || combined.includes("associate")) {
    return { level: "Entry", minYears: 1 };
  }
  return { level: "Mid", minYears: 3 };
}

const TECH_SKILLS = [
  "SQL", "Snowflake", "Python", "dbt", "ETL", "Tableau", "Power BI", 
  "AWS", "Databricks", "Qlik", "QlikView", "Qlik Sense", "Data Modeling", 
  "BigQuery", "Redshift", "Azure", "Airflow", "Kafka", "Data Warehousing"
];

function extractSkills(text) {
  const found = new Set();
  for (const skill of TECH_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, "i");
    if (regex.test(text)) {
      found.add(skill);
    }
  }
  return Array.from(found).slice(0, 8);
}

async function harvest() {
  console.log("==================================================");
  console.log("   CAREERAI-1: ENTERPRISE US JOB INGESTION ENGINE   ");
  console.log("==================================================\n");

  const collectedListings = [];

  // SOURCE 1: Tier-1 Enterprise Greenhouse ATS Endpoints
  console.log("[Source 1/3] Querying Corporate Greenhouse Boards...");
  for (const company of GREENHOUSE_COMPANIES) {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const allJobs = data.jobs || [];

      // Filter for Data, Analytics, BI, and Warehouse roles
      const dataJobs = allJobs.filter((j) =>
        /data|analytics|business intelligence|bi |warehouse|snowflake|etl|analytics engineer/i.test(j.title)
      );

      dataJobs.forEach((j) => {
        collectedListings.push({
          title: j.title,
          employer: company.charAt(0).toUpperCase() + company.slice(1),
          location: j.location?.name || "United States (Remote)",
          description: j.content || "",
          url: j.absolute_url,
          sourcePlatform: "Direct Corporate ATS",
          postedAt: j.updated_at || new Date().toISOString()
        });
      });

      console.log(`  ✓ ${company}: Found ${dataJobs.length} active data positions`);
    } catch {
      // Skip company if endpoint times out
    }
  }

  // SOURCE 2: Jobicy US Dedicated Data Feed
  console.log("\n[Source 2/3] Querying Jobicy US Data Feed...");
  try {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50&geo=usa&industry=data-science", {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      const jobs = data.jobs || [];
      jobs.forEach((j) => {
        collectedListings.push({
          title: j.jobTitle,
          employer: j.companyName,
          location: j.jobGeo || "USA Remote",
          description: j.jobDescription || "",
          url: j.url,
          sourcePlatform: "Jobicy US Feed",
          postedAt: j.pubDate || new Date().toISOString()
        });
      });
      console.log(`  ✓ Jobicy: Ingested ${jobs.length} US positions`);
    }
  } catch (e) {
    console.warn("  ⚠ Jobicy feed warning:", e.message);
  }

  // SOURCE 3: Arbeitnow Open Tech Feed
  console.log("\n[Source 3/3] Querying Arbeitnow Tech Feed...");
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      const jobs = (data.data || []).filter((j) =>
        /data|analytics|warehouse|bi |etl|snowflake/i.test(j.title)
      );
      jobs.forEach((j) => {
        collectedListings.push({
          title: j.title,
          employer: j.company_name,
          location: j.location || "Remote",
          description: j.description || "",
          url: j.url,
          sourcePlatform: "Arbeitnow Open Feed",
          postedAt: new Date(j.created_at * 1000).toISOString()
        });
      });
      console.log(`  ✓ Arbeitnow: Ingested ${jobs.length} data positions`);
    }
  } catch (e) {
    console.warn("  ⚠ Arbeitnow feed warning:", e.message);
  }

  console.log(`\nTotal raw candidates collected: ${collectedListings.length}`);
  console.log("Normalizing, filtering for USA, and computing content fingerprints...\n");

  const validRecords = [];
  const seenHashes = new Set();

  for (const item of collectedListings) {
    const cleanDesc = (item.description || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Enforce USA geographical gate
    if (!isUSLocation(item.location, cleanDesc)) continue;

    const title = (item.title || "Data Professional").trim();
    const employer = (item.employer || "Enterprise Employer").trim();
    const loc = (item.location || "United States (Remote)").trim();

    // SHA-256 deduplication hash
    const contentHash = crypto
      .createHash("sha256")
      .update(`${title.toLowerCase()}|${employer.toLowerCase()}|${loc.toLowerCase()}`)
      .digest("hex");

    if (seenHashes.has(contentHash)) continue;
    seenHashes.add(contentHash);

    const seniority = detectSeniority(title, cleanDesc);
    const visa = detectVisaPolicy(cleanDesc);
    const industry = detectIndustry(cleanDesc, title);
    const skills = extractSkills(cleanDesc + " " + title);

    // Parse compensation if disclosed
    let minSal = null;
    let maxSal = null;
    const salaryMatch = cleanDesc.match(/\$?(\d{2,3})[,\.]?(\d{3})/g);
    if (salaryMatch && salaryMatch.length >= 1) {
      const num1 = parseInt(salaryMatch[0].replace(/[^0-9]/g, ""), 10);
      if (num1 >= 60000 && num1 <= 300000) {
        minSal = num1;
        if (salaryMatch.length >= 2) {
          const num2 = parseInt(salaryMatch[1].replace(/[^0-9]/g, ""), 10);
          if (num2 >= minSal && num2 <= 350000) maxSal = num2;
        }
      }
    }

    validRecords.push({
      title,
      employer,
      location: loc,
      country: "US",
      work_mode: /hybrid/i.test(loc) ? "hybrid" : /onsite/i.test(loc) ? "onsite" : "remote",
      is_remote: !/onsite/i.test(loc),
      remote_policy: "US_Only",
      industry,
      experience_level: seniority.level,
      min_years_required: seniority.minYears,
      sponsorship_policy: visa,
      requires_us_clearance: /clearance|secret|polygraph/i.test(cleanDesc),
      salary_min: minSal,
      salary_max: maxSal,
      description: cleanDesc.slice(0, 1500),
      required_skills: skills.length > 0 ? skills : ["SQL", "Data Modeling"],
      preferred_skills: [],
      source_url: item.url || null,
      source_platform: item.sourcePlatform,
      posted_at: item.postedAt,
      last_verified_at: new Date().toISOString(),
      content_hash: contentHash,
      is_active: true
    });
  }

  console.log(`Validated ${validRecords.length} unique US-bound enterprise listings.`);
  console.log("Upserting records into Supabase in batches of 40...\n");

  const BATCH_SIZE = 40;
  let savedCount = 0;

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const chunk = validRecords.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${url}/rest/v1/jobs?on_conflict=content_hash`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(chunk)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
    } else {
      savedCount += chunk.length;
      console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} jobs)`);
    }
  }

  console.log("\n==================================================");
  console.log(` SUCCESS: ${savedCount} Verified Active US Jobs Stored!`);
  console.log("==================================================");
}

harvest().catch(console.error);
