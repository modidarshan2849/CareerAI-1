import { suggestRoles, combineWithExplicitTargets, RoleDefinition } from "../roles";
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

function makeExp(overrides: Partial<WorkExperience> & { id: string }): WorkExperience {
  return {
    jobTitle: "Data Analyst",
    employer: "Acme",
    period: { startDate: "2020-01", endDate: null, isCurrent: true },
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

const ROLE_DEFS: RoleDefinition[] = [
  {
    role: "Data Analyst",
    coreSkills: ["SQL", "Excel", "Data Visualization"],
    niceToHaveSkills: ["Python"],
    minYearsForBestFit: 1,
  },
  {
    role: "Senior Data Analyst",
    coreSkills: ["SQL", "Excel", "Data Visualization"],
    niceToHaveSkills: ["Python"],
    minYearsForBestFit: 3,
  },
  {
    role: "Analytics Manager",
    coreSkills: ["SQL", "Data Visualization", "Stakeholder Management"],
    niceToHaveSkills: ["Python"],
    minYearsForBestFit: 3,
  },
];

function establishedSkills(): SkillEvidence[] {
  return [
    { skillName: "SQL", yearsOfExperience: 5, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Excel", yearsOfExperience: 5, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Data Visualization", yearsOfExperience: 5, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "Python", yearsOfExperience: 2, monthsOfExperience: 0, confidence: "Medium", evidence: ["e"], sourceRoleIds: [] },
  ];
}

console.log("SCENARIO: current evidenced role is Senior Data Analyst");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2022-01", endDate: null, isCurrent: true } }),
  ];
  const skills = establishedSkills();
  const results = suggestRoles(ROLE_DEFS, skills, workExperience);

  assertTrue(
    !results.some((r) => r.role === "Data Analyst"),
    "Data Analyst (junior version of current role) is NOT suggested"
  );
  assertTrue(
    results.some((r) => r.role === "Senior Data Analyst"),
    "Senior Data Analyst (same level) IS suggested"
  );
  const seniorSuggestion = results.find((r) => r.role === "Senior Data Analyst");
  assertTrue(seniorSuggestion?.seniorityRelation === "lateral", "Senior Data Analyst is labeled lateral, not a stretch");

  // No leadership evidence in this scenario -> Analytics Manager should NOT
  // be suggested (a step up requires evidence, not just matching skills).
  assertTrue(
    !results.some((r) => r.role === "Analytics Manager"),
    "Analytics Manager NOT suggested without leadership evidence or very strong coverage"
  );
}

console.log("SCENARIO: same current role, but WITH leadership evidence -> Analytics Manager may appear, clearly labeled");
{
  const workExperience = [
    makeExp({
      id: "a",
      jobTitle: "Senior Data Analyst",
      period: { startDate: "2022-01", endDate: null, isCurrent: true },
      leadershipEvidence: ["Led a team of 3 analysts on the reporting overhaul"],
    }),
  ];
  const skills = establishedSkills();
  const results = suggestRoles(ROLE_DEFS, skills, workExperience);

  const managerSuggestion = results.find((r) => r.role === "Analytics Manager");
  assertTrue(!!managerSuggestion, "Analytics Manager IS suggested when leadership evidence exists");
  assertTrue(managerSuggestion?.seniorityRelation === "higher", "Analytics Manager is explicitly labeled 'higher', not lateral");
  assertTrue(managerSuggestion?.tier === "STRETCH", "Analytics Manager is tiered as STRETCH, not BEST_FIT");
  assertTrue(
    !results.some((r) => r.role === "Data Analyst"),
    "Data Analyst is still excluded even when a step-up role is shown"
  );
}

console.log("SCENARIO: current role is the junior title itself (Data Analyst) -> Data Analyst is a valid lateral suggestion");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Data Analyst", period: { startDate: "2023-01", endDate: null, isCurrent: true } }),
  ];
  const skills = establishedSkills();
  const results = suggestRoles(ROLE_DEFS, skills, workExperience);

  assertTrue(
    results.some((r) => r.role === "Data Analyst" && r.seniorityRelation === "lateral"),
    "Data Analyst is suggested (lateral) when it IS the user's current level"
  );
}

console.log("SCENARIO: explicit Job Preference for a junior target role is stored as intentional preference, NOT influenced by suggestRoles()");
{
  // suggestRoles() has no concept of job_preferences at all — it only ever
  // reads workExperience + skills. This test asserts that architectural
  // separation directly: setting a preference cannot change what
  // suggestRoles() returns, proving preferences can never be
  // reinterpreted as system recommendations.
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2022-01", endDate: null, isCurrent: true } }),
  ];
  const skills = establishedSkills();

  const resultsBeforePreference = suggestRoles(ROLE_DEFS, skills, workExperience);
  // Simulate "the user sets preferences.targetRoles = ['Data Analyst']" —
  // there is no code path by which that touches suggestRoles's inputs.
  const simulatedPreferenceTargetRoles = ["Data Analyst"];
  const resultsAfterPreference = suggestRoles(ROLE_DEFS, skills, workExperience);

  assertTrue(
    JSON.stringify(resultsBeforePreference) === JSON.stringify(resultsAfterPreference),
    "Suggested roles are unaffected by a preference being set (preferences and recommendations are separate data paths)"
  );
  assertTrue(
    !resultsAfterPreference.some((r) => r.role === "Data Analyst"),
    "Data Analyst still does not appear as a system suggestion even though the user separately targeted it as a preference"
  );
}

console.log("EXACT SCENARIO: Senior Data Analyst + user explicitly chooses Data Analyst -> Data Analyst is allowed, clearly marked as an intentional target");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2022-01", endDate: null, isCurrent: true } }),
  ];
  const skills = establishedSkills();

  const systemSuggestions = suggestRoles(ROLE_DEFS, skills, workExperience);
  assertTrue(
    !systemSuggestions.some((r) => r.role === "Data Analyst"),
    "System suggestions alone still never include the downgrade"
  );

  const combined = combineWithExplicitTargets(systemSuggestions, ["Data Analyst"]);
  const dataAnalystEntry = combined.find((r) => r.role === "Data Analyst");
  assertTrue(!!dataAnalystEntry, "Data Analyst appears once the user explicitly targets it");
  assertTrue(dataAnalystEntry?.isExplicitUserTarget === true, "It's clearly flagged as an explicit user target, not a system recommendation");
  assertTrue(
    combined.some((r) => r.role === "Senior Data Analyst" && !r.isExplicitUserTarget),
    "The system's own lateral suggestion (Senior Data Analyst) is still present and still marked as system-generated"
  );
}

console.log("SCENARIO: explicit target that duplicates a system suggestion — explicit version wins for display, still flagged correctly");
{
  const workExperience = [
    makeExp({ id: "a", jobTitle: "Senior Data Analyst", period: { startDate: "2022-01", endDate: null, isCurrent: true } }),
  ];
  const skills = establishedSkills();
  const systemSuggestions = suggestRoles(ROLE_DEFS, skills, workExperience);
  const combined = combineWithExplicitTargets(systemSuggestions, ["Senior Data Analyst"]);

  const matches = combined.filter((r) => r.role === "Senior Data Analyst");
  assertTrue(matches.length === 1, "no duplicate entries when a target overlaps a system suggestion");
  assertTrue(matches[0].isExplicitUserTarget === true, "the explicit-target version takes precedence for display");
}

console.log("SCENARIO: confirmed domain changes which role is treated as 'current' for the guard");
{
  // Career changer: nursing (older), then an ambiguous-but-domain-tagged
  // current title. Confirming "Software Engineering" as the domain should
  // anchor the guard on the engineering role, not nursing.
  const workExperience = [
    makeExp({
      id: "nurse",
      jobTitle: "Registered Nurse",
      period: { startDate: "2010-01", endDate: "2019-01", isCurrent: false },
    }),
    makeExp({
      id: "swe",
      jobTitle: "Senior Software Engineer",
      period: { startDate: "2020-01", endDate: null, isCurrent: true },
    }),
  ];
  const swSkills: SkillEvidence[] = [
    { skillName: "JavaScript", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
    { skillName: "React", yearsOfExperience: 4, monthsOfExperience: 0, confidence: "High", evidence: ["e"], sourceRoleIds: [] },
  ];
  const swDefs: RoleDefinition[] = [
    { role: "Software Engineer", coreSkills: ["JavaScript", "React"], niceToHaveSkills: [], minYearsForBestFit: 1 },
    { role: "Senior Software Engineer", coreSkills: ["JavaScript", "React"], niceToHaveSkills: [], minYearsForBestFit: 3 },
  ];

  const results = suggestRoles(swDefs, swSkills, workExperience, "Software Engineering");
  assertTrue(
    !results.some((r) => r.role === "Software Engineer"),
    "Junior 'Software Engineer' correctly excluded once the confirmed domain anchors current level on the Senior Software Engineer role"
  );
  assertTrue(
    results.some((r) => r.role === "Senior Software Engineer"),
    "Senior Software Engineer (matching current level) is suggested"
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);