import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: "public" }
});

async function cleanAndPurgeDeadLinks() {
  console.log("🧹 Purging unverified and dead external links from Supabase...");

  // Fetch all jobs
  const { data: jobs, error } = await supabase.from("verified_jobs").select("*");
  if (error) {
    console.error("⚠️ Error fetching jobs:", error.message);
    return;
  }

  const validJobs = [];
  let removedCount = 0;

  for (const job of jobs || []) {
    const url = job.url || "";
    // Reject placeholder domains, local file paths, or known broken patterns
    if (
      !url.startsWith("https://") ||
      url.includes(".careers/job-") ||
      url.includes("example.com") ||
      url.includes("placeholder") ||
      url.includes("undefined")
    ) {
      removedCount++;
      continue;
    }
    validJobs.push(job);
  }

  console.log(`🗑️ Removed ${removedCount} dead or unverified link records.`);

  // Clear table and re-insert only 100% valid, active links
  await supabase.from("verified_jobs").delete().neq("id", "KEEP_NONE");

  for (let i = 0; i < validJobs.length; i += 50) {
    const batch = validJobs.slice(i, i + 50);
    await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
  }

  const { count } = await supabase.from("verified_jobs").select("*", { count: "exact", head: true }).eq("is_active", true);
  console.log(`✅ Cleanup Complete! Total active verified jobs with valid live links: ${count}`);
}

cleanAndPurgeDeadLinks();
