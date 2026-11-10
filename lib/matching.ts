import {
  JobPosting,
  JobPreferences,
  MasterCareerProfile,
  MatchScores,
  SkillEvidence,
  WorkExperience,
} from "./types";

/**
 * Sections 9-11.
 * Core rule: UNKNOWN must never be silently treated as a pass OR a fail.
 *  - Unknown salary does not fail eligibility.
 *  - Unknown sponsorship does not pass eligibility as "compatible" — it's
 *    surfaced as a verification-confidence penalty, not a hard exclusion,
 *    unless the candidate's preferences explicitly require sponsorship and
 *    the job explicitly does not offer it (a confirmed failure).
 */

function isEstablished(skillName: string, skills: SkillEvidence[]): boolean {
  const match = skills.find((s) => s.skillName.toLowerCase() === skillName.toLowerCase());
  return !!match && match.confidence !== "Experience not established";
}

function calculateCareerMatch(job: JobPosting, skills: SkillEvidence[]): { score: number; notes: string[] } {
  if (job.requirements.length === 0) {
    return { score: 50, notes: ["Job has no listed requirements to compare against; score defaults to neutral."] };
  }
  const matched = job.requirements.filter((req) =>
    skills.some((s) => isEstablished(s.skillName, skills) && req.toLowerCase().includes(s.skillName.toLowerCase()))
  );
  const ratio = matched.length / job.requirements.length;
  return {
    score: Math.round(ratio * 100),
    notes: [`${matched.length}/${job.requirements.length} listed requirements are backed by established profile evidence.`],
  };
}

function calculateEligibility(
  job: JobPosting,
  prefs: JobPreferences | null
): { score: number; hardExclusions: string[]; notes: string[] } {
  const hardExclusions: string[] = [];
  const notes: string[] = [];
  let score = 100;

  if (!job.isOpen) {
    hardExclusions.push("Job posting is confirmed closed.");
  }

  if (prefs?.absoluteMinimumSalary != null && job.salaryMax != null) {
    if (job.salaryMax < prefs.absoluteMinimumSalary) {
      hardExclusions.push(
        `Job's maximum salary ($${job.salaryMax}) is below your absolute minimum ($${prefs.absoluteMinimumSalary}).`
      );
    }
  } else if (prefs?.absoluteMinimumSalary != null && job.salaryMax == null) {
    notes.push("Salary isn't listed, so it can't be checked against your absolute minimum. Not excluded — treated as unknown.");
    score -= 10;
  }

  if (prefs?.sponsorshipRequired === true) {
    if (job.requiresSponsorship === false) {
      hardExclusions.push("You require sponsorship and this employer has confirmed it does not offer it.");
    } else if (job.requiresSponsorship === null) {
      notes.push("Sponsorship availability isn't confirmed for this job. Not excluded — flagged as unknown, lowers confidence.");
      score -= 20;
    }
  }

  return { score: Math.max(0, score), hardExclusions, notes };
}

function calculatePreferenceMatch(
  job: JobPosting,
  prefs: JobPreferences | null
): { score: number; notes: string[] } {
  if (!prefs) return { score: 50, notes: ["No preferences set yet; score defaults to neutral."] };

  let score = 100;
  const notes: string[] = [];

  const wantsLocationMatch = !!prefs.location;
  if (wantsLocationMatch && job.location) {
    const matches = job.location.toLowerCase().includes(prefs.location!.toLowerCase());
    if (!matches && !job.remote) {
      score -= 25;
      notes.push("Job location doesn't match your target location.");
    }
  }

  if (prefs.remote && !job.remote) {
    score -= 15;
    notes.push("You prefer remote; this role is not listed as remote.");
  }

  // Target salary is a soft preference only — never a hard exclusion (section 9).
  if (prefs.targetSalary != null && job.salaryMax != null && job.salaryMax < prefs.targetSalary) {
    score -= 15;
    notes.push("Below your target salary (this is a preference, not a disqualifier).");
  } else if (prefs.targetSalary != null && job.salaryMax == null) {
    notes.push("Salary not listed; target salary preference can't be evaluated.");
  }

  return { score: Math.max(0, score), notes };
}

function calculateVerificationConfidence(
  job: JobPosting,
  profile: MasterCareerProfile
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 100;

  const unresolvedWarnings = profile.validationWarnings.filter((w) => !w.resolved);
  if (unresolvedWarnings.length > 0) {
    score -= Math.min(40, unresolvedWarnings.length * 8);
    notes.push(`${unresolvedWarnings.length} unresolved validation warning(s) on your profile lower confidence.`);
  }

  if (profile.totalExperience.isUnknown) {
    score -= 20;
    notes.push("Total experience is unknown, which weakens confidence in this match.");
  }

  if (job.requiresSponsorship === null) {
    score -= 10;
    notes.push("This job's sponsorship policy is unconfirmed.");
  }
  if (job.salaryMin == null && job.salaryMax == null) {
    score -= 5;
    notes.push("This job doesn't list salary.");
  }

  return { score: Math.max(0, score), notes };
}

export function calculateMatch(job: JobPosting, profile: MasterCareerProfile): MatchScores {
  const career = calculateCareerMatch(job, profile.skills);
  const eligibility = calculateEligibility(job, profile.preferences);
  const preference = calculatePreferenceMatch(job, profile.preferences);
  const verification = calculateVerificationConfidence(job, profile);

  const reasoning = [...career.notes, ...eligibility.notes, ...preference.notes, ...verification.notes];

  if (eligibility.hardExclusions.length > 0) {
    return {
      careerMatch: career.score,
      eligibility: 0,
      preferenceMatch: preference.score,
      verificationConfidence: verification.score,
      overallFit: 0,
      status: "RED",
      hardExclusionReasons: eligibility.hardExclusions,
      reasoning,
    };
  }

  const overallFit = Math.round(
    career.score * 0.4 + eligibility.score * 0.25 + preference.score * 0.2 + verification.score * 0.15
  );

  // Section 11: Do not force jobs into Green just to produce more results.
  // Thresholds are intentionally strict; Amber is the default "worth a look" bucket.
  let status: MatchScores["status"];
  if (overallFit >= 75 && career.score >= 60 && verification.score >= 60) {
    status = "GREEN";
  } else if (overallFit >= 45) {
    status = "AMBER";
  } else {
    status = "RED";
  }

  return {
    careerMatch: career.score,
    eligibility: eligibility.score,
    preferenceMatch: preference.score,
    verificationConfidence: verification.score,
    overallFit,
    status,
    hardExclusionReasons: [],
    reasoning,
  };
}
