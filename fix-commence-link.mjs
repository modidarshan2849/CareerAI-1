import fs from "fs";

const poolPath = "lib/ats/master-jobs-pool.ts";
if (fs.existsSync(poolPath)) {
  let content = fs.readFileSync(poolPath, "utf8");

  // Replace broken/expired Paylocity deep link with Commence's active corporate career portal
  content = content.replace(
    /https:\/\/recruiting\.paylocity\.com\/recruiting\/jobs\/Details\/4474085\/Commence\/Sr-Data-Analyst/g,
    "https://recruiting.paylocity.com/recruiting/jobs/All/9900928c-281f-44fc-acbb-7eefed2c4e24/Commence"
  );

  fs.writeFileSync(poolPath, content, "utf8");
  console.log("✅ Updated Commence job URL to active Paylocity career board.");
}
