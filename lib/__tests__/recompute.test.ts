import { recomputeDerivedProfile } from "../recompute";
import { WorkExperience, SkillEvidence } from "../types";

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

console.log("TEST: recomputeDerivedProfile threads confirmedDomain consistently through breakdown, gaps, AND role suggestions");
{
  const workExperience = [
    makeExp({ id: "nurse", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2019-01", isCurrent: false } }),
    makeExp({ id: "swe", jobTitle: "Senior Software Engineer", period: { startDate: "2020-01", endDate: "2024-01", isCurrent: false } }),
  ];
  const skills: SkillEvidence[] = [
    { skillName: "JavaScript", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Git", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];

  const result = recomputeDerivedProfile(workExperience, skills, [], "Software Engineering");

  assertTrue(result.experienceBreakdown.currentDomain === "Software Engineering", "breakdown reflects confirmed domain");
  assertTrue(result.experienceBreakdown.currentDomainYears === 4, "breakdown current-domain years correct");
  assertTrue(
    result.gaps.some((g) => g.gap.includes("outside your confirmed domain")),
    "gaps reflect the excluded nursing years"
  );
  assertTrue(
    !result.systemSuggestedRoles.some((r) => r.role === "Software Engineer"),
    "role suggestions correctly guard against downgrade using the domain-scoped current level"
  );
  assertTrue(
    result.systemSuggestedRoles.some((r) => r.role === "Senior Software Engineer"),
    "role suggestions include the correctly-anchored lateral match"
  );
}

console.log("TEST: changing confirmedDomain via recomputeDerivedProfile changes gaps/roles but not total experience");
{
  const workExperience = [
    makeExp({ id: "nurse", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }),
    makeExp({ id: "swe", jobTitle: "Software Engineer", period: { startDate: "2016-01", endDate: "2020-01", isCurrent: false } }),
  ];
  const asEngineering = recomputeDerivedProfile(workExperience, [], [], "Software Engineering");
  const asNursing = recomputeDerivedProfile(workExperience, [], [], "Healthcare & Nursing");

  assertTrue(
    asEngineering.experienceBreakdown.totalYears === asNursing.experienceBreakdown.totalYears,
    "total experience is unaffected by which domain is confirmed"
  );
  assertTrue(
    asEngineering.experienceBreakdown.currentDomainYears !== asNursing.experienceBreakdown.currentDomainYears,
    "current-domain experience differs based on confirmed domain"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
