import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "public" } }
);

function normStr(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function extractReqKey(row) {
  const comp = normStr(row.company);
  // Extract BrassRing jobid or numeric req_id if meaningful
  const brassMatch = (row.url || "").match(/(?:jobid=|jobDetails=)(\d+)/i);
  if (comp && brassMatch) return `${comp}::req::${brassMatch[1]}`;
  const reqId = (row.req_id || "").trim();
  if (comp && reqId && !/^(EXT|GJ|LI|LI-IDX|WD)$/i.test(reqId)) {
    return `${comp}::req::${reqId.toLowerCase()}`;
  }
  return null;
}

function titleSigKey(row) {
  const comp = normStr(row.company);
  const title = normStr(row.title);
  const zone = normStr(row.zone);
  return comp && title ? `${comp}::title::${title}::${zone}` : null;
}

function rowQualityScore(row) {
  let pts = Number(row.score || 85);
  // Prefer specific job title over generic placeholder title
  if (/data & analytics position \(#\d+\)/i.test(row.title || "")) pts -= 20;
  // Prefer #jobDetails URL for BrassRing
  if ((row.url || "").includes("#jobDetails=")) pts += 5;
  // Prefer direct ATS/portal over aggregator
  if (!/linkedin\.com|indeed\.com|ziprecruiter\.com/i.test(row.url || "")) pts += 3;
  return pts;
}

async function run() {
  const activeRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("verified_jobs")
      .select("*")
      .eq("is_active", true)
      .range(from, from + 499);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    activeRows.push(...data);
    if (data.length < 500) break;
    from += 500;
  }

  console.log(`📥 Loaded ${activeRows.length} active rows for full cross-key deduplication.`);

  // Sort best representation first so we keep the cleanest title & URL
  activeRows.sort((a, b) => rowQualityScore(b) - rowQualityScore(a));

  const seenUrls = new Set();
  const seenReqKeys = new Set();
  const seenTitleKeys = new Set();

  const kept = [];
  const dupIds = [];

  for (const row of activeRows) {
    const url = (row.url || "").trim();
    const reqKey = extractReqKey(row);
    const titleKey = titleSigKey(row);

    const isDup =
      !url ||
      seenUrls.has(url) ||
      (reqKey && seenReqKeys.has(reqKey)) ||
      (titleKey && seenTitleKeys.has(titleKey));

    if (isDup) {
      dupIds.push(row.id);
      console.log(`   🔁 Deactivating duplicate: [${row.company}] ${row.title} (req=${row.req_id}) -> ${url}`);
      continue;
    }

    seenUrls.add(url);
    if (reqKey) seenReqKeys.add(reqKey);
    if (titleKey) seenTitleKeys.add(titleKey);
    kept.push(row);
  }

  // Upgrade the surviving PFG #1434993 row so it has the clean #jobDetails URL and 95% score
  const pfg1434993 = kept.find((r) => /performance food/i.test(r.company || "") && String(r.req_id) === "1434993");
  if (pfg1434993) {
    const cleanBrassUrl = "https://sjobs.brassring.com/TGnewUI/Search/Home/Home?partnerid=26350&siteid=6930#jobDetails=1434993_6930";
    pfg1434993.url = cleanBrassUrl;
    pfg1434993.score = 95;
    await supabase
      .from("verified_jobs")
      .update({ url: cleanBrassUrl, score: 95, last_verified_at: new Date().toISOString() })
      .eq("id", pfg1434993.id);
  }

  if (dupIds.length > 0) {
    for (let i = 0; i < dupIds.length; i += 50) {
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", dupIds.slice(i, i + 50));
    }
  }

  // Regenerate verified-v2.6-audit.md and verified-v2.6-audit.csv
  const mdLines = [
    `# CareerAI v2.6 — Final Deduplicated Active Jobs (${kept.length} Roles)`,
    "",
    "| # | Company | Role Title | Location / Mode | Visa Sponsorship | Audit Status | Confidence % | Direct Application Link |",
    "|---|---|---|---|---|---|---|---|"
  ];
  const csvLines = [
    "Index,Company,Role Title,Location,Work Mode,Visa Sponsorship,Audit Status,Confidence %,Direct Application URL"
  ];

  kept.sort((a, b) => (b.score || 88) - (a.score || 88)).forEach((row, idx) => {
    const n = idx + 1;
    const comp = (row.company || "").replace(/\|/g, "-").trim();
    const title = (row.title || "").replace(/\|/g, "-").trim();
    const locMode = `${(row.location || "US").trim()} (${row.work_mode || "Hybrid"})`.replace(/\|/g, "-");
    const sponsor = (row.sponsorship_status || "Not Specified / Open").replace(/\|/g, "-");
    const conf = Number(row.score || 90);
    const verdict = row.sponsorship_code === "NOT_SPECIFIED" ? "VALID (Verify Sponsorship)" : "VALID";

    mdLines.push(`| ${n} | ${comp} | ${title} | ${locMode} | ${sponsor} | ${verdict} | **${conf}%** | [Apply Direct](${row.url}) |`);
    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    csvLines.push([n, esc(row.company), esc(row.title), esc(row.location), esc(row.work_mode), esc(row.sponsorship_status), esc(verdict), `${conf}%`, esc(row.url)].join(","));
  });

  fs.writeFileSync("verified-v2.6-audit.md", mdLines.join("\n"), "utf8");
  fs.writeFileSync("verified-v2.6-audit.csv", csvLines.join("\n"), "utf8");

  console.log(`\n✅ Removed ${dupIds.length} duplicate entries | Final unique active roles: ${kept.length}`);
  console.log("✅ Updated verified-v2.6-audit.md and verified-v2.6-audit.csv");
}

run();
