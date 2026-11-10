import {
  CANDIDATE_A_WORK_EXPERIENCE,
  CANDIDATE_A_SKILLS,
  CANDIDATE_A_EDUCATION,
  CANDIDATE_A_EXPECTATIONS,
} from "../../scripts/candidateAFixture";
import { calculateExperienceBreakdown } from "../careerDomain";
import { recomputeDerivedProfile } from "../recompute";
import { suggestRoles, RoleDefinition } from "../roles";
import { runValidation } from "../validation";

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

const REFERENCE_DATE = new Date("2024-06-01");

console.log("CANDIDATE A FIXTURE: skill evidence built correctly on import");
{
  const withEvidence = CANDIDATE_A_SKILLS.filter((s) => s.confidence !== "Experience not established");
  const withoutEvidence = CANDIDATE_A_SKILLS.find((s) => s.skillName === CANDIDATE_A_EXPECTATIONS.skillWithoutEvidence);

  assertTrue(
    CANDIDATE_A_EXPECTATIONS.skillsWithEvidence.every((name) => withEvidence.some((s) => s.skillName === name)),
    "SQL, Excel, and Data Visualization all have real evidence"
  );
  assertTrue(
    !!withoutEvidence && withoutEvidence.confidence === "Experience not established",
    "Stakeholder Management correctly shows 'Experience not established' — listed but never evidenced"
  );
  assertTrue(withoutEvidence?.yearsOfExperience === null, "the unevidenced skill has no invented year count");
}

console.log("CANDIDATE A FIXTURE: overlapping Data Analyst / Senior Data Analyst roles merge correctly (no double-count)");
{
  const asData = calculateExperienceBreakdown(CANDIDATE_A_WORK_EXPERIENCE, REFERENCE_DATE, "Data & Analytics");
  // 2016-06 to 2024-06 = exactly 8 years, even though two overlapping role
  // records span that period (2016-06→2020-06 and 2019-09→present).
  assertTrue(asData.currentDomainYears === 8, `current-domain (Data) years = 8, got ${asData.currentDomainYears}`);
}

console.log("CANDIDATE A FIXTURE: total experience includes both Sales and Data & Analytics");
{
  const asData = calculateExperienceBreakdown(CANDIDATE_A_WORK_EXPERIENCE, REFERENCE_DATE, "Data & Analytics");
  // Sales: 2008-01 to 2016-01 = 8y. Data: 2016-06 to 2024-06 = 8y (merged).
  // Total = union across everything = 16y 5m (small gap between 2016-01 and
  // 2016-06 is real, not an overlap, so it's NOT compressed away).
  assertTrue(asData.totalYears === 16, `total years = 16, got ${asData.totalYears}`);
}

console.log("CANDIDATE A FIXTURE: switching confirmed domain changes current-domain experience, not total");
{
  const asSales = calculateExperienceBreakdown(CANDIDATE_A_WORK_EXPERIENCE, REFERENCE_DATE, "Sales");
  const asData = calculateExperienceBreakdown(CANDIDATE_A_WORK_EXPERIENCE, REFERENCE_DATE, "Data & Analytics");
  assertTrue(asSales.currentDomainYears === 8, `Sales-confirmed current-domain years = 8, got ${asSales.currentDomainYears}`);
  assertTrue(asSales.totalYears === asData.totalYears, "total experience identical across the domain switch");
}

console.log("CANDIDATE A FIXTURE: seniority protection — Data Analyst never auto-suggested, Senior Data Analyst is");
{
  const defs: RoleDefinition[] = [
    { role: "Data Analyst", coreSkills: ["SQL", "Excel", "Data Visualization"], niceToHaveSkills: [], minYearsForBestFit: 1 },
    { role: "Senior Data Analyst", coreSkills: ["SQL", "Excel", "Data Visualization"], niceToHaveSkills: [], minYearsForBestFit: 3 },
    { role: "Analytics Manager", coreSkills: ["SQL", "Data Visualization", "Stakeholder Management"], niceToHaveSkills: [], minYearsForBestFit: 4 },
  ];
  const results = suggestRoles(defs, CANDIDATE_A_SKILLS, CANDIDATE_A_WORK_EXPERIENCE, "Data & Analytics");
  assertTrue(!results.some((r) => r.role === "Data Analyst"), "Data Analyst not auto-suggested");
  assertTrue(results.some((r) => r.role === "Senior Data Analyst"), "Senior Data Analyst IS suggested");
  // Candidate A DOES have leadership evidence ("Mentors 2 junior analysts"),
  // so Analytics Manager should clear the evidence bar despite missing the
  // "Stakeholder Management" skill outright.
  assertTrue(results.some((r) => r.role === "Analytics Manager"), "Analytics Manager appears as an evidenced STRETCH (leadership evidence present)");
  const manager = results.find((r) => r.role === "Analytics Manager");
  assertTrue(manager?.tier === "STRETCH", "Analytics Manager is tiered STRETCH, not BEST_FIT");
  assertTrue(
    manager?.importantGaps.some((g) => g.includes("Stakeholder Management")),
    "the gap on the missing core skill is explicitly named"
  );
}

console.log("CANDIDATE A FIXTURE: full recompute pipeline runs end-to-end with no errors and produces internally consistent output");
{
  const derived = recomputeDerivedProfile(
    CANDIDATE_A_WORK_EXPERIENCE,
    CANDIDATE_A_SKILLS,
    CANDIDATE_A_EDUCATION,
    "Data & Analytics"
  );
  // recomputeDerivedProfile always uses the real current time internally
  // (correct for production use), so compare it against a fresh direct
  // calculation using "now" too — not the fixed REFERENCE_DATE used above,
  // which would make this assertion drift further from reality every day
  // this test suite is run.
  const directNow = calculateExperienceBreakdown(CANDIDATE_A_WORK_EXPERIENCE, new Date(), "Data & Analytics");
  assertTrue(
    derived.experienceBreakdown.totalYears === directNow.totalYears,
    `recompute pipeline total (${derived.experienceBreakdown.totalYears}) matches a direct calculation using the same "now" (${directNow.totalYears})`
  );
  assertTrue(derived.strength.score > 0 && derived.strength.score <= 95, "career strength is in valid range");
  assertTrue(Array.isArray(derived.gaps), "gaps computed without error");
  assertTrue(Array.isArray(derived.systemSuggestedRoles), "role suggestions computed without error");
  assertTrue(Array.isArray(derived.validationWarnings), "validation warnings computed without error");
}

console.log("CANDIDATE A FIXTURE: validation warnings reflect the deliberate overlap (flagged, not blocked)");
{
  const warnings = runValidation(CANDIDATE_A_WORK_EXPERIENCE, CANDIDATE_A_SKILLS);
  assertTrue(
    warnings.some((w) => w.type === "overlapping_employment_flagged"),
    "the deliberate promotion-overlap between the two Data roles is flagged for review"
  );
}

console.log("CANDIDATE A FIXTURE: most recent role classifies confidently, so no forced confirmation prompt (but Change control still shows both domains)");
{
  const result = calculateExperienceBreakdown(CANDIDATE_A_WORK_EXPERIENCE, REFERENCE_DATE, null);
  assertTrue(result.needsUserConfirmation === false, "no forced confirmation — Senior Data Analyst classifies unambiguously");
  assertTrue(result.currentDomain === "Data & Analytics", "auto-resolves to Data & Analytics without user action");
  assertTrue(
    result.detectedDomains.length === 2 && result.detectedDomains.includes("Sales"),
    "Sales is still surfaced in detectedDomains so the 'Change' control can offer it"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
