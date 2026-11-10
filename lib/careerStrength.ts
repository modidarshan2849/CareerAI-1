import {
  CareerGap,
  CareerStrengthResult,
  EducationRecord,
  JobPreferences,
  SkillEvidence,
  WorkExperience,
} from "./types";
import { calculateTotalExperience } from "./experience";

const MAX_SCORE = 95; // spec section 6: never automatically give 100

/** Each dimension is scored 0-100 internally, then weighted down into the 0-95 total. */
export function calculateCareerStrength(
  workExperience: WorkExperience[],
  skills: SkillEvidence[],
  education: EducationRecord[],
  preferences: JobPreferences | null
): CareerStrengthResult {
  const reasoning: string[] = [];
  const strengths: string[] = [];

  // 1. Experience depth — based on the real (union) total, capped so 20+ years doesn't skew everything.
  const totalExp = calculateTotalExperience(workExperience);
  const experienceDepth = totalExp.isUnknown
    ? 0
    : Math.min(100, ((totalExp.years ?? 0) + (totalExp.months ?? 0) / 12) * 10);
  if (totalExp.isUnknown) {
    reasoning.push("Experience depth scored 0: no work experience has usable dates yet.");
  } else {
    reasoning.push(
      `Experience depth based on ${totalExp.years}y ${totalExp.months}m of verified (non-overlapping) tenure.`
    );
    if ((totalExp.years ?? 0) >= 3) strengths.push("Solid track record of verified work tenure");
  }

  // 2. Skill coverage — only counts skills with real evidence, not raw list length.
  const establishedSkills = skills.filter((s) => s.confidence !== "Experience not established");
  const skillCoverage = skills.length === 0 ? 0 : Math.min(100, (establishedSkills.length / Math.max(skills.length, 1)) * 100);
  reasoning.push(
    `${establishedSkills.length} of ${skills.length} listed skills have verifiable experience behind them.`
  );
  if (establishedSkills.length >= 5) strengths.push("Multiple skills backed by concrete role evidence");

  // 3. Education
  const education_score = education.length === 0 ? 0 : Math.min(100, education.length * 50);
  if (education.length > 0) reasoning.push(`${education.length} education record(s) on file.`);

  // 4. Quantified achievements — achievements containing a number/metric are weighted higher
  const allAchievements = workExperience.flatMap((e) => e.achievements);
  const quantified = allAchievements.filter((a) => /\d/.test(a));
  const quantifiedAchievements =
    allAchievements.length === 0 ? 0 : Math.min(100, (quantified.length / allAchievements.length) * 100);
  if (quantified.length > 0) {
    reasoning.push(`${quantified.length} achievement(s) include measurable results.`);
    strengths.push("Has quantified, results-oriented achievements");
  }

  // 5. Leadership
  const rolesWithLeadership = workExperience.filter((e) => e.leadershipEvidence.length > 0);
  const leadership = workExperience.length === 0 ? 0 : Math.min(100, (rolesWithLeadership.length / workExperience.length) * 150);
  if (rolesWithLeadership.length > 0) strengths.push("Demonstrated leadership evidence in past roles");

  // 6. Profile completeness
  const completenessChecks = [
    workExperience.length > 0,
    skills.length > 0,
    education.length > 0,
    preferences !== null,
    !totalExp.isUnknown,
  ];
  const profileCompleteness =
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100;
  if (profileCompleteness < 100) {
    reasoning.push("Profile is not fully complete yet, which caps the overall score.");
  }

  const breakdown = {
    experienceDepth: Math.round(experienceDepth),
    skillCoverage: Math.round(skillCoverage),
    education: Math.round(education_score),
    quantifiedAchievements: Math.round(quantifiedAchievements),
    leadership: Math.round(leadership),
    profileCompleteness: Math.round(profileCompleteness),
  };

  const weights = {
    experienceDepth: 0.3,
    skillCoverage: 0.2,
    education: 0.1,
    quantifiedAchievements: 0.15,
    leadership: 0.1,
    profileCompleteness: 0.15,
  };

  const weighted =
    breakdown.experienceDepth * weights.experienceDepth +
    breakdown.skillCoverage * weights.skillCoverage +
    breakdown.education * weights.education +
    breakdown.quantifiedAchievements * weights.quantifiedAchievements +
    breakdown.leadership * weights.leadership +
    breakdown.profileCompleteness * weights.profileCompleteness;

  const score = Math.min(MAX_SCORE, Math.round(weighted));

  return {
    score,
    breakdown,
    strengths,
    gaps: [], // populated separately by gaps.ts and merged in by the caller
    reasoning,
  };
}
