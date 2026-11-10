import { calculateCareerGaps } from "../gaps";
import { calculateExperienceBreakdown } from "../careerDomain";
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

console.log("TEST: excluded-domain-experience gap appears when a confirmed domain leaves out 2+ years of history");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Software Engineer", period: { startDate: "2016-01", endDate: "2020-01", isCurrent: false } }),
  ];
  const breakdown = calculateExperienceBreakdown(workExperience, new Date("2020-01-01"), "Software Engineering");
  const gaps = calculateCareerGaps(workExperience, [], [], breakdown);
  assertTrue(
    gaps.some((g) => g.gap.includes("outside your confirmed domain")),
    "gap explicitly names the excluded-experience situation"
  );
}

console.log("TEST: no excluded-domain gap when current domain covers all the person's history");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Data Analyst", period: { startDate: "2018-01", endDate: "2021-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Senior Data Analyst", period: { startDate: "2021-01", endDate: null, isCurrent: true } }),
  ];
  const breakdown = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"));
  const gaps = calculateCareerGaps(workExperience, [], [], breakdown);
  assertTrue(
    !gaps.some((g) => g.gap.includes("outside your confirmed domain")),
    "no excluded-experience gap when there's nothing meaningful excluded"
  );
}

console.log("TEST: 'career direction not yet confirmed' gap appears when confirmation is needed");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Program Coordinator", period: { startDate: "2016-01", endDate: null, isCurrent: true } }),
  ];
  const breakdown = calculateExperienceBreakdown(workExperience, new Date("2020-01-01"));
  const gaps = calculateCareerGaps(workExperience, [], [], breakdown);
  assertTrue(
    gaps.some((g) => g.gap === "Career direction not yet confirmed"),
    "explicit confirmation-needed gap is surfaced, not silently skipped"
  );
}

console.log("TEST: gaps work exactly as before when no experienceBreakdown is passed (backward compatible)");
{
  const workExperience = [makeExp({ id: "a" })];
  const gaps = calculateCareerGaps(workExperience, [], []);
  assertTrue(Array.isArray(gaps), "still returns a valid array with no breakdown argument");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
