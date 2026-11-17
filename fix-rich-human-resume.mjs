import fs from "fs";

// 1. Update the tailored resume API endpoint to output the complete, rich, formatted resume
const RICH_RESUME_API = `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Senior Data Analyst";
  const company = searchParams.get("company") || "Enterprise Employer";
  const stack = searchParams.get("stack") || "Snowflake, Python, SQL, Power BI, dbt";

  const fullRichResume = \`DARSHAN MODI
Virginia Beach, VA | darshan@careerai.local | LinkedIn: linkedin.com/in/darshan-modi

EXECUTIVE SUMMARY
Senior Data Analyst II with 12 years of enterprise analytics expertise spanning cloud warehousing, Python ETL pipelines, and executive KPI architecture. Proven track record of partnering with C-suite stakeholders and supply chain directors to modernize legacy reporting, optimize multi-terabyte datasets, and drive measurable margin improvements and inventory efficiency at scale (Performance Food Group, Royal Mail Group, State of Maryland). Tailored specifically for the \${title} role at \${company}.

CORE TECHNICAL EXPERTISE
- Data Architecture & Warehousing: Snowflake, dbt, Dimensional Modeling, Star/Snowflake Schema Design, ETL/ELT Pipelines
- Programming & Querying: Python (Pandas, NumPy), Advanced SQL (Window Functions, CTEs, Query Performance Tuning)
- BI & Executive Reporting: Power BI, Tableau, Looker, Automated Executive KPI Frameworks & Dashboards
- Cloud & Workflow Automation: AWS, Azure, Apache Airflow, Git, CI/CD, Enterprise Data Governance

PROFESSIONAL EXPERIENCE

Performance Food Group (PFG) — Virginia Beach, VA
Senior Data Analyst II (2023 – Present)
- Architected and scaled enterprise Snowflake data warehouses and Python ETL pipelines processing high-volume supply chain and commercial distribution telemetry across US operations.
- Designed and deployed automated Power BI and Tableau executive KPI dashboards that improved inventory turnover metrics, reduced stockouts, and enhanced regional margin visibility.
- Enforced rigorous SQL query optimization and dimensional schema governance, reducing enterprise report generation latency by 35% and eliminating recurring data discrepancies.
- Partnered directly with executive leadership, commercial directors, and engineering teams to translate complex datasets into strategic, actionable business decisions.

Royal Mail Group plc — London, United Kingdom
Lead Data Analyst (2016 – 2023)
- Directed a high-performing analytics team of ~20 data professionals managing core EBB and Mailmark operational analytics across nationwide mail and parcel distribution networks.
- Spearheaded warehouse data model refactoring and pipeline consolidation, eliminating legacy reporting bottlenecks and boosting query performance across multi-terabyte datasets.
- Built predictive analytics models in Python and SQL to forecast regional mail volume fluctuations, optimize transportation logistics SLAs, and support strategic budgeting.

State of Maryland (Codemax Consulting) — Baltimore, MD
Data Analytics Contractor (2014 – 2016)
- Developed Resident 360 (R360) data validation models and complex SQL queries supporting Department of Human Services (DHS) programs.
- Audited legacy databases and implemented automated data quality validation checks, ensuring 99.8% compliance across state reporting standards and regulatory mandates.

EDUCATION & PROFESSIONAL QUALIFICATIONS
- Bachelor of Computer Applications (BCA) — Navgujarat College of Computer Applications (Ahmedabad, India)
- Association of Accounting Technicians (AAT) Accounting Qualification

TARGET TECH ALIGNMENT FOR \${company.toUpperCase()}:
\${stack}
\`;

  return new NextResponse(fullRichResume, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": \`attachment; filename="Darshan_Modi_ATS_Resume_\${company.replace(/[^a-zA-Z0-9]/g, "_")}.txt"\`
    }
  });
}
`;

fs.writeFileSync("app/api/resume/tailored/route.ts", RICH_RESUME_API, "utf8");

// 2. Remove the old TXT button from app/dashboard/page.tsx and ensure clean formatting
const DASHBOARD_PATH = "app/dashboard/page.tsx";
if (fs.existsSync(DASHBOARD_PATH)) {
  let code = fs.readFileSync(DASHBOARD_PATH, "utf8");

  // Remove the old TXT button snippet if present
  code = code.replace(
    /<a\s+href={\`\/api\/resume\/tailored\?[^}]+\}\s+download=[^>]+>\s*TXT\s*<\/a>/g,
    ""
  );

  fs.writeFileSync(DASHBOARD_PATH, code, "utf8");
  console.log("✅ Removed old TXT button and updated resume export route with full rich content.");
}
