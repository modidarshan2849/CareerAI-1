import { calculateMatch } from "../matching";
import { JobPosting, MasterCareerProfile } from "../types";

let passed = 0;
let failed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
  }
}
function assertTrue(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

function baseProfile(overrides: Partial<MasterCareerProfile> = {}): MasterCareerProfile {
  return {
    userId: "u1",
    workExperience: [],
    skills: [
      {
        skillName: "Python",
        yearsOfExperience: 4,
        monthsOfExperience: 0,
        confidence: "High",
        evidence: ["evidence"],
        sourceRoleIds: [],
      },
    ],
    education: [],
    totalExperience: { years: 4, months: 0, isUnknown: false, flagged: false },
    careerStrength: null,
    suggestedRoles: [],
    preferences: {
      targetRoles: [],
      location: null,
      radiusMiles: null,
      remote: false,
      hybrid: false,
      onsite: false,
      targetSalary: null,
      absoluteMinimumSalary: null,
      employmentType: [],
      workAuthorization: null,
      visaStatus: null,
      sponsorshipRequired: null,
      endDate: null,
    },
    validationWarnings: [],
    experienceBreakdown: null,
    activeResumeId: "r1",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseJob(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: "j1",
    title: "Backend Engineer",
    employer: "TestCo",
    location: "Remote",
    remote: true,
    salaryMin: 100000,
    salaryMax: 140000,
    requiresSponsorship: null,
    requirements: ["Python"],
    isOpen: true,
    ...overrides,
  };
}

console.log("TEST: unknown salary does NOT trigger hard exclusion even with absolute minimum set");
{
  const profile = baseProfile({
    preferences: { ...baseProfile().preferences!, absoluteMinimumSalary: 90000 },
  });
  const job = baseJob({ salaryMin: null, salaryMax: null });
  const result = calculateMatch(job, profile);
  assertEqual(result.hardExclusionReasons.length, 0, "no hard exclusion from unknown salary");
  assertTrue(result.status !== "RED" || result.hardExclusionReasons.length === 0, "not excluded purely on unknown data");
}

console.log("TEST: confirmed salary below absolute minimum DOES trigger hard exclusion (RED)");
{
  const profile = baseProfile({
    preferences: { ...baseProfile().preferences!, absoluteMinimumSalary: 150000 },
  });
  const job = baseJob({ salaryMin: 90000, salaryMax: 120000 });
  const result = calculateMatch(job, profile);
  assertEqual(result.status, "RED", "status is RED");
  assertTrue(result.hardExclusionReasons.length > 0, "hard exclusion reason present");
}

console.log("TEST: target salary (soft preference) never hard-excludes, only lowers preference score");
{
  const profile = baseProfile({
    preferences: { ...baseProfile().preferences!, targetSalary: 200000 },
  });
  const job = baseJob({ salaryMin: 100000, salaryMax: 140000 }); // below target but that's fine
  const result = calculateMatch(job, profile);
  assertEqual(result.hardExclusionReasons.length, 0, "target salary never excludes");
  assertTrue(result.preferenceMatch < 100, "preference score is penalized, not zeroed or excluded");
}

console.log("TEST: unknown sponsorship does not auto-pass or auto-fail; only penalizes confidence, not a hard exclusion");
{
  const profile = baseProfile({
    preferences: { ...baseProfile().preferences!, sponsorshipRequired: true },
  });
  const job = baseJob({ requiresSponsorship: null });
  const result = calculateMatch(job, profile);
  assertEqual(result.hardExclusionReasons.length, 0, "unknown sponsorship is not a hard exclusion");
}

console.log("TEST: CONFIRMED no-sponsorship + candidate requires sponsorship => hard exclusion");
{
  const profile = baseProfile({
    preferences: { ...baseProfile().preferences!, sponsorshipRequired: true },
  });
  const job = baseJob({ requiresSponsorship: false });
  const result = calculateMatch(job, profile);
  assertEqual(result.status, "RED", "confirmed sponsorship mismatch excludes");
  assertTrue(result.hardExclusionReasons.length > 0, "reason recorded");
}

console.log("TEST: closed job is always excluded regardless of other scores");
{
  const profile = baseProfile();
  const job = baseJob({ isOpen: false });
  const result = calculateMatch(job, profile);
  assertEqual(result.status, "RED", "closed job is RED");
  assertEqual(result.eligibility, 0, "eligibility zeroed on hard exclusion");
}

console.log("TEST: a weak match does not get forced into GREEN just to pad results");
{
  const profile = baseProfile({
    skills: [], // no established skills at all
  });
  const job = baseJob({ requirements: ["Python", "Go", "Kubernetes", "AWS"] });
  const result = calculateMatch(job, profile);
  assertTrue(result.status !== "GREEN", "no skill evidence => never GREEN");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
