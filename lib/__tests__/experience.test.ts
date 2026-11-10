import { calculateTotalExperience, detectOverlaps } from "../experience";
import { WorkExperience } from "../types";

function makeExp(
  id: string,
  start: string | null,
  end: string | null,
  isCurrent = false
): WorkExperience {
  return {
    id,
    jobTitle: "Engineer",
    employer: "Acme",
    period: { startDate: start, endDate: end, isCurrent },
    responsibilities: [],
    achievements: [],
    technologies: [],
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
    console.log(`  FAIL: ${label}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
  }
}

console.log("TEST: spec's own overlap example — Jan2015-Jan2020 + Jan2018-Jan2022 must NOT equal 9 years");
{
  const exps = [makeExp("a", "2015-01", "2020-01"), makeExp("b", "2018-01", "2022-01")];
  const result = calculateTotalExperience(exps, new Date("2023-06-01"));
  // Union: 2015-01 to 2022-01 = 7 years exactly
  assertEqual(result.years, 7, "years === 7 (union), not 9 (naive sum)");
  assertEqual(result.months, 0, "months === 0");
  assertEqual(result.mergedRangeCount, 1, "the two overlapping ranges merge into 1");
}

console.log("TEST: non-overlapping ranges sum normally");
{
  const exps = [makeExp("a", "2015-01", "2017-01"), makeExp("b", "2018-01", "2020-01")];
  const result = calculateTotalExperience(exps, new Date("2023-06-01"));
  assertEqual(result.years, 4, "2 + 2 years = 4 years total");
  assertEqual(result.mergedRangeCount, 2, "ranges stay separate (no overlap)");
}

console.log("TEST: missing dates are excluded and flagged, not invented");
{
  const exps = [makeExp("a", null, null), makeExp("b", "2020-01", "2021-01")];
  const result = calculateTotalExperience(exps, new Date("2023-06-01"));
  assertEqual(result.years, 1, "only the valid record counts");
  assertEqual(result.excludedRecordIds, ["a"], "record with no dates is excluded, not guessed at");
  assertEqual(result.flagged, true, "flagged for review");
}

console.log("TEST: all-missing dates => fully unknown, never defaults to 0 pretending it's real");
{
  const exps = [makeExp("a", null, null)];
  const result = calculateTotalExperience(exps, new Date("2023-06-01"));
  assertEqual(result.isUnknown, true, "isUnknown === true");
  assertEqual(result.years, null, "years === null, not 0");
}

console.log("TEST: impossible dates (end before start) excluded and flagged");
{
  const exps = [makeExp("a", "2020-01", "2019-01")];
  const result = calculateTotalExperience(exps, new Date("2023-06-01"));
  assertEqual(result.isUnknown, true, "impossible range excluded entirely");
  assertEqual(result.excludedRecordIds, ["a"], "flagged as excluded");
}

console.log("TEST: 'current' role counts through reference date");
{
  const exps = [makeExp("a", "2022-01", null, true)];
  const result = calculateTotalExperience(exps, new Date("2024-01-01"));
  assertEqual(result.years, 2, "Jan 2022 to Jan 2024 (current) = 2 years");
}

console.log("TEST: overlap detector finds the same pair the merge logic handled");
{
  const exps = [makeExp("a", "2015-01", "2020-01"), makeExp("b", "2018-01", "2022-01")];
  const overlaps = detectOverlaps(exps);
  assertEqual(overlaps.length, 1, "exactly one overlapping pair detected");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
