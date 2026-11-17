import fs from "fs";

const DASHBOARD_PATH = "app/dashboard/page.tsx";
if (fs.existsSync(DASHBOARD_PATH)) {
  let code = fs.readFileSync(DASHBOARD_PATH, "utf8");

  // Check if the tailored resume button is already in the inspector footer
  if (!code.includes("Download Tailored ATS Resume")) {
    // Find the right-side inspector footer and inject the button before Apply Direct
    const targetSnippet = `<a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                    >
                      Apply Direct on Site &rarr;
                    </a>`;

    const replacementSnippet = `<a
                      href={\`/api/resume/tailored?title=\${encodeURIComponent(selectedJob.title)}&company=\${encodeURIComponent(selectedJob.company)}&stack=\${encodeURIComponent((selectedJob.keywords || []).join(", "))}\`}
                      download={\`Darshan_Modi_ATS_Resume_\${selectedJob.company.replace(/[^a-zA-Z0-9]/g, "_")}.txt\`}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
                    >
                      Download Tailored ATS Resume (.txt)
                    </a>
                    <a
                      href={selectedJob.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow"
                    >
                      Apply Direct &rarr;
                    </a>`;

    if (code.includes(targetSnippet)) {
      code = code.replace(targetSnippet, replacementSnippet);
      fs.writeFileSync(DASHBOARD_PATH, code, "utf8");
      console.log("✅ Added 'Download Tailored ATS Resume' button to right-hand inspector panel.");
    } else {
      console.log("⚠️ Target snippet not found, appending manually.");
    }
  }
}
