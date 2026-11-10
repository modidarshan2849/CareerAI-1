import { runValidation } from "../validation";
import { WorkExperience } from "../types";

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

function makeExp(overrides: Partial<WorkExperience> & { id: string }): WorkExperience {
  return {
    jobTitle: "Engineer",
    employer: "Acme",
    period: { startDate: "2020-01", endDate: "2021-01", isCurrent: false },
    responsibilities: [],
    achievements: [],
    technologies: [],
    employmentType: "full-time",
    leadershipEvidence: [],
    source: "test",
    needsReview: false,
    ...overrides,
  };
}

console.log("TEST: missing title flagged");
{
  const warnings = runValidation([makeExp({ id: "a", jobTitle: "Unknown — review required" })], []);
  assertTrue(warnings.some((w) => w.type === "missing_title"), "missing_title warning present");
}

console.log("TEST: missing employer flagged");
{
  const warnings = runValidation([makeExp({ id: "a", employer: "" })], []);
  assertTrue(warnings.some((w) => w.type === "missing_employer"), "missing_employer warning present");
}

console.log("TEST: impossible dates flagged");
{
  const warnings = runValidation(
    [makeExp({ id: "a", period: { startDate: "2022-01", endDate: "2020-01", isCurrent: false } })],
    []
  );
  assertTrue(warnings.some((w) => w.type === "impossible_dates"), "impossible_dates warning present");
}

console.log("TEST: overlapping employment flagged (but allowed, not blocked)");
{
  const warnings = runValidation(
    [
      makeExp({ id: "a", period: { startDate: "2015-01", endDate: "2020-01", isCurrent: false } }),
      makeExp({ id: "b", period: { startDate: "2018-01", endDate: "2022-01", isCurrent: false } }),
    ],
    []
  );
  assertTrue(warnings.some((w) => w.type === "overlapping_employment_flagged"), "overlap flagged");
}

console.log("TEST: duplicate role (same title+employer+start) flagged");
{
  const warnings = runValidation(
    [
      makeExp({ id: "a", period: { startDate: "2020-01", endDate: "2021-01", isCurrent: false } }),
      makeExp({ id: "b", period: { startDate: "2020-01", endDate: "2021-06", isCurrent: false } }),
    ],
    []
  );
  assertTrue(warnings.some((w) => w.type === "duplicate_role"), "duplicate_role warning present");
}

console.log("TEST: skill with years but zero evidence is flagged (defensive check against manual tampering)");
{
  const warnings = runValidation([], [
    {
      skillName: "Python",
      yearsOfExperience: 5,
      monthsOfExperience: 0,
      confidence: "High",
      evidence: [],
      sourceRoleIds: [],
    },
  ]);
  assertTrue(warnings.some((w) => w.type === "unsupported_skill_years"), "unsupported_skill_years warning present");
}

console.log("TEST: a clean, fully-specified single role produces zero warnings");
{
  const warnings = runValidation([makeExp({ id: "a" })], []);
  assertTrue(warnings.length === 0, `expected 0 warnings, got ${warnings.length}`);
}

console.log("REGRESSION (V0.1 live-QA audit): absolute minimum salary above target salary is rejected");
{
  const { validateSalaryPreferences } = require("../validation");
  assertTrue(
    validateSalaryPreferences(100000, 150000) !== null,
    "min ($150k) > target ($100k) is flagged as an error"
  );
  assertTrue(
    validateSalaryPreferences(150000, 100000) === null,
    "min ($100k) <= target ($150k) is valid"
  );
  assertTrue(
    validateSalaryPreferences(null, 100000) === null,
    "no target set at all -> no contradiction to flag"
  );
  assertTrue(
    validateSalaryPreferences(100000, null) === null,
    "no minimum set at all -> no contradiction to flag"
  );
  assertTrue(
    validateSalaryPreferences(100000, 100000) === null,
    "min equal to target is allowed (not strictly greater)"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
