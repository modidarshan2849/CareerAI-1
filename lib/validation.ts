import { SkillEvidence, ValidationWarning, WorkExperience } from "./types";
import { detectOverlaps } from "./experience";

let warningCounter = 0;
function nextId(): string {
  warningCounter += 1;
  return `warn_${Date.now()}_${warningCounter}`;
}

function isUnknownTitleOrEmployer(value: string): boolean {
  return !value || value.trim() === "" || value === "Unknown — review required";
}

export function runValidation(
  workExperience: WorkExperience[],
  skills: SkillEvidence[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Missing title / employer / dates
  for (const exp of workExperience) {
    if (isUnknownTitleOrEmployer(exp.jobTitle)) {
      warnings.push({
        id: nextId(),
        type: "missing_title",
        message: `Job title is missing or unclear for the role at "${exp.employer || "an unknown employer"}". Please confirm.`,
        relatedRecordId: exp.id,
        resolved: false,
      });
    }
    if (isUnknownTitleOrEmployer(exp.employer)) {
      warnings.push({
        id: nextId(),
        type: "missing_employer",
        message: `Employer is missing or unclear for the role "${exp.jobTitle || "an unknown title"}". Please confirm.`,
        relatedRecordId: exp.id,
        resolved: false,
      });
    }
    if (!exp.period.startDate || (!exp.period.endDate && !exp.period.isCurrent)) {
      warnings.push({
        id: nextId(),
        type: "missing_dates",
        message: `Start or end date is missing for "${exp.jobTitle}" at "${exp.employer}".`,
        relatedRecordId: exp.id,
        resolved: false,
      });
    }
    if (
      exp.period.startDate &&
      exp.period.endDate &&
      !exp.period.isCurrent &&
      new Date(exp.period.endDate) < new Date(exp.period.startDate)
    ) {
      warnings.push({
        id: nextId(),
        type: "impossible_dates",
        message: `End date is before start date for "${exp.jobTitle}" at "${exp.employer}".`,
        relatedRecordId: exp.id,
        resolved: false,
      });
    }
  }

  // Overlaps (flagged for review, not auto-fixed — the merge happens separately in totals)
  const overlaps = detectOverlaps(workExperience);
  for (const [idA, idB] of overlaps) {
    const a = workExperience.find((e) => e.id === idA);
    const b = workExperience.find((e) => e.id === idB);
    warnings.push({
      id: nextId(),
      type: "overlapping_employment_flagged",
      message: `Overlapping employment detected between "${a?.jobTitle}" (${a?.employer}) and "${b?.jobTitle}" (${b?.employer}). This is allowed (e.g. freelance alongside a job) but please confirm it's accurate.`,
      relatedRecordId: idA,
      resolved: false,
    });
  }

  // Duplicate roles: same title + employer + start date
  const seen = new Map<string, string>();
  for (const exp of workExperience) {
    const key = `${normalize(exp.jobTitle)}|${normalize(exp.employer)}|${exp.period.startDate}`;
    if (seen.has(key)) {
      warnings.push({
        id: nextId(),
        type: "duplicate_role",
        message: `"${exp.jobTitle}" at "${exp.employer}" appears to be entered more than once.`,
        relatedRecordId: exp.id,
        resolved: false,
      });
    } else {
      seen.set(key, exp.id);
    }
  }

  // Duplicate periods (exact same start+end across different roles — likely a copy/paste error)
  const periodSeen = new Map<string, string>();
  for (const exp of workExperience) {
    const key = `${exp.period.startDate}|${exp.period.endDate}|${exp.period.isCurrent}`;
    if (exp.period.startDate && periodSeen.has(key) && periodSeen.get(key) !== exp.employer) {
      warnings.push({
        id: nextId(),
        type: "duplicate_period",
        message: `The exact same employment period is used for two different employers ("${periodSeen.get(key)}" and "${exp.employer}"). Please confirm this is correct.`,
        relatedRecordId: exp.id,
        resolved: false,
      });
    } else if (exp.period.startDate) {
      periodSeen.set(key, exp.employer);
    }
  }

  // Contradictory employer names that are near-duplicates (simple heuristic, human confirms)
  // Left as a lightweight check: two very similar employer strings with different casing/spacing
  // are NOT auto-merged — only flagged.
  const employerNames = Array.from(new Set(workExperience.map((e) => normalize(e.employer))));
  for (let i = 0; i < employerNames.length; i++) {
    for (let j = i + 1; j < employerNames.length; j++) {
      if (
        employerNames[i] !== employerNames[j] &&
        (employerNames[i].includes(employerNames[j]) || employerNames[j].includes(employerNames[i])) &&
        employerNames[i].length > 3 &&
        employerNames[j].length > 3
      ) {
        warnings.push({
          id: nextId(),
          type: "contradictory_employer",
          message: `"${employerNames[i]}" and "${employerNames[j]}" look like they might be the same employer written differently. Please confirm.`,
          relatedRecordId: null,
          resolved: false,
        });
      }
    }
  }

  // Unsupported skill years — defensive re-check in case a skill was manually edited
  // to carry years without evidence (should not happen via buildSkillEvidence, but the
  // UI must never silently trust a number that has no evidence array behind it).
  for (const skill of skills) {
    if (skill.yearsOfExperience !== null && skill.evidence.length === 0) {
      warnings.push({
        id: nextId(),
        type: "unsupported_skill_years",
        message: `"${skill.skillName}" shows ${skill.yearsOfExperience} years but has no supporting evidence on file.`,
        relatedRecordId: null,
        resolved: false,
      });
    }
  }

  return warnings;
}

function normalize(v: string): string {
  return (v || "").trim().toLowerCase();
}

/**
 * Section 9 of the product spec: target salary is a soft preference,
 * absolute minimum is a hard filter. It's contradictory for the hard floor
 * to sit ABOVE the soft target — that would mean "the least I'll accept is
 * more than what I'm aiming for." Found during the V0.1 live-QA audit: no
 * code path validated this. This is the single implementation, used by
 * both the Preferences form (client-side, fast feedback) and the
 * /api/preferences route (server-side, authoritative) — never duplicated.
 */
export function validateSalaryPreferences(
  targetSalary: number | null,
  absoluteMinimumSalary: number | null
): string | null {
  if (targetSalary != null && absoluteMinimumSalary != null && absoluteMinimumSalary > targetSalary) {
    return "Your absolute minimum salary can't be higher than your target salary.";
  }
  return null;
}

/** Clears warnings whose underlying issue has been corrected. Called after any profile edit. */
export function reconcileWarnings(
  existingWarnings: ValidationWarning[],
  workExperience: WorkExperience[],
  skills: SkillEvidence[]
): ValidationWarning[] {
  const fresh = runValidation(workExperience, skills);
  // Any previously-manually-resolved warning that no longer reproduces stays resolved/gone.
  // Any warning that still reproduces is kept (re-derived, so duplicates collapse naturally).
  return fresh;
}
