import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const serpApiKey = process.env.SERPAPI_KEY;
if (!serpApiKey) {
  console.error("❌ SERPAPI_KEY missing in .env.local");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: "public" } }
);

function normUrl(raw) {
  try {
    const u = new URL(raw);
    u.protocol = "https:";
    for (const p of ["trk", "refId", "trackingId", "utm_source", "utm_medium", "utm_campaign", "eBP"]) {
      u.searchParams.delete(p);
    }
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return (raw || "").trim();
  }
}

const q = encodeURIComponent('site:linkedin.com/jobs/view "Senior Data Analyst" (Virginia OR "Washington, DC" OR Remote)');
const res = await fetch(`https://serpapi.com/search.json?engine=google&q=${q}&num=20&api_key=${serpApiKey}`);
const data = await res.json();
const organic = data.organic_results || [];

const { data: dbRows } = await supabase
  .from("verified_jobs")
  .select("id, title, company, location, url, is_active, source")
  .range(0, 4999);

const byUrl = new Map();
const byTitle = [];
for (const r of dbRows || []) {
  const c = normUrl(r.url || "");
  if (c) byUrl.set(c, r);
  if (/senior data analyst/i.test(r.title || "")) byTitle.push(r);
}

const csvText = fs.existsSync("verified-v2.6-audit.csv") ? fs.readFileSync("verified-v2.6-audit.csv", "utf8") : "";

let inBundleCount = 0;
let missingCount = 0;

console.log(`🔎 LinkedIn "Senior Data Analyst" check (${organic.length} indexed results):\n`);
for (const item of organic) {
  const clean = normUrl(item.link || "");
  const matchedRow = byUrl.get(clean) || byTitle.find((r) => clean && (r.url || "").includes(clean.split("/").pop()));
  const inAuditCsv = clean ? csvText.includes(clean) : false;

  if (matchedRow && matchedRow.is_active) {
    inBundleCount++;
    console.log(`   ✅ IN BUNDLE (ACTIVE${inAuditCsv ? " + CSV" : ""}): ${item.title} -> ${clean}`);
  } else if (matchedRow && !matchedRow.is_active) {
    missingCount++;
    console.log(`   ⚠️ IN DB BUT INACTIVE: ${item.title} -> ${clean}`);
  } else {
    missingCount++;
    console.log(`   ❌ MISSING FROM BUNDLE: ${item.title} -> ${clean}`);
  }
}

console.log(`\n📌 Summary: ${inBundleCount} in active bundle | ${missingCount} missing or inactive | ${byTitle.length} total "Senior Data Analyst" rows in DB.`);
