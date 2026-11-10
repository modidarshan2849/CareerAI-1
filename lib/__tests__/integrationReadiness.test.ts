import { calculateExperienceBreakdown } from "../careerDomain";
import { suggestRoles, combineWithExplicitTargets, RoleDefinition } from "../roles";
import { recomputeDerivedProfile } from "../recompute";
import { calculateTotalExperience } from "../experience";
import { SkillEvidence, WorkExperience } from "../types";

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
function assertEqual(actual: unknown, expected: unknown, label: string) {
  assertTrue(JSON.stringify(actual) === JSON.stringify(expected), label);
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

// ---------------------------------------------------------------------------
// 1. Profile with no confirmed domain
// ---------------------------------------------------------------------------
console.log("REGRESSION: profile with no confirmed domain — single clear domain still resolves currentDomain automatically");
{
  const workExperience = [makeExp({ id: "a", jobTitle: "Software Engineer" })];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-01-01"), null);
  assertTrue(result.currentDomain === "Software Engineering", "currentDomain resolves without explicit confirmation when unambiguous");
  assertTrue(result.userConfirmedDomain === null, "userConfirmedDomain stays null until the person acts");
}

// ---------------------------------------------------------------------------
// 2. Profile with confirmed domain
// ---------------------------------------------------------------------------
console.log("REGRESSION: profile with confirmed domain — confirmation is respected verbatim");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2018-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Software Engineer", period: { startDate: "2018-01", endDate: "2022-01", isCurrent: false } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-01-01"), "Healthcare & Nursing");
  assertTrue(result.currentDomain === "Healthcare & Nursing", "explicit confirmation overrides the most-recent-role default");
  assertTrue(result.currentDomainYears === 8, "current-domain years computed against the CONFIRMED domain, not the recent one");
}

// ---------------------------------------------------------------------------
// 3 & 4. Changing Domain A -> Domain B, then reverting B -> A
// ---------------------------------------------------------------------------
console.log("REGRESSION: switching Domain A -> Domain B -> back to Domain A yields consistent, reversible results");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }), // 6y
    makeExp({ id: "b", jobTitle: "Software Engineer", period: { startDate: "2016-01", endDate: "2020-01", isCurrent: false } }), // 4y
  ];
  const asA = calculateExperienceBreakdown(workExperience, new Date("2020-06-01"), "Healthcare & Nursing");
  const asB = calculateExperienceBreakdown(workExperience, new Date("2020-06-01"), "Software Engineering");
  const backToA = calculateExperienceBreakdown(workExperience, new Date("2020-06-01"), "Healthcare & Nursing");

  assertTrue(asA.currentDomainYears === 6, "Domain A (nursing) gives 6 years");
  assertTrue(asB.currentDomainYears === 4, "Domain B (engineering) gives 4 years");
  assertEqual(asA, backToA, "reverting to Domain A reproduces byte-identical output to the original Domain A state (no drift/hysteresis)");
  assertTrue(asA.totalYears === asB.totalYears, "total experience is unchanged across every switch");
}

// ---------------------------------------------------------------------------
// 5. Overlapping employment dates
// ---------------------------------------------------------------------------
console.log("REGRESSION: overlapping employment dates never double-count, in total or per-domain, across repeated calls");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Software Engineer", period: { startDate: "2018-01", endDate: "2022-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Senior Software Engineer", period: { startDate: "2020-01", endDate: "2023-01", isCurrent: false } }),
  ];
  const run1 = calculateExperienceBreakdown(workExperience, new Date("2023-06-01"), "Software Engineering");
  const run2 = calculateExperienceBreakdown(workExperience, new Date("2023-06-01"), "Software Engineering");
  assertTrue(run1.totalYears === 5, "union of overlapping ranges = 5 years, not 4+3=7");
  assertEqual(run1, run2, "identical input produces identical output on repeated calls (deterministic)");
}

// ---------------------------------------------------------------------------
// 6. Missing employment dates
// ---------------------------------------------------------------------------
console.log("REGRESSION: missing employment dates are excluded from totals, never invented, and don't crash domain classification");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Software Engineer", period: { startDate: null, endDate: null, isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Senior Software Engineer", period: { startDate: "2020-01", endDate: "2022-01", isCurrent: false } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-06-01"), "Software Engineering");
  assertTrue(result.totalYears === 2, "only the role with usable dates counts toward the total");
  assertTrue(result.currentDomainYears === 2, "same exclusion applies consistently to the current-domain figure");
}

// ---------------------------------------------------------------------------
// 7. Multiple domains (3+)
// ---------------------------------------------------------------------------
console.log("REGRESSION: three or more detected domains are all surfaced, not truncated to two");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2005-01", endDate: "2010-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Marketing Specialist", period: { startDate: "2010-01", endDate: "2015-01", isCurrent: false } }),
    makeExp({ id: "c", jobTitle: "Software Engineer", period: { startDate: "2015-01", endDate: "2022-01", isCurrent: false } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-06-01"));
  assertTrue(result.detectedDomains.length === 3, `all 3 domains detected, got ${result.detectedDomains.length}`);
  assertTrue(result.detectedDomains.includes("Healthcare & Nursing"), "nursing domain present");
  assertTrue(result.detectedDomains.includes("Marketing"), "marketing domain present");
  assertTrue(result.detectedDomains.includes("Software Engineering"), "engineering domain present");
  assertTrue(result.recommendedDomain === "Software Engineering", "recommended domain defaults to the most recent role's domain");
}

// ---------------------------------------------------------------------------
// 8. Senior role -> junior role protection (exact spec scenario)
// ---------------------------------------------------------------------------
console.log("REGRESSION: senior -> junior automatic downgrade is blocked");
{
  const workExperience = [makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2020-01", endDate: null, isCurrent: true } })];
  const skills: SkillEvidence[] = [
    { skillName: "SQL", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const defs: RoleDefinition[] = [
    { role: "Data Analyst", coreSkills: ["SQL"], niceToHaveSkills: [], minYearsForBestFit: 1 },
    { role: "Senior Data Analyst", coreSkills: ["SQL"], niceToHaveSkills: [], minYearsForBestFit: 3 },
  ];
  const results = suggestRoles(defs, skills, workExperience);
  assertTrue(!results.some((r) => r.role === "Data Analyst"), "junior role never auto-suggested below current evidenced level");
}

// ---------------------------------------------------------------------------
// 9. Explicit user preference for a junior role
// ---------------------------------------------------------------------------
console.log("REGRESSION: explicit preference for a junior role is honored and never silently overwritten");
{
  const workExperience = [makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2020-01", endDate: null, isCurrent: true } })];
  const skills: SkillEvidence[] = [
    { skillName: "SQL", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const defs: RoleDefinition[] = [
    { role: "Data Analyst", coreSkills: ["SQL"], niceToHaveSkills: [], minYearsForBestFit: 1 },
    { role: "Senior Data Analyst", coreSkills: ["SQL"], niceToHaveSkills: [], minYearsForBestFit: 3 },
  ];
  const system = suggestRoles(defs, skills, workExperience);
  const combined = combineWithExplicitTargets(system, ["Data Analyst"]);
  const entry = combined.find((r) => r.role === "Data Analyst");
  assertTrue(!!entry && entry.isExplicitUserTarget, "explicit junior target appears and is correctly flagged");

  // Simulate the same combine running again later (e.g. a second page load)
  // with the SAME preference still set — must not duplicate or flip the flag.
  const combinedAgain = combineWithExplicitTargets(system, ["Data Analyst"]);
  assertEqual(combined, combinedAgain, "re-running the combine with unchanged preferences is idempotent");
}

// ---------------------------------------------------------------------------
// 10. Stretch role requiring evidence
// ---------------------------------------------------------------------------
console.log("REGRESSION: higher-level STRETCH role requires evidence, is rejected without it, accepted with it");
{
  const workExperience = [makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2020-01", endDate: null, isCurrent: true } })];
  const skills: SkillEvidence[] = [
    { skillName: "SQL", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Data Visualization", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const defs: RoleDefinition[] = [
    { role: "Analytics Manager", coreSkills: ["SQL", "Data Visualization", "Stakeholder Management"], niceToHaveSkills: [], minYearsForBestFit: 4 },
  ];
  const withoutEvidence = suggestRoles(defs, skills, workExperience);
  assertTrue(!withoutEvidence.some((r) => r.role === "Analytics Manager"), "STRETCH role rejected without leadership evidence or strong coverage");

  const withLeadership = [{ ...workExperience[0], leadershipEvidence: ["Led a team of 4 analysts"] }];
  const withEvidence = suggestRoles(defs, skills, withLeadership);
  const stretch = withEvidence.find((r) => r.role === "Analytics Manager");
  assertTrue(!!stretch && stretch.tier === "STRETCH" && stretch.seniorityRelation === "higher", "STRETCH role accepted and correctly labeled once evidenced");
}

// ---------------------------------------------------------------------------
// 11-13. Profile edits / resume extraction / domain confirmation all trigger
// the SAME recomputation path (verified by calling recomputeDerivedProfile
// directly with the post-event state — this is what all three API routes do)
// ---------------------------------------------------------------------------
console.log("REGRESSION: a simulated 'profile edit' (corrected dates) recomputes consistently through the shared path");
{
  const before = [makeExp({ id: "a", jobTitle: "Software Engineer", period: { startDate: null, endDate: null, isCurrent: false } })];
  const after = [makeExp({ id: "a", jobTitle: "Software Engineer", period: { startDate: "2020-01", endDate: "2022-01", isCurrent: false } })];

  const beforeDerived = recomputeDerivedProfile(before, [], [], null);
  const afterDerived = recomputeDerivedProfile(after, [], [], null);

  assertTrue(beforeDerived.experienceBreakdown.totalYears === null, "before the edit, missing dates leave total experience unknown");
  assertTrue(afterDerived.experienceBreakdown.totalYears === 2, "after the edit, the corrected dates are reflected immediately");
}

console.log("REGRESSION: a simulated 'resume re-extraction' (new work history entirely replacing old) recomputes cleanly with no leftover state");
{
  const oldExtraction = [makeExp({ id: "old1", jobTitle: "Marketing Specialist", period: { startDate: "2015-01", endDate: "2019-01", isCurrent: false } })];
  const newExtraction = [makeExp({ id: "new1", jobTitle: "Software Engineer", period: { startDate: "2019-01", endDate: "2023-01", isCurrent: false } })];

  const oldDerived = recomputeDerivedProfile(oldExtraction, [], [], null);
  const newDerived = recomputeDerivedProfile(newExtraction, [], [], null);

  assertTrue(oldDerived.experienceBreakdown.currentDomain === "Marketing", "old extraction reflects the old domain");
  assertTrue(newDerived.experienceBreakdown.currentDomain === "Software Engineering", "new extraction reflects only the new domain — no blending with old state");
  assertTrue(newDerived.experienceBreakdown.detectedDomains.length === 1, "recompute operates purely on the data passed in; it never remembers a prior call's roles");
}

console.log("REGRESSION: domain confirmation changes recommendations/gaps but never total experience (repeat of exact spec wording)");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Software Engineer", period: { startDate: "2016-01", endDate: "2020-01", isCurrent: false } }),
  ];
  const skills: SkillEvidence[] = [
    { skillName: "JavaScript", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const asEngineering = recomputeDerivedProfile(workExperience, skills, [], "Software Engineering");
  const asNursing = recomputeDerivedProfile(workExperience, skills, [], "Healthcare & Nursing");

  assertTrue(asEngineering.experienceBreakdown.totalYears === asNursing.experienceBreakdown.totalYears, "total experience identical across domain confirmations");
  assertTrue(asEngineering.gaps !== asNursing.gaps, "gaps object differs (different content) between confirmations");
  assertTrue(
    JSON.stringify(asEngineering.gaps) !== JSON.stringify(asNursing.gaps),
    "gaps CONTENT genuinely differs, not just object identity"
  );
}

// ---------------------------------------------------------------------------
// Determinism & no-duplicates
// ---------------------------------------------------------------------------
console.log("REGRESSION: repeated recomputation with identical input is fully deterministic and produces no duplicate roles/gaps");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2020-01", endDate: null, isCurrent: true } }),
  ];
  const skills: SkillEvidence[] = [
    { skillName: "SQL", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];

  const run1 = recomputeDerivedProfile(workExperience, skills, [], null);
  const run2 = recomputeDerivedProfile(workExperience, skills, [], null);
  const run3 = recomputeDerivedProfile(workExperience, skills, [], null);

  assertEqual(run1, run2, "run 1 and run 2 produce byte-identical output");
  assertEqual(run2, run3, "run 2 and run 3 produce byte-identical output");

  const roleNames = run1.systemSuggestedRoles.map((r) => r.role);
  assertTrue(
    new Set(roleNames).size === roleNames.length,
    "no duplicate role names within a single recomputation"
  );
  const gapTexts = run1.gaps.map((g) => g.gap);
  assertTrue(new Set(gapTexts).size === gapTexts.length, "no duplicate gap entries within a single recomputation");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
