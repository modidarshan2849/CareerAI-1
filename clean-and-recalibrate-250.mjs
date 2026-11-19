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

const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|washington,\s*dc|\bdc\b|maryland|\bmd\b|california|\bca\b|new york|\bny\b|texas|\btx\b|illinois|\bil\b|washington\b|\bwa\b|massachusetts|\bma\b|colorado|\bco\b|north carolina|\bnc\b|florida|\bfl\b|georgia|\bga\b|pennsylvania|\bpa\b|ohio|\boh\b|arizona|\baz\b|hawaii|\bhi\b)\b/i;
const STUDENT_OR_JUNIOR_REGEX = /\b(student worker|part-time|part time|intern|internship|co-op|entry level|junior|jr\.|associate analyst)\b/i;
const GENERIC_CAREER_URL_REGEX = /^https?:\/\/[^/]+\/(careers\/?$|careers\/search\/?$|current-openings\/?$|company\/careers\/open-positions\/job\/?$)/i;

function extractCanonicalKey(url) {
  try {
    const u = new URL(url);
    const ghJid = u.searchParams.get("gh_jid");
    if (ghJid) return `${u.hostname.replace(/^www\./, "")}::gh::${ghJid}`;
    const cleanPath = u.pathname.replace(/\/+$/, "");
    // Extract trailing numeric or UUID requisition ID if present
    const idMatch = cleanPath.match(/([a-f0-9-]{8,}|\d{5,})$/i);
    if (idMatch) return `${u.hostname.replace(/^www\./, "")}::req::${idMatch[1].toLowerCase()}`;
    return `${u.hostname.replace(/^www\./, "")}${cleanPath.toLowerCase()}`;
  } catch {
    return (url || "").toLowerCase();
  }
}

function scoreConfidence(job, hasSpecificReqUrl) {
  let conf = Number(job.score || 85);
  if (job.last_verified_at) conf += 3;
  if (hasSpecificReqUrl) conf += 2;
  else conf -= 10;

  if (job.sponsorship_code === "SPONSORSHIP_AVAILABLE" || job.sponsorship_code === "NO_SPONSORSHIP") {
    conf += 2;
  } else {
    // Sponsorship not explicitly stated on page
    conf -= 4;
  }

  if (!/senior|sr\.|lead|principal|staff|manager|director|head/i.test(job.title || "")) {
    conf -= 5;
  }

  return Math.max(50, Math.min(conf, 99));
}

async function run() {
  const { data: jobs, error } = await supabase
    .from("verified_jobs")
    .select("*")
    .eq("is_active", true)
    .order("score", { ascending: false });

  if (error) {
    console.error("❌ Failed to read verified_jobs:", error.message);
    process.exit(1);
  }

  const seenCanonicalKeys = new Set();
  const validRows = [];
  const invalidIds = [];
  const dropReasons = {};

  for (const job of jobs || []) {
    const title = job.title || "";
    const loc = job.location || "";
    const url = (job.url || "").trim();
    const canonicalKey = extractCanonicalKey(url);

    let reason = null;
    if (!url.startsWith("https://") || GENERIC_CAREER_URL_REGEX.test(url)) {
      reason = "GENERIC_OR_NON_REQ_URL";
    } else if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) {
      reason = "NON_US_LOCATION";
    } else if (STUDENT_OR_JUNIOR_REGEX.test(title)) {
      reason = "STUDENT_OR_NON_SENIOR_ROLE";
    } else if (seenCanonicalKeys.has(canonicalKey)) {
      reason = "DUPLICATE_REQUISITION";
    }

    if (reason) {
      invalidIds.push(job.id);
      dropReasons[reason] = (dropReasons[reason] || 0) + 1;
      continue;
    }

    seenCanonicalKeys.add(canonicalKey);
    const hasSpecificReqUrl = !GENERIC_CAREER_URL_REGEX.test(url) && /\/(jobs?|roles?|positions?|requisition|jobdetail)\b/i.test(new URL(url).pathname + new URL(url).search);
    const confidence = scoreConfidence(job, hasSpecificReqUrl);
    const verdict = job.sponsorship_code === "NOT_SPECIFIED" ? "VALID (Verify Sponsorship)" : "VALID";

    validRows.push({
      ...job,
      confidence,
      verdict
    });
  }

  if (invalidIds.length > 0) {
    for (let i = 0; i < invalidIds.length; i += 50) {
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", invalidIds.slice(i, i + 50));
    }
  }

  const mdLines = [
    `# CareerAI — Cleaned & Recalibrated Audit Table (${validRows.length} Active Jobs)`,
    "",
    "| # | Company | Role Title | Location / Mode | Visa Sponsorship | Audit Status | Confidence % | Direct Application Link |",
    "|---|---|---|---|---|---|---|---|"
  ];

  const csvLines = [
    "Index,Company,Role Title,Location,Work Mode,Visa Sponsorship,Audit Status,Confidence %,Direct Application URL"
  ];

  validRows.forEach((r, idx) => {
    const n = idx + 1;
    const safeTitle = (r.title || "").replace(/\|/g, "-").trim();
    const safeCompany = (r.company || "").replace(/\|/g, "-").trim();
    const locMode = `${(r.location || "US").trim()} (${r.work_mode || "Hybrid"})`.replace(/\|/g, "-");
    const sponsor = (r.sponsorship_status || "Not Specified / Open").replace(/\|/g, "-");

    mdLines.push(
      `| ${n} | ${safeCompany} | ${safeTitle} | ${locMode} | ${sponsor} | ${r.verdict} | **${r.confidence}%** | [Apply Direct](${r.url}) |`
    );

    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    csvLines.push([n, esc(r.company), esc(r.title), esc(r.location), esc(r.work_mode), esc(r.sponsorship_status), esc(r.verdict), `${r.confidence}%`, esc(r.url)].join(","));
  });

  fs.writeFileSync("verified-cleaned-jobs-audit.md", mdLines.join("\n"), "utf8");
  fs.writeFileSync("verified-cleaned-jobs-audit.csv", csvLines.join("\n"), "utf8");

  console.log(`🧹 Deactivated ${invalidIds.length} duplicate/non-US/non-senior/generic-URL rows:`, dropReasons);
  console.log(`✅ Active Clean Pool: ${validRows.length} jobs`);
  console.log(`📄 Exported verified-cleaned-jobs-audit.md and verified-cleaned-jobs-audit.csv`);
}

run();
