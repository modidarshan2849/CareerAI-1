import { NextResponse } from "next/server";

export async function GET() {
  const resumeText = `DARSHAN MODI
Senior Data Analyst II | Virginia Beach, VA | 12 Years Experience
Email: darshan@careerai.local | Phone: Available upon request

EXECUTIVE SUMMARY:
Senior Data Analyst II with 12 years of enterprise analytics, Snowflake warehousing, Python ETL pipelines, SQL modeling, Power BI, and Tableau leadership across Performance Food Group, Royal Mail Group, and State of Maryland.

CORE TECHNICAL SKILLS:
- Snowflake, Python, SQL, Power BI, Tableau, dbt, Airflow, AWS, Azure, Looker, ETL, Executive KPI Reporting

PROFESSIONAL EXPERIENCE:
1. Performance Food Group (PFG) - Senior Data Analyst II (2023 - Present)
   - Architected Snowflake and Python ETL data pipelines processing enterprise supply chain telemetry.
   - Delivered automated Power BI and Tableau executive dashboards improving inventory turnover.
   - Enforced rigorous SQL data modeling, schema governance, and query optimization.

2. Royal Mail Group plc - Lead Data Analyst (2016 - 2023)
   - Led a high-performing team of ~20 analysts managing EBB and Mailmark analytics.
   - Optimized warehouse data models, reducing report generation latency by 40%.

3. State of Maryland (Codemax Consulting) - Data Analytics Contractor (2014 - 2016)
   - Developed Resident 360 (R360) data validation models and SQL queries for DHS programs.

EDUCATION:
- Bachelor of Computer Applications (BCA), Navgujarat College of Computer Applications (Ahmedabad, India)
`;

  return new NextResponse(resumeText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Darshan_Modi_ATS_Resume.txt"'
    }
  });
}
