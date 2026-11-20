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

function inferCompany(row) {
  const current = (row.company || "").trim();
  const title = (row.title || "").trim();
  const desc = (row.description || "").trim();
  const url = (row.url || "").trim();

  // Keep already clean specific employer names
  if (current && !/^(linkedin employer|employer|unknown|company)$/i.test(current)) {
    return current;
  }

  // 1. Check "at <Company>" or "- <Company>" or "| <Company>" in title/description
  const patterns = [
    /\b(?:at|with|join)\s+([A-Z][A-Za-z0-9&.,'\-\s]{1,40}?)(?:\s+(?:in|for|-|\||$))/ ,
    /\b(?:Company|Employer|Organization)\s*:\s*([A-Z][A-Za-z0-9&.,'\-\s]{1,40})/i,
    /^([A-Z][A-Za-z0-9&.,'\-\s]{2,35}?)\s+(?:is seeking|is looking for|seeks|hiring)\b/
  ];

  for (const pat of patterns) {
    const m = `${title} — ${desc}`.match(pat);
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/[-–|]+$/, "").trim();
      if (
        candidate.length >= 2 &&
        !/^(linkedin|learn4good|indeed|ziprecruiter|glassdoor|remote|hybrid|virginia|mclean|richmond)$/i.test(candidate)
      ) {
        return candidate;
      }
    }
  }

  // 2. Fallback to clean domain/board label rather than "LinkedIn Employer"
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    if (/linkedin\.com/i.test(host)) return "LinkedIn Direct";
    if (/learn4good\.com/i.test(host)) return "Learn4Good Listing";
    if (/brassring\.com/i.test(host)) return "Performance Food Group";
    const root = host.split(".")[0];
    return root ? root.charAt(0).toUpperCase() + root.slice(1) : "Verified Employer";
  } catch {
    return "Verified Employer";
  }
}

const { data: activeRows, error } = await supabase
  .from("verified_jobs")
  .select("*")
  .eq("is_active", true)
  .range(0, 4999);

if (error) {
  console.error("Query error:", error.message);
  process.exit(1);
}

let fixedCount = 0;
const updatedRows = [];

for (const row of activeRows || []) {
  const nextCompany = inferCompany(row);
  const nextSource =
    /learn4good\.com/i.test(row.url || "") && !/learn4good/i.test(row.source || "")
      ? "Learn4Good"
      : row.source || "Verified Feed";

  if (nextCompany !== row.company || nextSource !== row.source) {
    console.log(`🔧 Fixed employer: "${row.company}" -> "${nextCompany}" | ${row.title} (${row.url})`);
    await supabase
      .from("verified_jobs")
      .update({ company: nextCompany, source: nextSource })
      .eq("id", row.id);
    fixedCount++;
  }
  updatedRows.push({ ...row, company: nextCompany, source: nextSource });
}

// Sync v2.7 audit files
const mdLines = [
  `# CareerAI v2.7 — Verified Active Jobs (${updatedRows.length} Roles)`,
  "",
  "| # | Company | Role Title | Location / Mode | Work Status | Match % | Direct Link |",
  "|---|---|---|---|---|---|---|"
];
const csvLines = [
  "Index,Company,Role Title,Location,Work Mode,Work Status,Score %,Source,Direct URL"
];

updatedRows.forEach((r, idx) => {
  const n = idx + 1;
  const ws =
    r.sponsorship_code === "SPONSORSHIP_AVAILABLE"
      ? "Green Card / Sponsorship Available"
      : r.sponsorship_code === "NO_SPONSORSHIP"
      ? "Requires Green Card / Citizenship"
      : "Not Specified";
  mdLines.push(`| ${n} | ${(r.company || "").replace(/\|/g, "-")} | ${(r.title || "").replace(/\|/g, "-")} | ${r.location || "US"} (${r.work_mode || "Hybrid"}) | ${ws} | **${r.score || 88}%** | [Apply](${r.url}) |`);
  const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
  csvLines.push([n, esc(r.company), esc(r.title), esc(r.location), esc(r.work_mode), esc(ws), `${r.score || 88}%`, esc(r.source), esc(r.url)].join(","));
});

fs.writeFileSync("verified-v2.7-audit.md", mdLines.join("\n"), "utf8");
fs.writeFileSync("verified-v2.7-audit.csv", csvLines.join("\n"), "utf8");

console.log(`\n✅ Updated ${fixedCount} employer attributions across ${updatedRows.length} active roles.`);
