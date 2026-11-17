import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "Senior Data Analyst";
  const company = searchParams.get("company") || "Enterprise Employer";

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Darshan Modi - Executive Resume</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; max-width: 850px; margin: 0 auto; line-height: 1.6; padding: 20px; background: #fff; }
  h1 { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 900; margin: 0 0 5px 0; text-transform: uppercase; color: #000; letter-spacing: 1px; }
  .contact-info { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #444; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #000; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  h2 { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; color: #000; margin-top: 24px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  p { font-size: 12px; color: #222; margin: 0 0 12px 0; text-align: justify; }
  ul { margin: 6px 0 16px 20px; padding: 0; }
  li { font-size: 12px; color: #222; margin-bottom: 6px; line-height: 1.5; text-align: justify; }
  
  .job-header { display: flex; justify-content: space-between; align-items: baseline; margin-top: 18px; margin-bottom: 2px; }
  .job-company { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 800; font-size: 13px; color: #000; }
  .job-date { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; color: #555; }
  .job-title { font-style: italic; font-size: 12.5px; font-weight: 600; color: #333; margin-bottom: 8px; }
  
  .skills-grid { display: grid; grid-template-columns: 1fr; gap: 6px; font-size: 12px; color: #222; margin-bottom: 16px; }
  .skills-grid strong { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #000; }
  
  .page-break { page-break-before: always; padding-top: 20px; }
</style>
</head>
<body onload="window.print()">
  <h1>Darshan Modi</h1>
  <div class="contact-info">
    Virginia, VA 23456 &bull; 757-502-9173 &bull; modi.darshan268@gmail.com &bull; linkedin.com/in/modidarshan268/
  </div>

  <h2>Executive Profile</h2>
  <p>
    Experienced analytics professional with over 13 years of expertise in data strategy, governance, and advanced analytics. Adept at leading cross-functional teams, influencing strategic decision-making, and fostering a data-driven culture. Proven track record in building scalable data repositories, designing comprehensive metrics and reporting frameworks, and driving business growth through actionable insights within the financial services and supply chain sectors. Demonstrates extensive expertise in performing end-to-end data mapping, conducting detailed source-to-target data analysis, and developing scalable data warehouse architectures to optimize ETL workflows and align enterprise ecosystems. Highly calibrated for the <strong>${title}</strong> position at <strong>${company}</strong>.
  </p>

  <h2>Core Competencies</h2>
  <div class="skills-grid">
    <div><strong>Analytics Tools:</strong> Proficiency in advanced SQL, Tableau, Power BI, Python, and enterprise ETL toolchains.</div>
    <div><strong>Data Mapping & Documentation:</strong> Expertise in aligning complex source and target systems, resolving structural inconsistencies, and ensuring flawless data flow.</div>
    <div><strong>Source-to-Target Analysis:</strong> Highly skilled in conducting in-depth analysis to validate transformation logic and guarantee compliance with strict business rules.</div>
    <div><strong>Data Warehouse Solutions:</strong> Proficient in designing, implementing, and optimizing robust relational schemas and architectures for maximum enterprise scalability.</div>
    <div><strong>Data Governance & ETL:</strong> Streamlining ETL processes using advanced SQL to drastically reduce processing times while implementing frameworks that ensure data accuracy, quality, and regulatory compliance.</div>
  </div>

  <h2>Professional Experience</h2>

  <div class="job-header">
    <div class="job-company">Performance Food Group (Richmond, VA)</div>
    <div class="job-date">Feb 2025 – Present</div>
  </div>
  <div class="job-title">Senior Data Analyst</div>
  <ul>
    <li>Led end-to-end development of enterprise data analytics solutions to support critical decision-making across supply chain, sales, and logistics operations, drastically improving reporting efficiency.</li>
    <li>Designed, developed, and maintained robust Power BI dashboards and Tableau reports to track strategic KPIs across multiple business units, enabling C-suite executives to make informed, real-time decisions.</li>
    <li>Extracted, cleaned, and transformed large, unstructured datasets using advanced SQL, Python, and enterprise ETL tools, resulting in a measurable 25% reduction in overall data processing time.</li>
    <li>Developed predictive models and comprehensive trend analyses to accurately forecast customer demand, identify untapped sales opportunities, and proactively mitigate inventory risks.</li>
    <li>Implemented rigorous data validation processes and Quality Assurance checks, successfully increasing data accuracy and stakeholder trust across all internal reporting systems.</li>
    <li>Conducted ad-hoc deep-dive analyses on sales, distribution, and financial performance to support strategic corporate initiatives, including dynamic pricing optimization and regional market expansion.</li>
    <li>Partnered directly with Data Governance and IT Engineering teams to enhance data integrity, streamline data pipelines, and champion data warehouse modernization efforts.</li>
  </ul>

  <div class="job-header">
    <div class="job-company">Maryland MDThink Department of Health Services (DHS)</div>
    <div class="job-date">Oct 2023 – Feb 2025</div>
  </div>
  <div class="job-title">Lead Data Analyst</div>
  <ul>
    <li>Developed and executed comprehensive system monitoring strategies and centralized data repositories, ensuring the unwavering accuracy and operational efficiency of enterprise-wide data pipelines.</li>
    <li>Conducted highly detailed data mapping exercises to perfectly align disparate source and target systems, resolving historical inconsistencies and improving data flow throughput by 40%.</li>
    <li>Performed extensive source-to-target data analysis to validate complex transformation logic and ensure strict compliance with federal and state business rules.</li>
    <li>Designed and successfully implemented robust data warehouse solutions, optimizing database schemas and significantly enhancing raw query execution performance by 50%.</li>
    <li>Leveraged advanced SQL to engineer dynamic reporting tools, automating complex manual workflows and reducing stakeholder manual effort by 30%.</li>
  </ul>

  <div class="page-break"></div>

  <div class="job-header" style="margin-top: 0;">
    <div class="job-company">Maryland MDThink DHS (Continued)</div>
  </div>
  <ul>
    <li>Partnered seamlessly with cross-functional government and technical teams to define precise data requirements, rapidly troubleshoot pipeline issues, and deliver tailored reporting solutions.</li>
    <li>Enhanced state data governance frameworks, guaranteeing regulatory compliance and absolute consistency across fragmented reporting systems.</li>
    <li>Led exhaustive root cause analysis initiatives for data discrepancies, implementing proactive structural measures to maintain long-term data integrity.</li>
  </ul>

  <div class="job-header">
    <div class="job-company">Royal Mail Group (London, UK)</div>
    <div class="job-date">Dec 2020 – Oct 2023</div>
  </div>
  <div class="job-title">Lead Data Analyst</div>
  <ul>
    <li>Designed and architected a proprietary customer transition Database, significantly improving operational efficiency and providing a highly centralized repository for advanced data analytics.</li>
    <li>Spearheaded the design, rapid iteration, and deployment of executive dashboards and reporting tools in Tableau, providing actionable logistical insights that directly drove a revenue growth of $30 million.</li>
    <li>Conducted thorough data mapping and documentation protocols to establish clear, permanent relationships between legacy source systems and modernized target data structures.</li>
    <li>Led enterprise initiatives to seamlessly align data warehouse architectures with evolving business needs, facilitating massively improved scalability and flexibility across the organization.</li>
    <li>Utilized advanced SQL scripting to systematically streamline existing ETL processes, successfully reducing processing time by 25% and minimizing critical system errors.</li>
    <li>Created and rigorously maintained governance frameworks to ensure data quality, absolute accuracy, and adherence to international industry standards.</li>
    <li>Partnered with global compliance and IT infrastructure teams to implement secure, highly efficient data integration workflows supporting key business initiatives.</li>
  </ul>

  <div class="job-header">
    <div class="job-company">Royal Mail Group (London, UK)</div>
    <div class="job-date">Jan 2012 – Nov 2020</div>
  </div>
  <div class="job-title">Senior Data Analyst</div>
  <ul>
    <li>Developed and presented comprehensive reporting packages for senior leadership, actively supporting long-term strategic planning and operational risk management.</li>
    <li>Automated complex reporting workflows using Alteryx and Tableau, achieving a permanent increase in data delivery speed by 40%.</li>
    <li>Partnered closely with software engineering teams to design and implement highly scalable analytics solutions for logistics monitoring.</li>
  </ul>

  <div class="job-header">
    <div class="job-company">EDF Energy (London, UK)</div>
    <div class="job-date">Jul 2005 – Jan 2012</div>
  </div>
  <div class="job-title">Team Leader</div>
  <ul>
    <li>Expertly managed multifaceted analytics projects to continually improve operational performance and regulatory compliance.</li>
    <li>Designed, developed, and maintained SQL-based reporting solutions, enabling live, real-time performance monitoring across the energy grid.</li>
    <li>Led crucial team initiatives to successfully standardize data governance policies and drastically enhance data reliability.</li>
  </ul>

  <h2>Education & Certifications</h2>
  <ul>
    <li><strong>Bachelor of Computer Science</strong> — Gujarat University, Ahmedabad, India (May 2003) <br>
      <em>Specialized in DBMS, Data Management, Data Analysis, and Business Intelligence. Completed major projects on data profiling and data warehousing utilizing SQL and Power BI.</em>
    </li>
    <li><strong>Advanced Excel Certification</strong> — eLearning</li>
    <li><strong>Data Visualization with Power BI</strong> — LinkedIn Learning</li>
    <li><strong>Advanced SQL Certification</strong> — Gujarat University</li>
  </ul>
</body>
</html>`;

  return new NextResponse(htmlContent, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
