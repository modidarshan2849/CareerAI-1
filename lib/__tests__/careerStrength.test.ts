import { calculateCareerStrength } from "../careerStrength";
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

console.log("TEST: even a maximally strong profile never scores above 95");
{
  const workExperience: WorkExperience[] = Array.from({ length: 5 }).map((_, i) => ({
    id: `e${i}`,
    jobTitle: "Senior Engineer",
    employer: `Company${i}`,
    period: { startDate: `${2010 + i * 2}-01`, endDate: `${2012 + i * 2}-01`, isCurrent: false },
    responsibilities: ["Led team"],
    achievements: ["Increased revenue by 40% and cut costs by $2M"],
    technologies: ["Python"],
    employmentType: "full-time",
    leadershipEvidence: ["Managed a team of 10"],
    source: "test",
    needsReview: false,
  }));
  const skills: SkillEvidence[] = [
    {
      skillName: "Python",
      yearsOfExperience: 10,
      monthsOfExperience: 0,
      confidence: "High",
      evidence: ["evidence"],
      sourceRoleIds: [],
    },
  ];
  const result = calculateCareerStrength(workExperience, skills, [
    { id: "ed1", institution: "MIT", credential: "BS", field: "CS", graduationDate: "2010-06", source: "resume" },
  ], {
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
  });
  assertTrue(result.score <= 95, `score (${result.score}) is capped at 95`);
  assertTrue(result.score > 60, `strong profile still scores meaningfully high (${result.score})`);
}

console.log("TEST: an empty profile scores very low, not a default/placeholder value");
{
  const result = calculateCareerStrength([], [], [], null);
  assertTrue(result.score < 20, `empty profile scores low (${result.score})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
