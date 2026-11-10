import { SkillEvidence, SuggestedRole, WorkExperience } from "./types";
import {
  analyzeTitle,
  determineCurrentRoleLevel,
  determineCurrentRoleLevelForDomain,
  isRelatedManagementTrack,
  isSameFamily,
} from "./careerLevel";
import { classifyDomain } from "./careerDomain";

/**
 * Section 8, plus the career-direction protection rule:
 * "Do not present a more junior version of the user's current evidenced
 * role as a preferred career direction. A higher-level role may be shown
 * only when supported by evidence and clearly labeled as a stretch. Never
 * downgrade the user's career direction automatically."
 *
 * This is the ONLY place in the codebase that generates role suggestions —
 * every call site (resume upload, profile update, domain confirmation) goes
 * through suggestRoles() below, so the career-direction guard can't be
 * bypassed by adding a second code path.
 *
 * Explicit user preferences are handled separately by
 * combineWithExplicitTargets(), which never re-applies the guard — an
 * intentional choice is not something the system "downgrades."
 */

export interface RoleDefinition {
  role: string;
  coreSkills: string[];
  niceToHaveSkills: string[];
  minYearsForBestFit: number;
}

function establishedYearsFor(skillName: string, skills: SkillEvidence[]): number {
  const match = skills.find((s) => s.skillName.toLowerCase() === skillName.toLowerCase());
  if (!match || match.confidence === "Experience not established") return 0;
  return match.yearsOfExperience ?? 0;
}

function isEstablished(skillName: string, skills: SkillEvidence[]): boolean {
  const match = skills.find((s) => s.skillName.toLowerCase() === skillName.toLowerCase());
  return !!match && match.confidence !== "Experience not established";
}

function hasLeadershipEvidence(workExperience: WorkExperience[]): boolean {
  return workExperience.some((e) => e.leadershipEvidence.length > 0);
}

export function evaluateRoleFit(
  def: RoleDefinition,
  skills: SkillEvidence[],
  workExperience: WorkExperience[],
  confirmedDomain: string | null = null
): SuggestedRole | null {
  const currentLevel = confirmedDomain
    ? determineCurrentRoleLevelForDomain(workExperience, confirmedDomain, classifyDomain)
    : determineCurrentRoleLevel(workExperience);
  const candidateLevel = analyzeTitle(def.role);

  // --- Career-direction guard -------------------------------------------
  if (currentLevel) {
    if (isSameFamily(currentLevel, candidateLevel) && candidateLevel.rank < currentLevel.rank) {
      // A more junior version of the user's own role family. Never
      // surfaced as a system suggestion, regardless of skill match —
      // matching skills doesn't make a downgrade a "preferred direction."
      // (An explicit user target bypasses this entirely; see
      // combineWithExplicitTargets below, which never calls this guard.)
      return null;
    }
  }

  const matchedCore = def.coreSkills.filter((s) => isEstablished(s, skills));
  const matchedNice = def.niceToHaveSkills.filter((s) => isEstablished(s, skills));
  const missingCore = def.coreSkills.filter((s) => !isEstablished(s, skills));

  const coreCoverageRatio = def.coreSkills.length === 0 ? 0 : matchedCore.length / def.coreSkills.length;
  const minCoreNeeded = Math.min(2, def.coreSkills.length);
  if (matchedCore.length < minCoreNeeded) {
    return null;
  }

  const maxCoreYears = Math.max(0, ...matchedCore.map((s) => establishedYearsFor(s, skills)));

  const isStepUp =
    !!currentLevel &&
    ((isSameFamily(currentLevel, candidateLevel) && candidateLevel.rank > currentLevel.rank) ||
      isRelatedManagementTrack(currentLevel, candidateLevel));

  if (isStepUp) {
    const stepUpEvidenced = hasLeadershipEvidence(workExperience) || coreCoverageRatio >= 0.75;
    if (!stepUpEvidenced) return null;

    return {
      role: def.role,
      tier: "STRETCH",
      rationale: `A higher-level direction relative to your current role, supported by ${
        hasLeadershipEvidence(workExperience) ? "leadership evidence in your work history" : "strong skill coverage"
      }. This is a stretch, not a lateral match.`,
      supportingEvidence: matchedCore.concat(matchedNice).map((s) => `${s}: established`),
      importantGaps: missingCore.map((s) => `${s}: not established in profile`),
      seniorityRelation: "higher",
      isExplicitUserTarget: false,
    };
  }

  const supportingEvidence = matchedCore.concat(matchedNice).map((s) => {
    const skill = skills.find((sk) => sk.skillName.toLowerCase() === s.toLowerCase());
    const years = skill?.yearsOfExperience;
    return years
      ? `${s}: ${years} year(s) of established experience`
      : `${s}: evidence on file (years not established)`;
  });
  const importantGaps = missingCore.map((s) => `${s}: not established in profile`);

  let tier: SuggestedRole["tier"];
  if (coreCoverageRatio >= 0.8 && maxCoreYears >= def.minYearsForBestFit) {
    tier = "BEST_FIT";
  } else if (coreCoverageRatio >= 0.5) {
    tier = "GOOD_FIT";
  } else {
    tier = "STRETCH";
  }

  const rationale =
    tier === "BEST_FIT"
      ? `Strong, verified match: ${matchedCore.length}/${def.coreSkills.length} core skills established with real tenure behind them.`
      : tier === "GOOD_FIT"
      ? `Meaningful transferable overlap (${matchedCore.length}/${def.coreSkills.length} core skills established), with some gaps to close.`
      : `Directionally relevant based on ${matchedCore.length} established core skill(s), but requires meaningful additional experience.`;

  return {
    role: def.role,
    tier,
    rationale,
    supportingEvidence,
    importantGaps,
    seniorityRelation: "lateral",
    isExplicitUserTarget: false,
  };
}

/**
 * The single entry point for generating SYSTEM suggestions. confirmedDomain
 * is optional and only changes which role the guard treats as "current" —
 * it never changes the guard's logic itself.
 */
export function suggestRoles(
  candidateRoleDefs: RoleDefinition[],
  skills: SkillEvidence[],
  workExperience: WorkExperience[],
  confirmedDomain: string | null = null
): SuggestedRole[] {
  return candidateRoleDefs
    .map((def) => evaluateRoleFit(def, skills, workExperience, confirmedDomain))
    .filter((r): r is SuggestedRole => r !== null);
}

/**
 * Merges system-generated suggestions with the person's explicit Job
 * Preferences target roles. An explicit target:
 *  - is NEVER filtered by the career-direction guard (it's an intentional
 *    choice, not a system recommendation),
 *  - is always included even if it duplicates or contradicts a system
 *    suggestion,
 *  - is clearly labeled via isExplicitUserTarget so the UI never presents
 *    it as if the system recommended it.
 *
 * If a role appears in both lists (the person happened to target something
 * the system also suggests), the explicit-target version wins for display
 * purposes — explicit intent takes precedence per the spec.
 */
export function combineWithExplicitTargets(
  systemSuggestions: SuggestedRole[],
  explicitTargetRoles: string[]
): SuggestedRole[] {
  const explicitSet = new Set(explicitTargetRoles.map((r) => r.trim().toLowerCase()));

  const filteredSystem = systemSuggestions.filter(
    (s) => !explicitSet.has(s.role.trim().toLowerCase())
  );

  const explicitEntries: SuggestedRole[] = explicitTargetRoles
    .filter((r) => r.trim().length > 0)
    .map((role) => ({
      role,
      tier: "GOOD_FIT", // tier is not meaningful for an explicit choice; kept for type compatibility
      rationale: "You explicitly set this as a target role in your Job Preferences.",
      supportingEvidence: [],
      importantGaps: [],
      seniorityRelation: "lateral",
      isExplicitUserTarget: true,
    }));

  return [...explicitEntries, ...filteredSystem];
}
