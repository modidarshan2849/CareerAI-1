import { CareerGap, EducationRecord, SkillEvidence, WorkExperience } from "./types";
import { calculateTotalExperience } from "./experience";
import { ExperienceBreakdown } from "./types";

/**
 * Section 7: gaps must be dynamic and evidence-based.
 * "Do not claim a skill is missing when the profile contains reliable evidence for it."
 * This module only ever flags what's actually absent or actually unsupported —
 * it never contradicts data already on file.
 */
export function calculateCareerGaps(
  workExperience: WorkExperience[],
  skills: SkillEvidence[],
  education: EducationRecord[],
  experienceBreakdown: ExperienceBreakdown | null = null
): CareerGap[] {
  const gaps: CareerGap[] = [];

  const totalExp = calculateTotalExperience(workExperience);
  if (totalExp.isUnknown) {
    gaps.push({
      gap: "Employment dates are missing or unclear",
      whyItMatters:
        "Without usable start/end dates, total experience can't be calculated, which weakens every downstream match and score.",
      evidence: "No work experience record has a fully parseable date range.",
      suggestedImprovement: "Add or correct start and end dates for each role.",
      priority: "High",
    });
  }

  const unestablished = skills.filter((s) => s.confidence === "Experience not established");
  if (unestablished.length > 0) {
    gaps.push({
      gap: `${unestablished.length} listed skill(s) have no supporting evidence`,
      whyItMatters:
        "Skills without evidence are treated as unverified and will lower verification confidence in job matching.",
      evidence: `Skills affected: ${unestablished.map((s) => s.skillName).join(", ")}.`,
      suggestedImprovement:
        "Add specifics to your work history (a project, responsibility, or achievement) that shows where each skill was used, or note explicit years of experience.",
      priority: "Medium",
    });
  }

  const quantifiedCount = workExperience.flatMap((e) => e.achievements).filter((a) => /\d/.test(a)).length;
  if (quantifiedCount === 0 && workExperience.length > 0) {
    gaps.push({
      gap: "No quantified achievements",
      whyItMatters: "Measurable results (%, $, time saved, team size) are what differentiate a strong candidate profile.",
      evidence: "No achievement text on file currently contains a number or metric.",
      suggestedImprovement: "Add at least one measurable outcome to your strongest roles.",
      priority: "Medium",
    });
  }

  const rolesNeedingReview = workExperience.filter((e) => e.needsReview);
  if (rolesNeedingReview.length > 0) {
    gaps.push({
      gap: `${rolesNeedingReview.length} role(s) need manual review`,
      whyItMatters: "Unclear job titles or employers reduce confidence in matches built on this experience.",
      evidence: `Affected roles: ${rolesNeedingReview.map((r) => r.jobTitle).join(", ")}.`,
      suggestedImprovement: "Confirm or correct the flagged job titles/employers in your profile.",
      priority: "High",
    });
  }

  if (education.length === 0) {
    gaps.push({
      gap: "No education on file",
      whyItMatters:
        "Some roles filter by degree requirements. Leaving this blank means those checks stay at 'unknown' rather than passing.",
      evidence: "No education records exist in the profile.",
      suggestedImprovement: "Add your highest relevant credential, or note if you're self-taught with equivalent experience.",
      priority: "Low",
    });
  }

  // Career-change protection: if a confirmed domain excludes a meaningful
  // chunk of the person's history, say so explicitly rather than letting
  // the difference between "Total experience" and "Current-domain
  // experience" speak for itself elsewhere in the UI. This gap disappears
  // automatically if the person later confirms a different domain that
  // covers more of their history, or if there's no meaningful gap to begin
  // with — it's recalculated fresh every time, never left stale.
  if (
    experienceBreakdown &&
    experienceBreakdown.currentDomain &&
    experienceBreakdown.totalYears != null &&
    experienceBreakdown.currentDomainYears != null
  ) {
    const excludedYears = experienceBreakdown.totalYears - experienceBreakdown.currentDomainYears;
    if (excludedYears >= 2) {
      gaps.push({
        gap: `${excludedYears}+ years of experience outside your confirmed domain (${experienceBreakdown.currentDomain})`,
        whyItMatters:
          "Only experience inside your confirmed current domain counts toward current-domain matching and role suggestions — the rest of your history is real, but isn't treated as relevant to this career direction.",
        evidence: `Total career experience is ${experienceBreakdown.totalYears}y, but only ${experienceBreakdown.currentDomainYears}y falls within ${experienceBreakdown.currentDomain}.`,
        suggestedImprovement:
          "If this split looks wrong, revisit your confirmed career direction on the dashboard — changing it will recalculate this immediately.",
        priority: "Low",
      });
    }
  }

  if (experienceBreakdown?.needsUserConfirmation) {
    gaps.push({
      gap: "Career direction not yet confirmed",
      whyItMatters:
        "Your work history spans more than one field, or your most recent title doesn't clearly indicate a field. Until you confirm a direction, current-domain experience and role suggestions can't be scoped accurately.",
      evidence: `Detected domain(s) in your history: ${
        experienceBreakdown.detectedDomains.length > 0 ? experienceBreakdown.detectedDomains.join(", ") : "none clearly classified"
      }.`,
      suggestedImprovement: "Confirm your current career direction from the dashboard.",
      priority: "High",
    });
  }

  return gaps;
}
