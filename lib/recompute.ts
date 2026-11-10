import { calculateCareerStrength } from "./careerStrength";
import { calculateCareerGaps } from "./gaps";
import { calculateExperienceBreakdown } from "./careerDomain";
import { suggestRoles } from "./roles";
import { ROLE_CATALOG } from "./roleCatalog";
import { runValidation } from "./validation";
import { EducationRecord, SkillEvidence, WorkExperience } from "./types";

/**
 * The one place that recomputes every derived (non-raw) piece of the
 * profile from workExperience/skills/education/confirmedDomain. Every
 * write path that can change one of those inputs — resume upload, manual
 * profile edits, confirming a career domain — calls this instead of
 * re-implementing any part of it, so there is exactly one implementation
 * of "how do we score/suggest/gap-check a profile" in the codebase.
 */
export function recomputeDerivedProfile(
  workExperience: WorkExperience[],
  skills: SkillEvidence[],
  education: EducationRecord[],
  confirmedDomain: string | null
) {
  const experienceBreakdown = calculateExperienceBreakdown(workExperience, new Date(), confirmedDomain);
  const gaps = calculateCareerGaps(workExperience, skills, education, experienceBreakdown);
  const strength = calculateCareerStrength(workExperience, skills, education, null);
  const systemSuggestedRoles = suggestRoles(ROLE_CATALOG, skills, workExperience, confirmedDomain);
  const validationWarnings = runValidation(workExperience, skills);

  return { experienceBreakdown, gaps, strength, systemSuggestedRoles, validationWarnings };
}
