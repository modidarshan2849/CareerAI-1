import fs from "fs";

const poolPath = "lib/ats/master-jobs-pool.ts";
if (fs.existsSync(poolPath)) {
  let content = fs.readFileSync(poolPath, "utf8");

  // Update evaluateJobAgainstMasterGate to strictly enforce non-remote distance limits
  const oldGateFunction = `export function evaluateJobAgainstMasterGate(job: any, prefs: MasterPreferences = DEFAULT_MASTER_PREFS): boolean {
  const titleLower = String(job.title || "").toLowerCase();
  const isInternOrJr = /\\b(intern|internship|junior|entry level|new grad)\\b/i.test(titleLower);
  const titleMatch =
    prefs.targetTitles.length === 0 ||
    prefs.targetTitles.some(t => titleLower.includes(t.toLowerCase().trim()));
  const miles = Number(job.miles_from_home ?? job.miles ?? 0);
  const isRemote = Boolean(job.is_remote ?? job.remote ?? true);
  const locationMatch = (isRemote && prefs.includeRemote) || miles <= prefs.maxMiles;
  const gate1 = !isInternOrJr && titleMatch && locationMatch;`;

  const newGateFunction = `export function evaluateJobAgainstMasterGate(job: any, prefs: MasterPreferences = DEFAULT_MASTER_PREFS): boolean {
  const titleLower = String(job.title || "").toLowerCase();
  const isInternOrJr = /\\b(intern|internship|junior|entry level|new grad)\\b/i.test(titleLower);
  const titleMatch =
    prefs.targetTitles.length === 0 ||
    prefs.targetTitles.some(t => titleLower.includes(t.toLowerCase().trim()));
  
  const miles = Number(job.miles_from_home ?? job.miles ?? 0);
  const isRemote = Boolean(job.is_remote ?? job.remote ?? false);

  // STRICT RULE: If not remote, must be within maxMiles (25 miles) of Virginia Beach, VA.
  // If not remote and distance exceeds maxMiles, strictly block!
  let locationMatch = false;
  if (isRemote) {
    locationMatch = prefs.includeRemote;
  } else {
    locationMatch = miles <= prefs.maxMiles;
  }

  const gate1 = !isInternOrJr && titleMatch && locationMatch;`;

  if (content.includes("evaluateJobAgainstMasterGate")) {
    content = content.replace(/export function evaluateJobAgainstMasterGate[\s\S]*?const gate1 =[^;]+;/g, newGateFunction);
    fs.writeFileSync(poolPath, content, "utf8");
    console.log("✅ Updated Master Gate to strictly block non-remote jobs outside the 25-mile radius.");
  }
}
