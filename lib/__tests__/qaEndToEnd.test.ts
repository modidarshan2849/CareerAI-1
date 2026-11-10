import { calculateExperienceBreakdown } from "../careerDomain";
import { suggestRoles, combineWithExplicitTargets, RoleDefinition } from "../roles";
import { recomputeDerivedProfile } from "../recompute";
import { runValidation } from "../validation";
import { calculateMatch } from "../matching";
import { extractTextFromTxt, extractTextFromPdf, detectFormatFromFilename } from "../parsing/extractText";
import { JobPosting, MasterCareerProfile, SkillEvidence, WorkExperience } from "../types";

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

// =========================================================================
// SECTION 2: exact QA scenario — Sales (earlier) -> IT/Data Analytics (later)
// =========================================================================
console.log("=== SECTION 2: Sales -> IT/Data Analytics career-change scenario ===");
{
  const workExperience = [
    makeExp({ id: "sales", jobTitle: "Account Executive", period: { startDate: "2008-01", endDate: "2016-01", isCurrent: false } }), // 8y Sales
    makeExp({ id: "data", jobTitle: "Data Analyst", period: { startDate: "2016-06", endDate: "2024-06", isCurrent: false } }), // 8y Data & Analytics
  ];

  const asData = calculateExperienceBreakdown(workExperience, new Date("2024-06-01"), "Data & Analytics");
  const asSales = calculateExperienceBreakdown(workExperience, new Date("2024-06-01"), "Sales");

  assertTrue(asData.totalYears === 16, `total experience includes BOTH domains (expected 16, got ${asData.totalYears})`);
  assertTrue(asData.totalYears === asSales.totalYears, "total experience identical no matter which domain is confirmed");
  assertTrue(asData.currentDomainYears === 8, `current-domain experience (Data & Analytics confirmed) = 8y, got ${asData.currentDomainYears}`);
  assertTrue(asSales.currentDomainYears === 8, `current-domain experience (Sales confirmed) = 8y, got ${asSales.currentDomainYears}`);
  assertTrue(
    (asData.currentDomainYears ?? 0) < (asData.totalYears ?? 0),
    "current-domain experience is strictly less than total — older Sales years are not silently counted as Analytics experience"
  );

  // Career gaps update after changing domain
  const gapsAsData = recomputeDerivedProfile(workExperience, [], [], "Data & Analytics").gaps;
  const gapsAsSales = recomputeDerivedProfile(workExperience, [], [], "Sales").gaps;
  assertTrue(
    JSON.stringify(gapsAsData) !== JSON.stringify(gapsAsSales),
    "career gaps content differs between the two confirmed-domain states"
  );

  // Suggested roles: no junior role auto-suggested purely from older Sales experience
  const skills: SkillEvidence[] = [
    { skillName: "SQL", yearsOfExperience: 8, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const defs: RoleDefinition[] = [
    { role: "Sales Development Representative", coreSkills: ["Cold Calling"], niceToHaveSkills: [], minYearsForBestFit: 1 },
    { role: "Data Analyst", coreSkills: ["SQL"], niceToHaveSkills: [], minYearsForBestFit: 1 },
  ];
  const rolesAsData = suggestRoles(defs, skills, workExperience, "Data & Analytics");
  assertTrue(
    !rolesAsData.some((r) => r.role === "Sales Development Representative"),
    "no junior/unrelated Sales role auto-suggested merely because the candidate has older Sales experience, once Analytics is confirmed as current"
  );
  assertTrue(
    rolesAsData.some((r) => r.role === "Data Analyst"),
    "Data Analyst (matches current evidenced level) is correctly suggested"
  );
}

// =========================================================================
// SECTION 3: exact QA scenario — Senior Data Analyst seniority protection
// =========================================================================
console.log("=== SECTION 3: Senior Data Analyst seniority protection ===");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2019-01", endDate: null, isCurrent: true } }),
  ];
  const skills: SkillEvidence[] = [
    { skillName: "SQL", yearsOfExperience: 5, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Excel", yearsOfExperience: 5, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Data Visualization", yearsOfExperience: 5, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const defs: RoleDefinition[] = [
    { role: "Data Analyst", coreSkills: ["SQL", "Excel", "Data Visualization"], niceToHaveSkills: [], minYearsForBestFit: 1 },
    { role: "Senior Data Analyst", coreSkills: ["SQL", "Excel", "Data Visualization"], niceToHaveSkills: [], minYearsForBestFit: 3 },
    { role: "Analytics Manager", coreSkills: ["SQL", "Data Visualization", "Stakeholder Management"], niceToHaveSkills: [], minYearsForBestFit: 4 },
  ];

  const systemNoLeadership = suggestRoles(defs, skills, workExperience);
  assertTrue(!systemNoLeadership.some((r) => r.role === "Data Analyst"), "Data Analyst does NOT appear automatically");
  const seniorEntry = systemNoLeadership.find((r) => r.role === "Senior Data Analyst");
  assertTrue(!!seniorEntry && seniorEntry.tier === "BEST_FIT", "Senior Data Analyst appears as BEST FIT");
  assertTrue(
    !systemNoLeadership.some((r) => r.role === "Analytics Manager"),
    "Analytics Manager does NOT appear as STRETCH without evidence supporting the progression"
  );

  const withLeadership = [{ ...workExperience[0], leadershipEvidence: ["Mentored 2 junior analysts"] }];
  const systemWithLeadership = suggestRoles(defs, skills, withLeadership);
  const managerEntry = systemWithLeadership.find((r) => r.role === "Analytics Manager");
  assertTrue(!!managerEntry && managerEntry.tier === "STRETCH", "Analytics Manager appears as STRETCH once evidence supports the progression");

  // Explicit user preference for Data Analyst
  const combined = combineWithExplicitTargets(systemNoLeadership, ["Data Analyst"]);
  const explicitEntry = combined.find((r) => r.role === "Data Analyst");
  assertTrue(!!explicitEntry, "explicit user preference for Data Analyst IS allowed to appear");
  assertTrue(explicitEntry?.isExplicitUserTarget === true, "the system clearly distinguishes this as an explicit preference, not an automatic recommendation");
  assertTrue(
    combined.find((r) => r.role === "Senior Data Analyst")?.isExplicitUserTarget === false,
    "the automatically-recommended Senior Data Analyst entry remains clearly marked as system-generated, not conflated with the explicit choice"
  );
}

// =========================================================================
// SECTION 7: failure / edge cases
// =========================================================================
console.log("=== SECTION 7: failure and edge cases ===");

console.log("-- missing employment dates --");
{
  const workExperience = [makeExp({ id: "a", period: { startDate: null, endDate: null, isCurrent: false } })];
  const result = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"));
  assertTrue(result.totalYears === null, "missing dates -> total experience is null (unknown), never invented as 0 or guessed");
  const warnings = runValidation(workExperience, []);
  assertTrue(warnings.some((w) => w.type === "missing_dates"), "missing dates produce a validation warning");
}

console.log("-- overlapping employment --");
{
  const workExperience = [
    makeExp({ id: "a", period: { startDate: "2015-01", endDate: "2020-01", isCurrent: false } }),
    makeExp({ id: "b", period: { startDate: "2018-01", endDate: "2022-01", isCurrent: false } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-06-01"));
  assertTrue(result.totalYears === 7, "overlapping employment merges to the union, not a naive sum (7y, not 9y)");
  const warnings = runValidation(workExperience, []);
  assertTrue(warnings.some((w) => w.type === "overlapping_employment_flagged"), "overlap is flagged for review, but not blocked");
}

console.log("-- contradictory employment dates (end before start) --");
{
  const workExperience = [makeExp({ id: "a", period: { startDate: "2022-01", endDate: "2020-01", isCurrent: false } })];
  const warnings = runValidation(workExperience, []);
  assertTrue(warnings.some((w) => w.type === "impossible_dates"), "contradictory dates are flagged");
  const result = calculateExperienceBreakdown(workExperience, new Date("2023-01-01"));
  assertTrue(result.totalYears === null, "the impossible range is excluded rather than silently miscalculated");
}

console.log("-- unclear employer/title --");
{
  const workExperience = [makeExp({ id: "a", jobTitle: "Unknown — review required", employer: "Unknown — review required" })];
  const warnings = runValidation(workExperience, []);
  assertTrue(warnings.some((w) => w.type === "missing_title"), "unclear title flagged");
  assertTrue(warnings.some((w) => w.type === "missing_employer"), "unclear employer flagged");
}

console.log("-- skills listed without evidence --");
{
  const warnings = runValidation([], [
    { skillName: "Kubernetes", yearsOfExperience: 3, monthsOfExperience: 0, confidence: "High", evidence: [], sourceRoleIds: [] },
  ]);
  assertTrue(warnings.some((w) => w.type === "unsupported_skill_years"), "a skill with years but no evidence is flagged, never silently trusted");
}

console.log("-- empty resume (zero-byte file) --");
async function testEmptyResume() {
  const empty = Buffer.from("", "utf-8");
  const result = await extractTextFromTxt(empty);
  assertTrue(result.rawText.trim().length === 0, "empty file extracts to empty text");
  assertTrue(result.warnings.length > 0, "empty resume produces a warning rather than proceeding silently");
}

console.log("-- unsupported file type --");
{
  assertTrue(detectFormatFromFilename("resume.pages") === null, "unsupported extension returns null, never guessed as a supported format");
  assertTrue(detectFormatFromFilename("resume") === null, "no extension at all also returns null");
}

console.log("-- no confirmed domain --");
{
  const workExperience = [makeExp({ id: "a", jobTitle: "Software Engineer" })];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-01-01"), null);
  assertTrue(!result.needsUserConfirmation, "single unambiguous domain doesn't force confirmation even with none explicitly set");
  assertTrue(result.userConfirmedDomain === null, "userConfirmedDomain correctly stays null until the person acts");
}

console.log("-- ambiguous domain --");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Registered Nurse", period: { startDate: "2010-01", endDate: "2016-01", isCurrent: false } }),
    makeExp({ id: "b", jobTitle: "Consultant", period: { startDate: "2016-01", endDate: null, isCurrent: true } }),
  ];
  const result = calculateExperienceBreakdown(workExperience, new Date("2022-01-01"));
  assertTrue(result.needsUserConfirmation, "ambiguous/unclassifiable current role forces confirmation rather than guessing");
}

console.log("-- user changes domain (idempotent re-confirmation) --");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Account Executive", period: { startDate: "2008-01", endDate: "2015-01", isCurrent: false } }), // 7y
    makeExp({ id: "b", jobTitle: "Data Analyst", period: { startDate: "2015-01", endDate: "2024-01", isCurrent: false } }), // 9y
  ];
  const first = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"), "Sales");
  const changed = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"), "Data & Analytics");
  const revert = calculateExperienceBreakdown(workExperience, new Date("2024-01-01"), "Sales");
  assertTrue(JSON.stringify(first) === JSON.stringify(revert), "changing domain and reverting reproduces identical original state (no drift)");
  assertTrue(first.currentDomainYears === 7, `Sales-confirmed current-domain years = 7, got ${first.currentDomainYears}`);
  assertTrue(changed.currentDomainYears === 9, `Data & Analytics-confirmed current-domain years = 9, got ${changed.currentDomainYears}`);
  assertTrue(first.currentDomainYears !== changed.currentDomainYears, "changing domain genuinely changes current-domain experience");
}

console.log("-- no job preferences --");
{
  const job: JobPosting = {
    id: "j1", title: "Data Analyst", employer: "TestCo", location: "Remote", remote: true,
    salaryMin: 80000, salaryMax: 100000, requiresSponsorship: null, requirements: ["SQL"], isOpen: true,
  };
  const profile: MasterCareerProfile = {
    userId: "u1", workExperience: [], skills: [], education: [],
    totalExperience: { years: null, months: null, isUnknown: true, flagged: false },
    experienceBreakdown: null, careerStrength: null, suggestedRoles: [],
    preferences: null, // no preferences set at all
    validationWarnings: [], activeResumeId: null, updatedAt: new Date().toISOString(),
  };
  const match = calculateMatch(job, profile);
  assertTrue(match.hardExclusionReasons.length === 0, "no job preferences never triggers a hard exclusion");
  assertTrue(match.preferenceMatch === 50, "preference match defaults to a neutral score, not a penalty, when no preferences exist");
}

console.log("-- unknown salary --");
{
  const job: JobPosting = {
    id: "j1", title: "Data Analyst", employer: "TestCo", location: "Remote", remote: true,
    salaryMin: null, salaryMax: null, requiresSponsorship: null, requirements: [], isOpen: true,
  };
  const profile: MasterCareerProfile = {
    userId: "u1", workExperience: [], skills: [], education: [],
    totalExperience: { years: null, months: null, isUnknown: true, flagged: false },
    experienceBreakdown: null, careerStrength: null, suggestedRoles: [],
    preferences: {
      targetRoles: [], location: null, radiusMiles: null, remote: false, hybrid: false, onsite: false,
      targetSalary: null, absoluteMinimumSalary: 90000, employmentType: [], workAuthorization: null,
      visaStatus: null, sponsorshipRequired: null, endDate: null,
    },
    validationWarnings: [], activeResumeId: null, updatedAt: new Date().toISOString(),
  };
  const match = calculateMatch(job, profile);
  assertTrue(match.hardExclusionReasons.length === 0, "unknown salary is NEVER treated as a confirmed failure, even with an absolute minimum set");
  assertTrue(match.status !== "RED" || match.hardExclusionReasons.length === 0, "job is not auto-excluded purely because salary is unlisted");
}

async function main() {
  await testEmptyResume();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
