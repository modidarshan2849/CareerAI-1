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

// 1. User Preference Alignment Rules (Senior Data / BI / Analytics / Data Science)
const TARGET_ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler|pricing analyst|revenue analyst|operations research|management and program analyst)\b/i;
const EXCLUDE_NON_FIT_REGEX = /\b(intern|internship|co-op|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor|warehouse associate|sales representative|account executive)\b/i;

// 2. Closed / Expired Posting Indicators in Live HTML
const EXPIRED_PAGE_REGEX = /\b(no longer accepting applications|this job is no longer available|position has been filled|requisition has been closed|job posting has expired|sorry, this job was not found|the job you are looking for is no longer open|application period has ended)\b/i;

// 3. Sponsorship Classification Rules (Run against live page text + stored description)
const NO_SPONSOR_REGEX = /\b(will not sponsor|does not sponsor|cannot sponsor|unable to sponsor|no visa sponsorship|without visa sponsorship|without sponsorship|sponsorship is not available|not eligible for visa sponsorship|must be legally authorized.*without.*sponsorship|us citizen|u\.s\. citizen|united states citizenship|green card|permanent resident|security clearance|secret clearance|top secret|ts\/sci|public trust clearance)\b/i;
const YES_SPONSOR_REGEX = /\b(visa sponsorship available|sponsorship is available|will sponsor|willing to sponsor|provides visa sponsorship|h-?1b sponsorship|sponsorship provided|eligible for sponsorship)\b/i;

function classifySponsorship(fullText, source) {
  if (/usajobs|federal/i.test(source || "")) {
    return {
      sponsorship_code: "NO_SPONSORSHIP",
      sponsorship_status: "US Citizen Only (Federal / No Sponsorship)"
    };
  }
  if (NO_SPONSOR_REGEX.test(fullText)) {
    return {
      sponsorship_code: "NO_SPONSORSHIP",
      sponsorship_status: "US Citizen / Green Card Only (No Sponsorship)"
    };
  }
  if (YES_SPONSOR_REGEX.test(fullText)) {
    return {
      sponsorship_code: "SPONSORSHIP_AVAILABLE",
      sponsorship_status: "Visa / Green Card Sponsorship Available"
    };
  }
  return {
    sponsorship_code: "NOT_SPECIFIED",
    sponsorship_status: "Not Specified / Open"
  };
}

function isNonUSLocation(loc) {
  if (!loc) return false;
  const nonUS = /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|uk|united kingdom|london|germany|berlin|munich|france|paris|canada|toronto|vancouver|australia|sydney|melbourne|singapore|japan|tokyo|brazil|poland|warsaw|ireland|dublin|spain|madrid|netherlands|amsterdam|israel|tel aviv|mexico|philippines|manila)\b/i;
  const hasUS = /\b(us|u\.s\.|usa|united states|remote|anywhere|north america|va|virginia|dc|district of columbia|md|maryland|nc|north carolina|ny|ca|tx|il|ma|wa|ga|fl|pa|nj|co|az|oh|mn)\b/i;
  return nonUS.test(loc) && !hasUS.test(loc);
}

async function auditSingleJob(job) {
  const title = job.title || "";
  const location = job.location || "";
  const url = (job.url || "").trim();

  // Check 1: Preference & Role Relevance
  if (!TARGET_ROLE_REGEX.test(title) || EXCLUDE_NON_FIT_REGEX.test(title) || isNonUSLocation(location)) {
    return { id: job.id, valid: false, reason: "OFF_PREFERENCE_ROLE_OR_GEO" };
  }

  // Check 2: URL Format & Direct Application Pattern
  if (!url.startsWith("https://") || url.includes("example.com") || url.includes("undefined")) {
    return { id: job.id, valid: false, reason: "INVALID_URL_FORMAT" };
  }

  // Check 3: Live HTTP Fetch + Expired Page Check + Application Target Check
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410 || res.status >= 500) {
      return { id: job.id, valid: false, reason: `HTTP_${res.status}_DEAD_LINK` };
    }

    const html = await res.text();
    const plainText = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
                          .replace(/<style[\s\S]*?<\/style>/gi, " ")
                          .replace(/<[^>]+>/g, " ")
                          .replace(/\s+/g, " ");

    if (EXPIRED_PAGE_REGEX.test(plainText)) {
      return { id: job.id, valid: false, reason: "EXPIRED_OR_CLOSED_POSTING" };
    }

    // Verify page actually contains job/application context (not a generic 404/homepage shell)
    const finalUrl = res.url || url;
    const hasAppSignal = /\b(apply|application|job description|qualifications|responsibilities|requisition|position)\b/i.test(plainText) ||
                         /greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|usajobs\.gov|myworkdayjobs\.com|icims\.com|taleo\.net|remotive\.com/i.test(finalUrl);

    if (!hasAppSignal && plainText.length < 400) {
      return { id: job.id, valid: false, reason: "NO_APPLICATION_TARGET" };
    }

    // Check 4: Deep Visa Sponsorship Classification on Full Live Text + Stored Description
    const combinedText = `${title} ${job.description || ""} ${plainText.slice(0, 12000)}`;
    const sponsorship = classifySponsorship(combinedText, job.source);

    return {
      id: job.id,
      valid: true,
      finalUrl,
      sponsorship_code: sponsorship.sponsorship_code,
      sponsorship_status: sponsorship.sponsorship_status
    };
  } catch (err) {
    return { id: job.id, valid: false, reason: `FETCH_TIMEOUT_OR_DNS_ERROR` };
  }
}

async function runFullAudit() {
  console.log("🔍 Fetching all active records from Supabase verified_jobs...");
  const { data: jobs, error } = await supabase
    .from("verified_jobs")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("❌ Failed to fetch jobs:", error.message);
    process.exit(1);
  }

  console.log(`📋 Auditing ${jobs.length} active records for liveness, expiration, application target, preferences, and sponsorship...\n`);

  const stats = {
    total: jobs.length,
    passed: 0,
    deactivated: 0,
    reasons: {},
    sponsorship: { NO_SPONSORSHIP: 0, SPONSORSHIP_AVAILABLE: 0, NOT_SPECIFIED: 0 }
  };

  const validUpdates = [];
  const invalidIds = [];

  // Process in concurrent batches of 15 to avoid rate-limiting ATS servers
  for (let i = 0; i < jobs.length; i += 15) {
    const batch = jobs.slice(i, i + 15);
    const results = await Promise.all(batch.map((job) => auditSingleJob(job)));

    for (const r of results) {
      if (r.valid) {
        stats.passed++;
        stats.sponsorship[r.sponsorship_code]++;
        validUpdates.push(r);
      } else {
        stats.deactivated++;
        stats.reasons[r.reason] = (stats.reasons[r.reason] || 0) + 1;
        invalidIds.push(r.id);
      }
    }
    process.stdout.write(`   Processed ${Math.min(i + 15, jobs.length)} / ${jobs.length}...\r`);
  }

  console.log("\n\n📊 Validation Audit Results:");
  console.log(`   ✅ Verified Active & Valid Application Links: ${stats.passed}`);
  console.log(`   🗑️ Deactivated (Dead / Expired / Off-Target): ${stats.deactivated}`);
  if (stats.deactivated > 0) {
    for (const [reason, count] of Object.entries(stats.reasons)) {
      console.log(`      - ${reason}: ${count}`);
    }
  }
  console.log(`\n🛂 Visa Sponsorship Breakdown (Across ${stats.passed} Valid Jobs):`);
  console.log(`   • Visa / Green Card Sponsorship Available:      ${stats.sponsorship.SPONSORSHIP_AVAILABLE}`);
  console.log(`   • US Citizen / Green Card Only (No Sponsorship): ${stats.sponsorship.NO_SPONSORSHIP}`);
  console.log(`   • Not Specified / Open:                          ${stats.sponsorship.NOT_SPECIFIED}`);

  // Persist updates to Supabase
  if (invalidIds.length > 0) {
    for (let i = 0; i < invalidIds.length; i += 50) {
      const chunk = invalidIds.slice(i, i + 50);
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", chunk);
    }
  }

  for (let i = 0; i < validUpdates.length; i += 25) {
    const chunk = validUpdates.slice(i, i + 25);
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from("verified_jobs")
          .update({
            url: u.finalUrl,
            sponsorship_code: u.sponsorship_code,
            sponsorship_status: u.sponsorship_status,
            last_verified_at: new Date().toISOString()
          })
          .eq("id", u.id)
      )
    );
  }

  const { count } = await supabase
    .from("verified_jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  console.log(`\n✅ Database Updated! Total 100% Live, Verified, Preference-Matched Jobs Active: ${count}`);
}

runFullAudit();
