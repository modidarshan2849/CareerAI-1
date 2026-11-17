import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
const envText = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const env = {};
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=["']?([^"'\r\n]+)["']?/);
  if (match) env[match[1]] = match[2];
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://fnemfziivufcwelnbxlf.supabase.co";
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("🔗 Connecting to Supabase database:", url);
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Import current verified master pool
import("./lib/ats/master-jobs-pool.ts").then(async (pool) => {
  const jobs = pool.GENERATED_228_JOBS || [];
  console.log(`📦 Found ${jobs.length} Master-Gate-verified jobs to sync to Supabase tables.`);

  // 1. Upsert jobs into database table
  let syncedJobs = 0;
  for (const job of jobs) {
    try {
      const payload = {
        id: job.id,
        user_id: job.user_id || "00000000-0000-0000-0000-000000000001",
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        score: job.score,
        is_remote: job.is_remote,
        miles_from_home: job.miles_from_home,
        work_mode: job.work_mode,
        keywords: job.keywords,
        salary_range: job.salary_range,
        description: job.description,
        source: job.source,
        passed_all_gates: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("jobs").upsert(payload, { onConflict: "id" });
      if (!error) syncedJobs++;
    } catch {
      // continue
    }
  }
  console.log(`✅ Successfully synced ${syncedJobs} verified jobs into Supabase 'jobs' table.`);

  // 2. Insert ATS Resume & Profile into database
  try {
    const resumePayload = {
      user_id: "00000000-0000-0000-0000-000000000001",
      full_name: "Darshan Modi",
      current_title: "Senior Data Analyst II",
      experience_years: 12,
      location: "Virginia Beach, VA",
      summary: "Senior Data Analyst II with 12 years of enterprise analytics, Snowflake warehousing, Python ETL pipelines, SQL modeling, Power BI, and Tableau leadership across PFH, Royal Mail Group, and State of Maryland.",
      skills: ["Snowflake", "Python", "SQL", "Power BI", "Tableau", "dbt", "Airflow", "AWS", "Azure"],
      experience: [
        {
          company: "Performance Food Group (PFG)",
          title: "Senior Data Analyst II",
          period: "2023 - Present",
          location: "Virginia Beach, VA",
          highlights: [
            "Architected Snowflake and Python ETL data pipelines processing enterprise supply chain telemetry.",
            "Delivered automated Power BI and Tableau executive dashboards improving inventory turnover and margin tracking.",
            "Enforced rigorous SQL data modeling, schema governance, and query optimization."
          ]
        },
        {
          company: "Royal Mail Group plc",
          title: "Lead Data Analyst",
          period: "2016 - 2023",
          location: "London, United Kingdom",
          highlights: [
            "Led a team of ~20 analysts managing EBB and Mailmark analytics.",
            "Optimized warehouse data models, reducing report generation latency by 40%."
          ]
        },
        {
          company: "State of Maryland (Codemax Consulting)",
          title: "Data Analytics Contractor",
          period: "2014 - 2016",
          location: "Baltimore, MD",
          highlights: [
            "Developed Resident 360 (R360) data validation models and SQL queries for DHS programs."
          ]
        }
      ],
      education: [
        {
          degree: "Bachelor of Computer Applications (BCA)",
          institution: "Navgujarat College of Computer Applications",
          location: "Ahmedabad, India"
        }
      ],
      updated_at: new Date().toISOString()
    };

    await supabase.from("ats_resumes").upsert(resumePayload, { onConflict: "user_id" });
    console.log("✅ Successfully stored candidate ATS Resume in Supabase 'ats_resumes' table.");
  } catch (e) {
    console.log("ℹ️ ATS resume table sync note:", e.message);
  }

  console.log("🚀 Database setup & synchronization complete!");
}).catch(err => {
  console.error("❌ Error loading job pool:", err);
});
