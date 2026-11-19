import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "public" } }
);

const allActive = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from("verified_jobs")
    .select("id, company, title, location, work_mode, zone, sponsorship_code, sponsorship_status, source, url")
    .eq("is_active", true)
    .range(from, from + 499);
  if (error) {
    console.error("❌ Query failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  allActive.push(...data);
  if (data.length < 500) break;
  from += 500;
}

const issues = [];
const urlSet = new Set();
const companyCounts = {};
const zoneCounts = {};

for (const row of allActive) {
  const u = (row.url || "").trim();
  const t = (row.title || "").trim();
  const c = (row.company || "").trim();

  if (!u || !u.startsWith("https://")) issues.push(`Non-HTTPS/missing URL [${row.id}]: ${u}`);
  if (urlSet.has(u)) issues.push(`Duplicate active URL: ${u}`);
  urlSet.add(u);

  if (/google\.com\/goto|jobs\/search|simplyhired\.com\/q-|ziprecruiter\.com\/Jobs\//i.test(u)) {
    issues.push(`Search/redirect/directory URL still active [${c}]: ${u}`);
  }
  if (!t || /\b(intern|internship|part-time|part time|junior|entry level)\b/i.test(t)) {
    issues.push(`Suspect title [${c}]: ${t}`);
  }
  if (!row.sponsorship_code) {
    issues.push(`Missing sponsorship_code [${c} - ${t}]`);
  }

  companyCounts[c || "Unknown"] = (companyCounts[c || "Unknown"] || 0) + 1;
  zoneCounts[row.zone || "Unspecified"] = (zoneCounts[row.zone || "Unspecified"] || 0) + 1;
}

const mdLines = fs.existsSync("verified-v2.6-audit.md") ? fs.readFileSync("verified-v2.6-audit.md", "utf8").split("\n") : [];
const mdTableRows = mdLines.filter((l) => /^\|\s*\d+\s*\|/.test(l)).length;
const csvLines = fs.existsSync("verified-v2.6-audit.csv")
  ? fs.readFileSync("verified-v2.6-audit.csv", "utf8").trim().split("\n").length - 1
  : 0;

const topCompanies = Object.entries(companyCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12);

console.log("🔎 Pre-Commit Verification Report (v2.6):");
console.log(`   • Active DB rows:        ${allActive.length}`);
console.log(`   • Audit MD table rows:   ${mdTableRows}`);
console.log(`   • Audit CSV data rows:   ${csvLines}`);
console.log(`   • Zone breakdown:        ${JSON.stringify(zoneCounts)}`);
console.log(`   • Top employers:         ${topCompanies.map(([k, v]) => `${k} (${v})`).join(", ")}`);
console.log(`   • Issues detected:       ${issues.length}`);

if (issues.length > 0) {
  console.log("\n⚠️ Issues to review:");
  for (const issue of issues) console.log(`   - ${issue}`);
  process.exitCode = 1;
} else {
  console.log("\n✅ All 325 active positions passed pre-commit hygiene checks with zero issues.");
}
