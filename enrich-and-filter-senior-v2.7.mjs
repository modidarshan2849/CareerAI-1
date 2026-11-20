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

const JUNIOR_REGEX = /\b(jr\.?|junior|entry[\s-]level|associate\s+(data|bi|analytics|analyst)|intern|internship|co-op|new grad|graduate program|level\s*i\b|\b1\b$)\b/i;

const { data: activeRows } = await supabase
  .from("verified_jobs")
  .select("id, company, title, url, description, source")
  .eq("is_active", true)
  .range(0, 4999);

const juniorIds = [];
let enrichedCount = 0;

for (const row of activeRows || []) {
  if (JUNIOR_REGEX.test(row.title || "")) {
    juniorIds.push(row.id);
    console.log(`🗑️ Deactivating non-senior role: [${row.company}] ${row.title}`);
    continue;
  }

  // Enrich thin descriptions (<180 chars) from SmartRecruiters or Greenhouse APIs
  if ((row.description || "").trim().length < 180 && row.url) {
    try {
      const srMatch = row.url.match(/jobs\.smartrecruiters\.com\/([^/]+)\/(\d+)/i);
      if (srMatch) {
        const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${srMatch[1]}/postings/${srMatch[2]}`);
        if (res.ok) {
          const detail = await res.json();
          const sections = detail.jobAd?.sections || {};
          const fullText = [
            sections.companyDescription?.text,
            sections.jobDescription?.text,
            sections.qualifications?.text,
            sections.additionalInformation?.text
          ]
            .filter(Boolean)
            .join("\n\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (fullText.length > 150) {
            await supabase
              .from("verified_jobs")
              .update({ description: fullText.slice(0, 4500), last_verified_at: new Date().toISOString() })
              .eq("id", row.id);
            enrichedCount++;
          }
        }
      }
    } catch {}
  }
}

if (juniorIds.length > 0) {
  await supabase.from("verified_jobs").update({ is_active: false }).in("id", juniorIds);
}

const { count } = await supabase
  .from("verified_jobs")
  .select("*", { count: "exact", head: true })
  .eq("is_active", true);

console.log(`\n✅ Deactivated ${juniorIds.length} junior/non-senior roles | Enriched ${enrichedCount} thin descriptions | Active senior pool: ${count}`);
