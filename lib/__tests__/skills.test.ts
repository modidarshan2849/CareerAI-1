import { buildSkillEvidence } from "../skills";
import { WorkExperience } from "../types";

function makeExp(id: string, tech: string[], start: string, end: string): WorkExperience {
  return {
    id,
    jobTitle: "Engineer",
    employer: "Acme",
    period: { startDate: start, endDate: end, isCurrent: false },
    responsibilities: [],
    achievements: [],
    technologies: tech,
    employmentType: "full-time",
    leadershipEvidence: [],
    source: "test",
    needsReview: false,
  };
}

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

console.log("TEST: a skill only in a bare skills list (no dated role, no explicit years) => 'Experience not established'");
{
  const result = buildSkillEvidence([{ skillName: "Kubernetes" }], []);
  assertEqual(result[0].confidence, "Experience not established", "confidence label");
  assertEqual(result[0].yearsOfExperience, null, "years must be null, never guessed");
}

console.log("TEST: skill mentioned inside a dated role's technologies => years derived from that role's tenure");
{
  const exps = [makeExp("a", ["Python", "Django"], "2020-01", "2023-01")];
  const result = buildSkillEvidence([{ skillName: "Python" }], exps);
  assertEqual(result[0].yearsOfExperience, 3, "3 years from the single supporting role");
  assertEqual(result[0].evidence.length > 0, true, "evidence array is populated");
}

console.log("TEST: skill supported by 2+ roles => High confidence; 1 role => Medium");
{
  const exps = [
    makeExp("a", ["Python"], "2015-01", "2017-01"),
    makeExp("b", ["Python"], "2019-01", "2021-01"),
  ];
  const result = buildSkillEvidence([{ skillName: "Python" }], exps);
  assertEqual(result[0].confidence, "High", "2 supporting roles => High confidence");

  const oneRole = buildSkillEvidence([{ skillName: "Python" }], [exps[0]]);
  assertEqual(oneRole[0].confidence, "Medium", "1 supporting role => Medium confidence");
}

console.log("TEST: explicit resume statement ('5 years of Python') overrides derivation and is still evidence-backed");
{
  const result = buildSkillEvidence(
    [{ skillName: "Python" }],
    [],
    [{ skillName: "Python", years: 5, sourceText: "5 years of Python" }]
  );
  assertEqual(result[0].yearsOfExperience, 5, "years === 5 from explicit statement");
  assertEqual(result[0].evidence.length > 0, true, "evidence points to the explicit statement");
}

console.log("TEST: 'Java' must NOT match inside 'JavaScript' (word-boundary matching, no false-positive evidence)");
{
  const exps = [makeExp("a", ["JavaScript"], "2020-01", "2022-01")];
  const result = buildSkillEvidence([{ skillName: "Java" }], exps);
  assertEqual(result[0].confidence, "Experience not established", "Java gets no false evidence from JavaScript role");
  assertEqual(result[0].yearsOfExperience, null, "years stays null");
}

console.log("TEST: 'JavaScript' itself still correctly matches its own dated role");
{
  const exps = [makeExp("a", ["JavaScript"], "2020-01", "2022-01")];
  const result = buildSkillEvidence([{ skillName: "JavaScript" }], exps);
  assertEqual(result[0].yearsOfExperience, 2, "JavaScript correctly gets 2 years");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
