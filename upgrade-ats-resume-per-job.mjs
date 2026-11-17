import fs from "fs";

// Create API routes to generate a tailored ATS resume dynamically per job
fs.mkdirSync("app/api/resume/tailored", { recursive: true });

const TAILORED_ROUTE = `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Senior Data Analyst";
  const company = searchParams.get("company") || "Enterprise Employer";
  const stack = searchParams.get("stack") || "Snowflake, Python, SQL, Power BI, dbt";

  const tailoredResume = \`DARSHAN MODI
Senior Data Analyst II | Virginia Beach, VA | 12 Years Experience
Email: darshan@careerai.local | Phone: Available upon request
LinkedIn: linkedin.com/in/darshan-modi-analytics

EXECUTIVE PROFILE:
Results-driven Senior Data Analyst II with 12 years of enterprise analytics, Snowflake warehousing, Python ETL pipelines, SQL modeling, and executive KPI leadership. Proven track record of aligning data architecture with business objectives to drive supply chain optimization, margin growth, and operational efficiency at enterprise scale (Performance Food Group, Royal Mail Group, State of Maryland). Specially tailored for the \${title} role at \${company}.

CORE TECHNICAL EXPERTISE:
- Data Warehousing & Modeling: Snowflake, dbt, Dimensional Modeling, Schema Design, ETL/ELT Pipelines
- Languages & Querying: Python (Pandas, NumPy), Advanced SQL (Window Functions, CTEs, Performance Tuning)
- BI & Executive Reporting: Power BI, Tableau, Looker, Automated Executive Dashboards
- Cloud & Workflow: AWS, Azure, Apache Airflow, Git, CI/CD, Enterprise Data Governance

PROFESSIONAL EXPERIENCE:

1. PERFORMANCE FOOD GROUP (PFG) | Virginia Beach, VA
   Senior Data Analyst II (2023 - Present)
   - Architected and scaled enterprise Snowflake and Python ETL data pipelines processing high-volume supply chain and commercial distribution telemetry.
   - Designed automated Power BI and Tableau executive KPI dashboards that improved inventory turnover metrics and margin visibility.
   - Enforced rigorous SQL query optimization and dimensional schema governance across enterprise data warehouses, reducing report generation latency by 35%.
   - Partnered directly with executive leadership and supply chain directors to translate complex datasets into strategic, actionable business decisions.

2. ROYAL MAIL GROUP PLC | London, United Kingdom
   Lead Data Analyst (2016 - 2023)
   - Directed an analytics team of ~20 data professionals managing core EBB and Mailmark operational analytics.
   - Spearheaded warehouse data model refactoring, eliminating legacy reporting bottlenecks and boosting query performance across multi-terabyte datasets.
   - Built predictive analytics models in Python and SQL to forecast regional mail volume fluctuations and optimize transportation logistics SLAs.

3. STATE OF MARYLAND (CODEMAX CONSULTING) | Baltimore, MD
   Data Analytics Contractor (2014 - 2016)
   - Developed Resident 360 (R360) data validation models and complex SQL queries supporting Department of Human Services (DHS) programs.
   - Audited legacy databases and implemented automated data quality checks, ensuring 99.8% compliance across state reporting standards.

EDUCATION:
- Bachelor of Computer Applications (BCA)
  Navgujarat College of Computer Applications (Ahmedabad, India)

KEY TARGET SKILLS HIGHLIGHTED FOR \${company.toUpperCase()}:
\${stack}
\`;

  return new NextResponse(tailoredResume, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": \`attachment; filename="Darshan_Modi_ATS_Resume_\${company.replace(/[^a-zA-Z0-9]/g, "_")}.txt"\`
    }
  });
}
`;

fs.writeFileSync("app/api/resume/tailored/route.ts", TAILORED_ROUTE, "utf8");
console.log("✅ Created tailored ATS resume API route.");
