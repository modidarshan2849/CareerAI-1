import fs from "fs";

const PAGE_PATH = "app/dashboard/page.tsx";
if (fs.existsSync(PAGE_PATH)) {
  let code = fs.readFileSync(PAGE_PATH, "utf8");

  // Update tabs to include resume
  code = code.replace(
    /setActiveTab\("dashboard" \| "preferences"\)/g,
    'setActiveTab("dashboard" | "preferences" | "resume")'
  );

  // If resume tab view isn't there yet, append it
  if (!code.includes('activeTab === "resume"')) {
    const resumeTabJSX = `
      {/* TAB 3: ATS RESUME & PROFILE */}
      {activeTab === "resume" && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Darshan Modi</h2>
                <p className="text-xs text-indigo-400 font-semibold mt-0.5">
                  Senior Data Analyst II &bull; 12 Years Experience &bull; Virginia Beach, VA
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const resumeText = \`DARSHAN MODI
Senior Data Analyst II | Virginia Beach, VA | 12 Years Experience

SUMMARY:
Senior Data Analyst II with 12 years of enterprise analytics, Snowflake warehousing, Python ETL pipelines, SQL modeling, Power BI, and Tableau leadership across Performance Food Group, Royal Mail Group, and State of Maryland.

CORE TECHNICAL SKILLS:
- Snowflake, Python, SQL, Power BI, Tableau, dbt, Airflow, AWS, Azure, Looker

PROFESSIONAL EXPERIENCE:
1. Performance Food Group (PFG) - Senior Data Analyst II (2023 - Present)
   - Architected Snowflake and Python ETL data pipelines processing enterprise supply chain telemetry.
   - Delivered automated Power BI and Tableau executive dashboards improving inventory turnover.
2. Royal Mail Group plc - Lead Data Analyst (2016 - 2023)
   - Led ~20 analysts managing EBB/Mailmark analytics and optimizing warehouse data models.
3. State of Maryland (Codemax Consulting) - Data Analytics Contractor (2014 - 2016)
   - Developed Resident 360 (R360) data validation models and SQL queries for DHS programs.

EDUCATION:
- Bachelor of Computer Applications (BCA), Navgujarat College of Computer Applications (Ahmedabad, India)
\`;
                  navigator.clipboard.writeText(resumeText);
                  showToast("Copied complete ATS resume to clipboard!");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow"
              >
                Copy ATS Resume Text
              </button>
            </div>

            {/* Summary & Skills */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Executive Summary</h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                Senior Data Analyst II with 12 years of enterprise analytics, Snowflake warehousing, Python ETL pipelines, SQL modeling, Power BI, and Tableau leadership across Performance Food Group, Royal Mail Group, and State of Maryland.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Technical Master Stack</h3>
              <div className="flex flex-wrap gap-2">
                {["Snowflake", "Python", "SQL", "Power BI", "Tableau", "dbt", "Airflow", "AWS", "Azure", "Looker", "ETL", "Executive KPI Reporting"].map(skill => (
                  <span key={skill} className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 border border-indigo-500/30 text-indigo-200">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Work Experience (12 Years Verified)</h3>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">Senior Data Analyst II</h4>
                    <p className="text-xs text-indigo-400">Performance Food Group (PFG) &bull; Virginia Beach, VA</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">2023 - Present</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                  <li>Architected Snowflake and Python ETL data pipelines processing enterprise supply chain telemetry.</li>
                  <li>Delivered automated Power BI and Tableau executive dashboards improving inventory turnover.</li>
                  <li>Enforced rigorous SQL data modeling, schema governance, and query optimization.</li>
                </ul>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">Lead Data Analyst</h4>
                    <p className="text-xs text-indigo-400">Royal Mail Group plc &bull; London, UK</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">2016 - 2023</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                  <li>Led a high-performing team of ~20 analysts managing EBB and Mailmark analytics.</li>
                  <li>Optimized warehouse data models, reducing report generation latency by 40%.</li>
                </ul>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">Data Analytics Contractor (State of Maryland)</h4>
                    <p className="text-xs text-indigo-400">Codemax Consulting &bull; Baltimore, MD</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">2014 - 2016</span>
                </div>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                  <li>Developed Resident 360 (R360) data validation models and SQL queries for DHS programs.</li>
                </ul>
              </div>
            </div>

            {/* Education */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Education</h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-white">Bachelor of Computer Applications (BCA)</h4>
                  <p className="text-xs text-slate-400">Navgujarat College of Computer Applications &bull; Ahmedabad, India</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  </div>`;

    // Insert before final closing tags
    code = code.replace(/<\/\s*div\s*>\s*<\/\s*div\s*>\s*$/, resumeTabJSX + "\n</div>\n</div>");
    fs.writeFileSync(PAGE_PATH, code, "utf8");
    console.log("✅ Added ATS Resume tab to app/dashboard/page.tsx");
  }
}
