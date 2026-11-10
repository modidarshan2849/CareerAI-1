import { WorkExperience } from "./types";

/**
 * Career-direction protection rule:
 * "Do not present a more junior version of the user's current evidenced
 * role as a preferred career direction. Higher-level roles may be shown
 * only when evidenced and clearly labeled as a stretch. Never downgrade
 * the user's career direction automatically."
 *
 * This module answers two questions for any two job titles:
 *  1. Are they the same "role family" (e.g. "Data Analyst" and
 *     "Senior Data Analyst" are the same family; "Analytics Manager" is a
 *     related-but-different family on the same track)?
 *  2. If so, which one is more senior?
 */

const SENIORITY_MODIFIERS: Array<{ pattern: RegExp; rank: number }> = [
  { pattern: /\b(intern|trainee)\b/i, rank: 0 },
  { pattern: /\b(junior|jr\.?|associate|entry[- ]level)\b/i, rank: 1 },
  { pattern: /\b(senior|sr\.?)\b/i, rank: 3 },
  { pattern: /\b(staff|lead)\b/i, rank: 4 },
  { pattern: /\b(principal)\b/i, rank: 5 },
  { pattern: /\b(manager)\b/i, rank: 5 },
  { pattern: /\b(director)\b/i, rank: 6 },
  { pattern: /\b(vp|vice president)\b/i, rank: 7 },
  { pattern: /\b(chief|head of|c[a-z]o)\b/i, rank: 8 },
];

const BASE_RANK = 2; // an unmodified title ("Data Analyst") sits between junior and senior

export interface TitleAnalysis {
  rawTitle: string;
  family: string; // normalized title with seniority modifiers stripped
  rank: number;
  isManagementTrack: boolean;
}

export function analyzeTitle(title: string): TitleAnalysis {
  let rank = BASE_RANK;
  let isManagementTrack = false;
  let family = title.toLowerCase();

  for (const { pattern, rank: modRank } of SENIORITY_MODIFIERS) {
    if (pattern.test(family)) {
      rank = Math.max(rank, modRank);
      if (/\b(manager|director|vp|vice president|chief|head of)\b/i.test(family)) {
        isManagementTrack = true;
      }
      family = family.replace(pattern, "").trim();
    }
  }

  family = family.replace(/[,\-–]+$/, "").replace(/\s+/g, " ").trim();

  return { rawTitle: title, family, rank, isManagementTrack };
}

/** Same family = same core role, just at a different seniority (e.g. "Data Analyst" vs "Senior Data Analyst"). */
export function isSameFamily(a: TitleAnalysis, b: TitleAnalysis): boolean {
  if (a.family === b.family) return true;
  // Management-track titles for the same domain (e.g. "Analytics Manager" for
  // "Data Analyst") are treated as a *related* family, not the *same* family —
  // they're a step up, not a lateral synonym, so they're handled separately
  // by the "higher, evidenced, labeled" path rather than being merged here.
  return false;
}

/**
 * "Analytics Manager" relates to "Data Analyst" as a management-track step up
 * within the same domain. Heuristic: strip "manager"/"director"/etc and see
 * if what's left shares a word stem with the base family (e.g. "analyst" and
 * "analytics" share the stem "analy" — exact-token matching alone misses this).
 */
function sharesStem(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  const stemLen = Math.min(5, a.length, b.length);
  return a.slice(0, stemLen) === b.slice(0, stemLen);
}

export function isRelatedManagementTrack(base: TitleAnalysis, candidate: TitleAnalysis): boolean {
  if (!candidate.isManagementTrack) return false;
  const baseWords = base.family.split(" ").filter((w) => w.length > 2);
  const candidateWords = candidate.family.split(" ").filter((w) => w.length > 2);
  if (baseWords.length === 0) return false;
  return candidateWords.some((cw) => baseWords.some((bw) => sharesStem(cw, bw)));
}

/**
 * Finds the seniority level of the user's *current* career direction, based
 * on their most recent evidenced role (current role if marked isCurrent,
 * otherwise the most recently ended role). Missing/unparseable dates fall
 * back to array order rather than crashing.
 */
export function determineCurrentRoleLevel(workExperience: WorkExperience[]): TitleAnalysis | null {
  const validRoles = workExperience.filter(
    (e) => e.jobTitle && e.jobTitle !== "Unknown — review required"
  );
  if (validRoles.length === 0) return null;

  const current = validRoles.find((e) => e.period.isCurrent);
  if (current) return analyzeTitle(current.jobTitle);

  const sorted = [...validRoles].sort((a, b) => {
    const aEnd = a.period.endDate ?? "";
    const bEnd = b.period.endDate ?? "";
    return bEnd.localeCompare(aEnd);
  });
  return analyzeTitle(sorted[0].jobTitle);
}

/**
 * Same as determineCurrentRoleLevel, but scoped to a confirmed career
 * domain when one is provided. This is what makes "changing the confirmed
 * domain recalculates role recommendations" actually true: a person with
 * both nursing and software engineering history who confirms "Software
 * Engineering" gets their current *level* anchored on their most recent
 * role WITHIN that domain, not just their most recent role overall (which
 * might be an ambiguous title, or might even belong to the other domain).
 *
 * Falls back to determineCurrentRoleLevel across all experience when no
 * domain is confirmed, or when nothing in that domain classifies — this
 * keeps existing single-domain behavior unchanged.
 */
export function determineCurrentRoleLevelForDomain(
  workExperience: WorkExperience[],
  confirmedDomain: string | null,
  classifyDomain: (title: string) => string | null
): TitleAnalysis | null {
  if (!confirmedDomain) return determineCurrentRoleLevel(workExperience);

  const inDomain = workExperience.filter((e) => classifyDomain(e.jobTitle) === confirmedDomain);
  if (inDomain.length === 0) return determineCurrentRoleLevel(workExperience);

  return determineCurrentRoleLevel(inDomain);
}
