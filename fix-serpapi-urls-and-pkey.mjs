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

const { data: rows, error } = await supabase
  .from("verified_jobs")
  .select("id, url, title, company, is_active")
  .range(0, 4999);

if (error) {
  console.error("❌ Failed to read verified_jobs:", error.message);
  process.exit(1);
}

let unwrappedCount = 0;
let deactivatedWrapperCount = 0;

for (const row of rows || []) {
  const u = row.url || "";
  if (u.includes("google.com/goto")) {
    try {
      const parsed = new URL(u);
      const target = parsed.searchParams.get("url") || parsed.searchParams.get("q");
      if (target && target.startsWith("https://") && !target.includes("google.com/goto")) {
        await supabase.from("verified_jobs").update({ url: target }).eq("id", row.id);
        unwrappedCount++;
      } else {
        await supabase.from("verified_jobs").update({ is_active: false }).eq("id", row.id);
        deactivatedWrapperCount++;
      }
    } catch {
      await supabase.from("verified_jobs").update({ is_active: false }).eq("id", row.id);
      deactivatedWrapperCount++;
    }
  }
}

console.log(`🔗 Unwrapped ${unwrappedCount} Google redirect URLs | Deactivated ${deactivatedWrapperCount} opaque redirect rows.`);
