import fs from "fs";

const uiPaths = ["./src/app/dashboard/page.tsx", "./app/dashboard/page.tsx"];
const targetUI = uiPaths.find(p => fs.existsSync(p));

if (!targetUI) {
  console.log("⚠️ Dashboard page not found at standard paths.");
  process.exit(0);
}

let code = fs.readFileSync(targetUI, "utf8");

if (!code.includes("workModeFilter")) {
  // 1. Add workModeFilter state right after the first useState
  code = code.replace(
    /(const\s+\[[^\]]+\]\s*=\s*useState\([^)]*\);)/,
    `$1\n  const [workModeFilter, setWorkModeFilter] = useState<"ALL" | "Remote" | "Hybrid" | "On-site">("ALL");`
  );

  // 2. Inject the interactive Work Mode filter bar above the job list container
  const filterBarJSX = `
      <div className="flex flex-wrap items-center gap-2 my-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">Work Mode:</span>
        {(["ALL", "Remote", "Hybrid", "On-site"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setWorkModeFilter(mode)}
            className={\`px-3 py-1.5 rounded-md text-xs font-semibold transition-all \${
              workModeFilter === mode
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }\`}
          >
            {mode === "ALL" ? "All Modes" : mode}
          </button>
        ))}
      </div>`;

  // Attach filter condition to mapped job arrays if rendered directly
  code = code.replace(
    /(\b(?:filteredJobs|jobs|displayedJobs)\.map\()/,
    `($1`.replace("(", "")
  );
  code = code.replace(
    /\b(filteredJobs|jobs|displayedJobs)\.map\(/g,
    `$1.filter((j: any) => workModeFilter === "ALL" || j.work_mode === workModeFilter).map(`
  );

  if (code.includes("Loaded Requisitions:")) {
    code = code.replace(/(🚀 Loaded Requisitions:[^<]*<\/div>)/, `$1\n${filterBarJSX}`);
  } else {
    code = code.replace(/(<h1[^>]*>.*?<\/h1>)/s, `$1\n${filterBarJSX}`);
  }

  fs.writeFileSync(targetUI, code, "utf8");
  console.log(`✅ Restored Work Mode filter bar (All / Remote / Hybrid / On-site) in ${targetUI}`);
} else {
  console.log("✔️ Work Mode filter bar is already present.");
}
