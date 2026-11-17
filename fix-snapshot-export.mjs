import fs from "fs";

const POOL_PATH = "lib/ats/master-jobs-pool.ts";
if (fs.existsSync(POOL_PATH)) {
  let code = fs.readFileSync(POOL_PATH, "utf8");
  
  if (!code.includes("DEFAULT_SNAPSHOT")) {
    code += `\nexport const DEFAULT_SNAPSHOT = { \n  score: 98, \n  matchedKeywords: 18, \n  totalKeywords: 20, \n  gatesPassed: 5 \n};\n`;
    fs.writeFileSync(POOL_PATH, code, "utf8");
    console.log("✅ Restored DEFAULT_SNAPSHOT export to lib/ats/master-jobs-pool.ts");
  } else {
    console.log("ℹ️ DEFAULT_SNAPSHOT already exists.");
  }
}
