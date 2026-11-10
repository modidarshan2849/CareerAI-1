import { calculateExperienceBreakdown, classifyDomain } from "../careerDomain";
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

console.log("SCENARIO: 10 years as a Registered Nurse (2008-2018), then 4 years as a Software Engineer (2020-present, current)");
{
  const workExperience = [
    makeExp({
      id: "a",
      jobTitle: "Registered Nurse",
      period: { startDate: "2008-01", endDate: "2018-01", isCurrent: false },
    }),
    makeExp({
      id: "b",
      jobTitle: "Software Engineer",
      period: { startDate: "2020-01", endDate: null, isCurrent: true },
    }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"));

  assertTrue(result.totalYears === 14, `Total career experience is the full union (14y), got ${result.totalYears}`);
  assertTrue(
    result.currentDomain === "Software Engineering",
    `Current domain correctly anchored on the most recent role, got "${result.currentDomain}"`
  );
  assertTrue(
    result.currentDomainYears === 4,
    `Current-domain (relevant) experience is only the 4 years as an engineer, NOT the full 14, got ${result.currentDomainYears}`
  );
  assertTrue(
    (result.currentDomainYears ?? 0) < (result.totalYears ?? 0),
    "Relevant experience is explicitly less than total experience — nursing years are not silently counted as engineering experience"
  );
  assertTrue(result.detectedDomains.includes("Healthcare & Nursing"), "Nursing domain is still detected and surfaced, not hidden");
  assertTrue(result.detectedDomains.includes("Software Engineering"), "Engineering domain is detected");
}

console.log("SCENARIO: clear single-domain history should NOT trigger a needless confirmation prompt");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Data Analyst", period: { startDate: "2018-01", endDate: "2021-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Senior Data Analyst", period: { startDate: "2021-01", endDate: null, isCurrent: true } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"));
  assertTrue(!result.needsUserConfirmation, "Single clear domain does not ask for confirmation");
  assertTrue(result.currentDomainYears === result.totalYears, "Current-domain experience equals total when there's only one domain");
}

console.log("SCENARIO: most recent title doesn't classify into any known domain -> system asks, does not assume");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Software Engineer", period: { startDate: "2015-01", endDate: "2021-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Consultant", period: { startDate: "2021-01", endDate: null, isCurrent: true } }), // ambiguous, generic title
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"));
  assertTrue(result.needsUserConfirmation, "Unclassifiable current title triggers a confirmation request rather than a guess");
  assertTrue(
    result.currentDomain !== "Software Engineering" || result.needsUserConfirmation,
    "System does not quietly default to the older, larger domain and call it 'current' without flagging it"
  );
}

console.log("SCENARIO: once the user explicitly confirms their domain, that confirmation is respected and confirmation stops being requested");
{
  const workExperience = [
    makeExp({
      id: "a",
      jobTitle: "Registered Nurse",
      period: { startDate: "2008-01", endDate: "2018-01", isCurrent: false },
    }),
    makeExp({
      id: "b",
      jobTitle: "Software Engineer",
      period: { startDate: "2020-01", endDate: null, isCurrent: true },
    }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"), "Software Engineering");
  assertTrue(!result.needsUserConfirmation, "Explicit user confirmation suppresses the confirmation prompt");
  assertTrue(result.userConfirmedDomain === "Software Engineering", "Confirmed domain is recorded as-is");
  assertTrue(result.currentDomainYears === 4, "Confirmed domain still drives correct current-domain experience math");
}

console.log("TEST: classifyDomain returns null for genuinely unclassifiable titles rather than guessing");
{
  assertTrue(classifyDomain("Consultant") === null, "'Consultant' alone is not forced into a domain");
  assertTrue(classifyDomain("Registered Nurse") === "Healthcare & Nursing", "'Registered Nurse' classifies correctly");
  assertTrue(classifyDomain("Senior Software Engineer") === "Software Engineering", "seniority modifier doesn't break classification");
}

console.log("EXACT SCENARIO: 6 years in Domain A + 4 years in Domain B (sequential, no overlap), Domain B confirmed as current");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }), // 6y, Healthcare
    makeExp({ id: "b", jobTitle: "Software Engineer", period: { startDate: "2016-01", endDate: "2020-01", isCurrent: false } }), // 4y, Software
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2020-01-01"), "Software Engineering");
  assertTrue(result.totalYears === 10, `total = 10 years, got ${result.totalYears}`);
  assertTrue(result.currentDomainYears === 4, `current-domain (Domain B) = 4 years, got ${result.currentDomainYears}`);
}

console.log("EXACT SCENARIO: ambiguous Domain A / Domain B history with no confirmation -> do not guess, require confirmation");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Program Coordinator", period: { startDate: "2016-01", endDate: null, isCurrent: true } }), // unclassifiable title
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2020-01-01"));
  assertTrue(result.needsUserConfirmation, "ambiguous/unclassifiable current title triggers confirmation, never a silent guess");
  assertTrue(result.currentDomain === null, "current domain stays null rather than defaulting to the larger historical bucket (nursing)");
}

console.log("EXACT SCENARIO: overlapping jobs must not double-count in EITHER total or current-domain experience");
{
  const workExperience = [
    // Two overlapping Software Engineering roles: Jan 2018 - Jan 2022 and Jan 2020 - Jan 2023.
    // Union should be Jan 2018 - Jan 2023 = 5 years, not 4 + 3 = 7.
    makeExp({ id: "a", jobTitle: "Software Engineer", period: { startDate: "2018-01", endDate: "2022-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Senior Software Engineer", period: { startDate: "2020-01", endDate: "2023-01", isCurrent: false } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2023-06-01"), "Software Engineering");
  assertTrue(result.totalYears === 5, `total does not double-count the overlap (expected 5, got ${result.totalYears})`);
  assertTrue(
    result.currentDomainYears === 5,
    `current-domain total (same domain for both roles here) also does not double-count (expected 5, got ${result.currentDomainYears})`
  );
}

console.log("EXACT SCENARIO: changing the confirmed domain recalculates current-domain experience WITHOUT changing total experience");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }), // 6y
    makeExp({ id: "b", jobTitle: "Software Engineer", period: { startDate: "2016-01", endDate: "2020-01", isCurrent: false } }), // 4y
  ];
  const asEngineering = calculateExperienceBreakdown(workExperience, new Date("2020-01-01"), "Software Engineering");
  const asNursing = calculateExperienceBreakdown(workExperience, new Date("2020-01-01"), "Healthcare & Nursing");

  assertTrue(asEngineering.totalYears === asNursing.totalYears, "total experience is identical regardless of which domain is confirmed");
  assertTrue(asEngineering.currentDomainYears === 4, "confirming Software Engineering gives 4 years current-domain");
  assertTrue(asNursing.currentDomainYears === 6, "confirming Healthcare & Nursing instead gives 6 years current-domain");
  assertTrue(
    asEngineering.currentDomainYears !== asNursing.currentDomainYears,
    "current-domain experience genuinely changes when the confirmed domain changes"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
