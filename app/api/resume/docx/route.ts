import { NextResponse } from "next/server";

export async function GET() {
  // Return plain-text formatted for Word / rich text parsing
  const docxContent = `DARSHAN MODI\nSenior Data Analyst II\nVirginia Beach, VA | darshan@careerai.local\n\nEXPERIENCE:\n- Performance Food Group (PFG): Senior Data Analyst II (2023-Present)\n- Royal Mail Group plc: Lead Data Analyst (2016-2023)\n- State of Maryland (Codemax): Data Analyst Contractor (2014-2016)\n\nTECH STACK:\nSnowflake, Python, SQL, Power BI, Tableau, dbt, Airflow, AWS, Azure`;
  
  return new NextResponse(docxContent, {
    headers: {
      "Content-Type": "application/msword",
      "Content-Disposition": 'attachment; filename="Darshan_Modi_ATS_Resume.docx"'
    }
  });
}
