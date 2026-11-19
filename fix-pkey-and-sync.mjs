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

// Load existing sync-and-cross-validate.mjs sources by patching its upsert logic directly
let sourceCode = fs.readFileSync("sync-and-cross-validate.mjs", "utf8");

// Replace the select & upsert section to map existing IDs by URL and deduplicate both ID and URL
const oldSectionRegex = /\/\/ 1\. Cross-validate existing pool in Supabase[\s\S]*$/;

const patchedSection = `// 1. Cross-validate existing pool in Supabase (map URL -> existing ID & ID -> existing URL)
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
    const norm = (r.url || "").replace(/\\/$/, "");
    if (norm) urlToExistingId.set(norm, r.id);
    if (r.id) existingIds.add(r.id);
  }
  console.log(\`📊 Existing Supabase Pool Baseline: \${urlToExistingId.size} jobs\`);

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

  console.log(\`   • Greenhouse ATS:      \${gh.length} open roles\`);
  console.log(\`   • Lever ATS:           \${lever.length} open roles\`);
  console.log(\`   • Ashby ATS:           \${ashby.length} open roles\`);
  console.log(\`   • SmartRecruiters ATS: \${sr.length} open roles\`);
  console.log(\`   • USAJOBS Federal:     \${usa.length} open roles\`);
  console.log(\`   • Remotive Remote:     \${remotive.length} open roles\`);

  // 3. Cross-validate and deduplicate by BOTH url and primary key id
  const allFetched = [...gh, ...lever, ...ashby, ...sr, ...usa, ...remotive];
  const dedupByUrl = new Map();
  const usedIds = new Set();
  let matchedExistingCount = 0;
  let netNewCount = 0;

  for (const job of allFetched) {
    const normUrl = job.url.replace(/\\/$/, "");
    if (dedupByUrl.has(normUrl)) continue;

    // Preserve existing primary key if URL already exists in Supabase; otherwise ensure ID is globally unique
    let safeId = urlToExistingId.get(normUrl) || job.id;
    if (!urlToExistingId.has(normUrl) && (existingIds.has(safeId) || usedIds.has(safeId))) {
      safeId = \`\${safeId}-\${Buffer.from(normUrl).toString("base64url").slice(-8)}\`;
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
  console.log(\`\\n🔎 Cross-Validation Summary:\`);
  console.log(\`   • Matched & refreshed from existing pool: \${matchedExistingCount}\`);
  console.log(\`   • Preserved historical/local jobs in pool: \${missingFromCurrentPool}\`);
  console.log(\`   • Net-new open requisitions discovered:    +\${netNewCount}\`);

  // 4. Upsert all deduplicated verified jobs into Supabase with per-row fallback on conflict
  const rows = Array.from(dedupByUrl.values());
  console.log(\`\\n📦 Upserting \${rows.length} verified open requisitions into Supabase...\`);

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

  console.log(\`\\n✅ COMPLETE! Upserted \${upsertedCount} records. Total active verified jobs (score >= 80) now in Supabase: \${count}\`);
}

runFullSyncAndCrossValidate();
`;

sourceCode = sourceCode.replace(oldSectionRegex, patchedSection);
fs.writeFileSync("sync-and-cross-validate.mjs", sourceCode, "utf8");
console.log("✅ Patched sync-and-cross-validate.mjs with primary-key collision protection.");
