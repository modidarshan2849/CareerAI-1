import fs from "fs";
import path from "path";

console.log("🚀 Eradicating the 10-Job Bottleneck from API and UI...");

// 1. FIX THE BACKEND API ENDPOINT (Remove pagination/limits)
const API_PATH = "app/api/jobs/verified/route.ts";

if (fs.existsSync(API_PATH)) {
  let apiCode = fs.readFileSync(API_PATH, "utf8");
  const originalLen = apiCode.length;
  
  // Strip out backend slicing or limit parameters
  apiCode = apiCode.replace(/\.slice\(\s*0\s*,\s*10\s*\)/g, "");
  apiCode = apiCode.replace(/const limit\s*=\s*10;/g, "const limit = 500;");
  
  // Ensure it's returning the full array
  if (!apiCode.includes("GENERATED_228_JOBS")) {
    console.log("⚠️ API endpoint wasn't using the master pool. Rewriting endpoint...");
    apiCode = `import { NextResponse } from 'next/server';
import { GENERATED_228_JOBS, evaluateJobAgainstMasterGate, DEFAULT_MASTER_PREFS } from '../../../../lib/ats/master-jobs-pool';

export async function GET() {
  const verifiedJobs = GENERATED_228_JOBS.filter(job => 
    evaluateJobAgainstMasterGate(job, DEFAULT_MASTER_PREFS)
  );
  return NextResponse.json(verifiedJobs);
}
`;
  }
  
  fs.writeFileSync(API_PATH, apiCode, "utf8");
  console.log("✅ Backend API unlocked: Now serving the full dataset.");
} else {
  // If the API doesn't exist yet, create it properly
  console.log("⚠️ API endpoint not found. Generating a fresh, unthrottled API route...");
  fs.mkdirSync("app/api/jobs/verified", { recursive: true });
  const freshApi = `import { NextResponse } from 'next/server';
import { GENERATED_228_JOBS, evaluateJobAgainstMasterGate, DEFAULT_MASTER_PREFS } from '../../../../lib/ats/master-jobs-pool';

export async function GET() {
  const verifiedJobs = GENERATED_228_JOBS.filter(job => 
    evaluateJobAgainstMasterGate(job, DEFAULT_MASTER_PREFS)
  );
  return NextResponse.json(verifiedJobs);
}
`;
  fs.writeFileSync(API_PATH, freshApi, "utf8");
}

// 2. FIX THE FRONTEND UI (Remove client-side caps)
const DASHBOARD_PATH = "app/dashboard/page.tsx";

if (fs.existsSync(DASHBOARD_PATH)) {
  let uiCode = fs.readFileSync(DASHBOARD_PATH, "utf8");
  
  // Target robust patterns that limit rendering
  uiCode = uiCode.replace(/\.slice\(\s*0\s*,\s*\d+\s*\)/g, ""); // Removes .slice(0, 10)
  uiCode = uiCode.replace(/take\(\d+\)/g, ""); // Removes Lodash/RxJS take limits if present
  uiCode = uiCode.replace(/limit=\d+/g, ""); // Removes fetch limit query params
  
  fs.writeFileSync(DASHBOARD_PATH, uiCode, "utf8");
  console.log("✅ Frontend UI unlocked: Render caps eliminated.");
} else {
  console.log("⚠️ Could not find app/dashboard/page.tsx to clean. Ensure your path is correct.");
}

console.log("🧹 Purging Next.js cache to ensure the changes take effect...");
