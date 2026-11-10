import { EducationRecord, SkillEvidence, WorkExperience } from "../lib/types";
import { buildSkillEvidence } from "../lib/skills";

/**
 * Candidate A — deterministic test fixture.
 *
 * Deliberately includes every hard case the product spec cares about, in
 * one profile:
 *  - Sales (earlier) + Data & Analytics (later) = career-change domain test
 *  - Two Data & Analytics roles with OVERLAPPING dates = union-math test
 *  - Several skills backed by real dated evidence
 *  - One skill ("Tableau") listed with no supporting role at all = the
 *    "skill without evidence" case
 *  - Current role "Senior Data Analyst" = seniority-protection test anchor
 *
 * This is pure data — importing this file touches no database and makes no
 * network calls. Safe to import from tests. The actual database seed
 * script (scripts/seed-candidate-a.ts) is separate and requires an
 * explicit command plus a real user id to run against a live Supabase
 * project; it is never executed automatically.
 */

export const CANDIDATE_A_WORK_EXPERIENCE: WorkExperience[] = [
  {
    id: "fixture_sales_1",
    jobTitle: "Account Executive",
    employer: "Meridian Sales Group",
    period: { startDate: "2008-01", endDate: "2016-01", isCurrent: false }, // 8y, Sales
    responsibilities: ["Managed a portfolio of 40+ enterprise accounts", "Negotiated annual contracts"],
    achievements: ["Exceeded quota by 22% in 2014", "Closed the largest deal in company history ($1.2M)"],
    technologies: ["Salesforce"],
    employmentType: "full-time",
    leadershipEvidence: [],
    source: "fixture:candidate-a",
    needsReview: false,
  },
  {
    id: "fixture_data_1",
    jobTitle: "Data Analyst",
    employer: "Northwind Analytics",
    // Overlaps with fixture_data_2 below (2016-06 to 2020-06) — deliberate,
    // to exercise the union-of-dates math, not a naive sum.
    period: { startDate: "2016-06", endDate: "2020-06", isCurrent: false },
    responsibilities: ["Built SQL reporting pipelines", "Created dashboards in Tableau for leadership"],
    achievements: ["Reduced monthly reporting time from 3 days to 4 hours"],
    technologies: ["SQL", "Excel"],
    employmentType: "full-time",
    leadershipEvidence: [],
    source: "fixture:candidate-a",
    needsReview: false,
  },
  {
    id: "fixture_data_2",
    jobTitle: "Senior Data Analyst",
    employer: "Northwind Analytics",
    // Overlaps the tail of the role above by design (promotion with a
    // transition period) — union should merge these, not double-count.
    period: { startDate: "2019-09", endDate: null, isCurrent: true },
    responsibilities: ["Owns the analytics data model", "Mentors 2 junior analysts"],
    achievements: ["Led migration to a new BI stack, adopted company-wide"],
    technologies: ["SQL", "Data Visualization", "Excel"],
    employmentType: "full-time",
    leadershipEvidence: ["Mentors 2 junior analysts"],
    source: "fixture:candidate-a",
    needsReview: false,
  },
];

// "Tableau" appears in fixture_data_1's technologies (so it DOES have dated
// evidence); "Stakeholder Management" is intentionally NOT mentioned
// anywhere in the work history, so it becomes the "skill without evidence"
// case once run through buildSkillEvidence.
export const CANDIDATE_A_RAW_SKILLS = [
  { skillName: "SQL" },
  { skillName: "Excel" },
  { skillName: "Data Visualization" },
  { skillName: "Stakeholder Management" }, // <- listed but never evidenced
];

export const CANDIDATE_A_SKILLS: SkillEvidence[] = buildSkillEvidence(
  CANDIDATE_A_RAW_SKILLS,
  [],
  CANDIDATE_A_WORK_EXPERIENCE
);

export const CANDIDATE_A_EDUCATION: EducationRecord[] = [
  {
    id: "fixture_edu_1",
    institution: "State University",
    credential: "B.A. Business Administration",
    field: "Business",
    graduationDate: "2007-05",
    source: "fixture:candidate-a",
  },
];

/**
 * Expected values a test (or a person doing manual live QA) can assert
 * against, computed by hand so they're independent of the code under test:
 *  - Total experience: union of 2008-01→2016-01 (Sales) and
 *    2016-06→present (Data, with internal overlap already merged) —
 *    NOT a simple sum of all three role durations.
 *  - Current-domain (Data & Analytics) experience: 2016-06 → present only.
 */
export const CANDIDATE_A_EXPECTATIONS = {
  currentEvidencedRoleTitle: "Senior Data Analyst",
  skillWithoutEvidence: "Stakeholder Management",
  skillsWithEvidence: ["SQL", "Excel", "Data Visualization"],
  domains: ["Sales", "Data & Analytics"],
};
