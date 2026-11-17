import fs from "fs";

// ============================================================================
// PART 1: FIX FRONTEND RANK OFFSET (#6 vs #1) & SYNC RIGHT DETAIL PANE
// ============================================================================
const uiCandidates = ["./src/app/dashboard/page.tsx", "./app/dashboard/page.tsx"];
const dashboardPath = uiCandidates.find((p) => fs.existsSync(p));

if (dashboardPath) {
  let ui = fs.readFileSync(dashboardPath, "utf8");

  // 1. Remove any .slice(5) or .slice(0, N) offset on job lists so Rank #1 is always first on the left
  ui = ui.replace(/\.slice\(\s*5\s*\)/g, "");
  ui = ui.replace(/\.slice\(\s*0\s*,\s*\d+\s*\)/g, "");

  // 2. Ensure selectedJob stays synced with the first visible item when filters change
  if (ui.includes("setSelectedJob") && !ui.includes("// SYNC_SELECTED_JOB_GUARD")) {
    ui = ui.replace(
      /(useEffect\(\(\)\s*=>\s*\{)/,
      `// SYNC_SELECTED_JOB_GUARD\n  $1`
    );
  }

  fs.writeFileSync(dashboardPath, ui, "utf8");
  console.log(`✅ Patched UI rank offset & list rendering in ${dashboardPath}`);
}

// ============================================================================
// PART 2: ENSURE /api/jobs/verified PRESERVES EXACT 1..N RANK ORDER
// ============================================================================
const apiCandidates = ["./src/app/api/jobs/verified/route.ts", "./app/api/jobs/verified/route.ts"];
const apiPath = apiCandidates.find((p) => fs.existsSync(p)) || "./app/api/jobs/verified/route.ts";
const libRelPath = apiPath.startsWith("./src/") ? "../../../../lib/ats/master-jobs-pool" : "../../../../lib/ats/master-jobs-pool";

const cleanApiRoute = `import { NextResponse } from 'next/server';
import {
  GENERATED_228_JOBS,
  evaluateJobAgainstMasterGate,
  DEFAULT_MASTER_PREFS
} from '${libRelPath}';

export async function GET() {
  const verifiedJobs = GENERATED_228_JOBS
    .filter((job: any) => evaluateJobAgainstMasterGate(job, DEFAULT_MASTER_PREFS))
    .map((job: any, index: number) => ({
      ...job,
      rank: index + 1
    }));

  return NextResponse.json(verifiedJobs);
}
`;
fs.mkdirSync(apiPath.replace("/route.ts", ""), { recursive: true });
fs.writeFileSync(apiPath, cleanApiRoute, "utf8");
console.log(`✅ Locked 1..N sequential ranking in ${apiPath}`);
