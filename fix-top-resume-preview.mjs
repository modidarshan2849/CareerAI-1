import fs from "fs";

const DASHBOARD_PATH = "app/dashboard/page.tsx";
if (fs.existsSync(DASHBOARD_PATH)) {
  let code = fs.readFileSync(DASHBOARD_PATH, "utf8");

  // Inject ATS Resume preview section right at the top of the right-hand inspector panel
  const targetInspector = `{selectedJob ? (
                <div className="flex flex-col h-full space-y-4 overflow-hidden">`;

  const updatedInspector = `{selectedJob ? (
                <div className="flex flex-col h-full space-y-4 overflow-hidden">
                  {/* Top ATS Resume Preview & Exporter Bar */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
                        Tailored ATS Resume (95+ Score)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={\`/api/resume/tailored?title=\${encodeURIComponent(selectedJob.title)}&company=\${encodeURIComponent(selectedJob.company)}&stack=\${encodeURIComponent((selectedJob.keywords || []).join(", "))}\`}
                          download={\`Darshan_Modi_ATS_Resume_\${selectedJob.company.replace(/[^a-zA-Z0-9]/g, "_")}.txt\`}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-[10px] font-semibold border border-slate-300"
                        >
                          TXT
                        </a>
                        <a
                          href={\`/api/resume/docx?title=\${encodeURIComponent(selectedJob.title)}&company=\${encodeURIComponent(selectedJob.company)}\`}
                          download={\`Darshan_Modi_ATS_Resume_\${selectedJob.company.replace(/[^a-zA-Z0-9]/g, "_")}.docx\`}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-lg text-[10px] font-semibold border border-slate-300"
                        >
                          .docx
                        </a>
                        <a
                          href={\`/api/resume/pdf?title=\${encodeURIComponent(selectedJob.title)}&company=\${encodeURIComponent(selectedJob.company)}\`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold shadow"
                        >
                          PDF / Print
                        </a>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      Customized with exact keywords for <strong>{selectedJob.company}</strong> &bull; 12 Yrs PFG, Royal Mail &amp; State of MD Experience.
                    </p>
                  </div>`;

  if (code.includes(targetInspector) && !code.includes("Tailored ATS Resume (95+ Score)")) {
    code = code.replace(targetInspector, updatedInspector);
    fs.writeFileSync(DASHBOARD_PATH, code, "utf8");
    console.log("✅ Added top ATS Resume preview and exporter bar to right inspector panel.");
  }
}
