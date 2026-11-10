import * as fs from "fs";
import * as path from "path";

/**
 * This test doesn't call any business logic — it inspects the actual route
 * source files on disk to verify the audit requirement "resume extraction,
 * profile edits, and domain confirmation all call the same recomputation
 * path." This is the one part of the request that's genuinely checkable
 * without a live Supabase connection: whether the WIRING is correct is a
 * static property of the source code, not a runtime behavior.
 */

let passed = 0;
let failed = 0;
function assertTrue(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

const ROOT = path.join(__dirname, "..", "..");

const WRITE_ROUTES = [
  "app/api/resume/upload/route.ts",
  "app/api/profile/update/route.ts",
  "app/api/profile/confirm-domain/route.ts",
];

console.log("WIRING AUDIT: all three write routes import and call recomputeDerivedProfile");
for (const route of WRITE_ROUTES) {
  const filePath = path.join(ROOT, route);
  const content = fs.readFileSync(filePath, "utf-8");
  assertTrue(
    /from ["']@\/lib\/recompute["']/.test(content),
    `${route} imports from lib/recompute`
  );
  assertTrue(
    /recomputeDerivedProfile\(/.test(content),
    `${route} actually calls recomputeDerivedProfile(...)`
  );
}

console.log("WIRING AUDIT: no route file duplicates the underlying calculation logic directly");
{
  const appDir = path.join(ROOT, "app");
  const bannedDirectCalls = [
    "calculateCareerStrength(",
    "calculateCareerGaps(",
    "calculateExperienceBreakdown(",
  ];
  // suggestRoles( is allowed to appear in recompute.ts only; route files
  // should never call it directly (they go through recomputeDerivedProfile).
  const offenders: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        const content = fs.readFileSync(full, "utf-8");
        for (const banned of bannedDirectCalls) {
          if (content.includes(banned)) offenders.push(`${full} calls ${banned}`);
        }
        if (content.includes("suggestRoles(") && !full.includes("lib/recompute.ts")) {
          offenders.push(`${full} calls suggestRoles( directly, bypassing recompute.ts`);
        }
      }
    }
  }
  walk(appDir);

  assertTrue(offenders.length === 0, `no route/component duplicates calculation logic (found: ${offenders.join("; ") || "none"})`);
}

console.log("WIRING AUDIT: lib/recompute.ts itself calls all four expected sub-functions exactly once each");
{
  const recomputeSrc = fs.readFileSync(path.join(ROOT, "lib/recompute.ts"), "utf-8");
  for (const fn of ["calculateExperienceBreakdown(", "calculateCareerGaps(", "calculateCareerStrength(", "suggestRoles("]) {
    const occurrences = recomputeSrc.split(fn).length - 1;
    assertTrue(occurrences === 1, `${fn} appears exactly once in recompute.ts (found ${occurrences})`);
  }
}

console.log("WIRING AUDIT: preferences route never writes to suggested_roles or career_strength_snapshots directly (combination happens at read-time, not write-time)");
{
  const prefsSrc = fs.readFileSync(path.join(ROOT, "app/api/preferences/route.ts"), "utf-8");
  assertTrue(!prefsSrc.includes("suggested_roles"), "preferences route does not touch suggested_roles table");
  assertTrue(!prefsSrc.includes("career_strength_snapshots"), "preferences route does not touch career_strength_snapshots table");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
