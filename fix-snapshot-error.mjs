import fs from "fs";

const DASHBOARD_PATH = "app/dashboard/page.tsx";
if (fs.existsSync(DASHBOARD_PATH)) {
  let code = fs.readFileSync(DASHBOARD_PATH, "utf8");

  // Ensure DEFAULT_SNAPSHOT is imported or defined at the top of page.tsx
  const importTarget = 'import {';
  const snapshotDefinition = \`const DEFAULT_SNAPSHOT = { score: 98, matchedKeywords: 18, totalKeywords: 20, gatesPassed: 5 };\\n\`;

  if (!code.includes("DEFAULT_SNAPSHOT")) {
    code = snapshotDefinition + code;
    fs.writeFileSync(DASHBOARD_PATH, code, "utf8");
    console.log("✅ Injected DEFAULT_SNAPSHOT definition into dashboard/page.tsx");
  } else {
    console.log("ℹ️ DEFAULT_SNAPSHOT already exists in dashboard/page.tsx");
  }
}
