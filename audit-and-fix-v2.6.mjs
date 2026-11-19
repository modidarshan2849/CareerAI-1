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

const TARGET_ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|analytics engineer|data scientist|decision science|product analyst|marketing analyst|financial analyst|operations analyst|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|lead analyst|principal analyst|senior analyst|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler|pricing analyst|revenue analyst|operations research|management and program analyst)\b/i;
const EXCLUDE_ROLE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor|warehouse associate)\b/i;
const GENERIC_PORTAL_REGEX = /^https?:\/\/[^/]+\/(careers\/?$|careers\/search\/?$|current-openings\/?$|company\/careers\/open-positions\/job\/?$)/i;
const EXPIRED_PAGE_REGEX = /\b(no longer accepting applications|this job is no longer available|position has been filled|requisition has been closed|job posting has expired|sorry, this job was not found|the job you are looking for is no longer open|application period has ended)\b/i;

const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|washington,\s*dc|\bdc\b|maryland|\bmd\b|california|\bca\b|new york|\bny\b|texas|\btx\b|illinois|\bil\b|washington\b|\bwa\b|massachusetts|\bma\b|colorado|\bco\b|north carolina|\bnc\b|florida|\bfl\b|georgia|\bga\b|pennsylvania|\bpa\b|ohio|\boh\b|arizona|\baz\b|hawaii|\bhi\b)\b/i;

const NO_SPONSOR_REGEX = /\b(will not sponsor|does not sponsor|cannot sponsor|unable to sponsor|no visa sponsorship|without visa sponsorship|without sponsorship|sponsorship is not available|not eligible for visa sponsorship|must be legally authorized.*without.*sponsorship|us citizen|u\.s\. citizen|united states citizenship|green card|permanent resident|security clearance|secret clearance|top secret|ts\/sci|public trust clearance)\b/i;
const YES_SPONSOR_REGEX = /\b(visa sponsorship available|sponsorship is available|will sponsor|willing to sponsor|provides visa sponsorship|h-?1b sponsorship|sponsorship provided|eligible for sponsorship)\b/i;

function canonicalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl.trim());
    u.protocol = "https:";
    for (const param of ["gh_jid", "t", "gh_src", "utm_source", "utm_medium", "utm_campaign"]) {
      u.searchParams.delete(param);
    }
    const cleanPath = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${cleanPath}${u.search}`;
  } catch {
    return (rawUrl || "").trim();
  }
}

function canonicalReqKey(url) {
  try {
    const u = new URL(url);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    const idMatch = cleanPath.match(/([a-f0-9-]{8,}|\d{5,})$/i);
    if (idMatch) return `${u.hostname.replace(/^www\./, "")}::${idMatch[1].toLowerCase()}`;
    return `${u.hostname.replace(/^www\./, "")}${cleanPath.toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
}

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

function computeConfidence(job, sponsorshipCode, hasDeepLink) {
  let conf = Number(job.score || 85);
  conf += hasDeepLink ? 3 : -10;
  if (sponsorshipCode === "SPONSORSHIP_AVAILABLE" || sponsorshipCode === "NO_SPONSORSHIP") {
    conf += 2;
  } else {
    conf -= 4;
  }
  if (!/senior|sr\.|lead|principal|staff|manager|director|head/i.test(job.title || "")) {
    conf -= 5;
  }
  return Math.max(50, Math.min(conf, 99));
}

async function fetchAllActiveRows() {
  const all = [];
  const pageSize = 500;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("verified_jobs")
      .select("*")
      .eq("is_active", true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function verifyJob(job) {
  const title = job.title || "";
  const loc = job.location || "";
  const normUrl = canonicalizeUrl(job.url || "");

  if (!TARGET_ROLE_REGEX.test(title) || EXCLUDE_ROLE_REGEX.test(title)) {
    return { valid: false, reason: "OFF_TARGET_ROLE" };
  }
  if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) {
    return { valid: false, reason: "NON_US_LOCATION" };
  }
  if (!normUrl.startsWith("https://") || GENERIC_PORTAL_REGEX.test(normUrl)) {
    return { valid: false, reason: "NON_REQUISITION_URL" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(normUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410 || res.status >= 500) {
      return { valid: false, reason: `HTTP_${res.status}` };
    }

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

    if (EXPIRED_PAGE_REGEX.test(text)) {
      return { valid: false, reason: "EXPIRED_OR_CLOSED" };
    }

    const finalUrl = canonicalizeUrl(res.url || normUrl);
    if (GENERIC_PORTAL_REGEX.test(finalUrl)) {
      return { valid: false, reason: "REDIRECTED_TO_PORTAL_ROOT" };
    }

    const hasAppSignal =
      /\b(apply|application|job description|qualifications|responsibilities|requisition|position)\b/i.test(text) ||
      /greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|usajobs\.gov|myworkdayjobs\.com|icims\.com|taleo\.net|remotive\.com|arbeitnow\.com|remoteok\.com/i.test(finalUrl);

    if (!hasAppSignal && text.length < 400) {
      return { valid: false, reason: "NO_APPLICATION_TARGET" };
    }

    const combined = `${title} ${job.description || ""} ${text.slice(0, 12000)}`;
    const sponsorship = classifySponsorship(combined, job.source);
    const hasDeepLink = /\/(jobs?|roles?|positions?|requisition|jobdetail)\b/i.test(new URL(finalUrl).pathname + new URL(finalUrl).search);
    const confidence = computeConfidence(job, sponsorship.sponsorship_code, hasDeepLink);

    return {
      valid: true,
      job: {
        ...job,
        url: finalUrl,
        sponsorship_code: sponsorship.sponsorship_code,
        sponsorship_status: sponsorship.sponsorship_status,
        last_verified_at: new Date().toISOString()
      },
      confidence,
      verdict: sponsorship.sponsorship_code === "NOT_SPECIFIED" ? "VALID (Verify Sponsorship)" : "VALID"
    };
  } catch {
    return { valid: false, reason: "FETCH_ERROR_OR_TIMEOUT" };
  }
}

async function run() {
  console.log("📥 Loading all active rows from verified_jobs...");
  const activeRows = await fetchAllActiveRows();
  console.log(`📊 Loaded ${activeRows.length} active records for v2.6 validation.`);

  const seenReqKeys = new Set();
  const toAudit = [];
  const duplicateIds = [];

  for (const row of activeRows) {
    const cleanUrl = canonicalizeUrl(row.url || "");
    const reqKey = canonicalReqKey(cleanUrl);
    if (!cleanUrl || seenReqKeys.has(reqKey)) {
      duplicateIds.push(row.id);
      continue;
    }
    seenReqKeys.add(reqKey);
    toAudit.push({ ...row, url: cleanUrl });
  }

  if (duplicateIds.length > 0) {
    for (let i = 0; i < duplicateIds.length; i += 50) {
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", duplicateIds.slice(i, i + 50));
    }
    console.log(`🔁 Deactivated ${duplicateIds.length} duplicate requisition entries before live HTTP check.`);
  }

  const validEntries = [];
  const invalidIds = [];
  const dropReasons = {};
  const sponsorshipCounts = { SPONSORSHIP_AVAILABLE: 0, NO_SPONSORSHIP: 0, NOT_SPECIFIED: 0 };

  for (let i = 0; i < toAudit.length; i += 15) {
    const batch = toAudit.slice(i, i + 15);
    const results = await Promise.all(batch.map((j) => verifyJob(j)));

    for (const r of results) {
      if (r.valid) {
        validEntries.push({ row: r.job, confidence: r.confidence, verdict: r.verdict });
        sponsorshipCounts[r.job.sponsorship_code] = (sponsorshipCounts[r.job.sponsorship_code] || 0) + 1;
      } else {
        invalidIds.push(r.job?.id || batch[results.indexOf(r)].id);
        dropReasons[r.reason] = (dropReasons[r.reason] || 0) + 1;
      }
    }
    process.stdout.write(`   Audited ${Math.min(i + 15, toAudit.length)} / ${toAudit.length}...\r`);
  }

  console.log("\n\n📋 v2.6 Audit Summary:");
  console.log(`   • Valid & Active:   ${validEntries.length}`);
  console.log(`   • Deactivated:      ${invalidIds.length + duplicateIds.length}`);
  if (Object.keys(dropReasons).length > 0) {
    console.log("   • Failure Reasons:", dropReasons);
  }
  console.log("   • Sponsorship Split:", sponsorshipCounts);

  if (invalidIds.length > 0) {
    for (let i = 0; i < invalidIds.length; i += 50) {
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", invalidIds.slice(i, i + 50));
    }
  }

  for (let i = 0; i < validEntries.length; i += 25) {
    const chunk = validEntries.slice(i, i + 25);
    await Promise.all(
      chunk.map(({ row }) =>
        supabase
          .from("verified_jobs")
          .update({
            url: row.url,
            sponsorship_code: row.sponsorship_code,
            sponsorship_status: row.sponsorship_status,
            last_verified_at: row.last_verified_at
          })
          .eq("id", row.id)
      )
    );
  }

  const mdLines = [
    `# CareerAI v2.6 — Audited Active Jobs (${validEntries.length} Roles)`,
    "",
    "| # | Company | Role Title | Location / Mode | Visa Sponsorship | Audit Status | Confidence % | Direct Application Link |",
    "|---|---|---|---|---|---|---|---|"
  ];
  const csvLines = [
    "Index,Company,Role Title,Location,Work Mode,Visa Sponsorship,Audit Status,Confidence %,Direct Application URL"
  ];

  validEntries.sort((a, b) => b.confidence - a.confidence).forEach((entry, idx) => {
    const { row, confidence, verdict } = entry;
    const n = idx + 1;
    const comp = (row.company || "").replace(/\|/g, "-").trim();
    const title = (row.title || "").replace(/\|/g, "-").trim();
    const locMode = `${(row.location || "US").trim()} (${row.work_mode || "Hybrid"})`.replace(/\|/g, "-");
    const sponsor = (row.sponsorship_status || "Not Specified / Open").replace(/\|/g, "-");

    mdLines.push(`| ${n} | ${comp} | ${title} | ${locMode} | ${sponsor} | ${verdict} | **${confidence}%** | [Apply Direct](${row.url}) |`);
    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    csvLines.push([n, esc(row.company), esc(row.title), esc(row.location), esc(row.work_mode), esc(row.sponsorship_status), esc(verdict), `${confidence}%`, esc(row.url)].join(","));
  });

  fs.writeFileSync("verified-v2.6-audit.md", mdLines.join("\n"), "utf8");
  fs.writeFileSync("verified-v2.6-audit.csv", csvLines.join("\n"), "utf8");
  console.log("✅ Wrote verified-v2.6-audit.md and verified-v2.6-audit.csv");
}

run();
