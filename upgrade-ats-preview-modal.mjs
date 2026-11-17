import fs from "fs";

// 1. Create API endpoint for JSON resume data so the preview modal can load it instantly
fs.mkdirSync("app/api/resume/json", { recursive: true });
const JSON_RESUME_ROUTE = `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Senior Data Analyst";
  const company = searchParams.get("company") || "Enterprise Employer";
  const stack = searchParams.get("stack") || "Snowflake, Python, SQL, Power BI, dbt";

  const resumeData = {
    name: "Darshan Modi",
    title: "Senior Data Analyst II",
    contact: "Virginia Beach, VA | darshan@careerai.local | 12 Years Experience",
    summary: \`Results-driven Senior Data Analyst II with 12 years of enterprise analytics, Snowflake warehousing, Python ETL pipelines, SQL modeling, and executive KPI leadership. Proven track record of aligning data architecture with business objectives to drive supply chain optimization, margin growth, and operational efficiency at enterprise scale (Performance Food Group, Royal Mail Group, State of Maryland). Tailored specifically for the \${title} role at \${company}.\`,
    skills: ["Snowflake", "Python", "SQL", "Power BI", "Tableau", "dbt", "Airflow", "AWS", "Azure", "Looker", "ETL", "Executive KPI Reporting"],
    experience: [
      {
        company: "Performance Food Group (PFG)",
        role: "Senior Data Analyst II",
        period: "2023 - Present",
        location: "Virginia Beach, VA",
        bullets: [
          "Architected and scaled enterprise Snowflake and Python ETL data pipelines processing high-volume supply chain and commercial distribution telemetry.",
          "Designed automated Power BI and Tableau executive KPI dashboards that improved inventory turnover metrics and margin visibility.",
          "Enforced rigorous SQL query optimization and dimensional schema governance across enterprise data warehouses, reducing report generation latency by 35%."
        ]
      },
      {
        company: "Royal Mail Group plc",
        role: "Lead Data Analyst",
        period: "2016 - 2023",
        location: "London, United Kingdom",
        bullets: [
          "Directed an analytics team of ~20 data professionals managing core EBB and Mailmark operational analytics.",
          "Spearheaded warehouse data model refactoring, eliminating legacy reporting bottlenecks and boosting query performance across multi-terabyte datasets."
        ]
      },
      {
        company: "State of Maryland (Codemax Consulting)",
        role: "Data Analytics Contractor",
        period: "2014 - 2016",
        location: "Baltimore, MD",
        bullets: [
          "Developed Resident 360 (R360) data validation models and complex SQL queries supporting Department of Human Services (DHS) programs."
        ]
      }
    ],
    education: [
      {
        degree: "Bachelor of Computer Applications (BCA)",
        institution: "Navgujarat College of Computer Applications (Ahmedabad, India)"
      }
    ],
    targetStack: stack
  };

  return NextResponse.json(resumeData);
}
`;

fs.writeFileSync("app/api/resume/json/route.ts", JSON_RESUME_ROUTE, "utf8");
console.log("✅ Created /api/resume/json endpoint for live preview modal.");
