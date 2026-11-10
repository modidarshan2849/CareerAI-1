import { ExperienceBreakdown, WorkExperience } from "./types";
import { calculateTotalExperience } from "./experience";

/**
 * Career-change protection rule:
 * "Total Experience must not misleadingly present all historical experience
 * as relevant experience for the current target career. Distinguish overall
 * career experience from relevant/current-domain experience. If the system
 * cannot confidently determine the user's intended career direction, ask the
 * user to confirm rather than assuming all historical experience belongs to
 * the current career path."
 *
 * This is a deliberately narrow keyword taxonomy, not an ML classifier — in
 * keeping with the product's "never invent, unknown stays unknown" rule, a
 * title that doesn't clearly match a known domain returns null rather than
 * being forced into the nearest bucket.
 */

const DOMAIN_KEYWORDS: Record<string, RegExp> = {
  "Data & Analytics": /\b(data analy\w*|data scien\w*|analytics|business intelligence|\bbi\b)\b/i,
  "Software Engineering": /\b(software engineer\w*|developer|programmer|full[- ]stack|backend|frontend|\bswe\b)\b/i,
  "Healthcare & Nursing": /\b(nurse|\brn\b|clinical|physician|medical assistant|healthcare)\b/i,
  Marketing: /\b(marketing|brand|seo|content strategist|growth marketer)\b/i,
  Sales: /\b(sales|account executive|business development)\b/i,
  "Education & Teaching": /\b(teacher|instructor|professor|tutor|educator)\b/i,
  "Finance & Accounting": /\b(accountant|financial analy\w*|bookkeep\w*|controller|auditor)\b/i,
  "Human Resources": /\b(\bhr\b|human resources|recruiter|talent acquisition)\b/i,
  Design: /\b(designer|\bux\b|\bui\b|product design)\b/i,
  "Project & Program Management": /\b(project manager|program manager|scrum master|\bpmp\b)\b/i,
};

export function classifyDomain(title: string): string | null {
  for (const [domain, pattern] of Object.entries(DOMAIN_KEYWORDS)) {
    if (pattern.test(title)) return domain;
  }
  return null;
}

interface DomainedRole {
  exp: WorkExperience;
  domain: string | null;
}

/**
 * Determines whether the most recent role's domain classification should be
 * trusted as "the current career direction" without asking the user.
 * Low confidence when:
 *  - the latest role's title doesn't match any known domain at all, or
 *  - the resume shows two or more domains with substantial (12+ months
 *    each) tenure and no single domain clearly dominates the recent history
 *    (i.e. a genuine career-change pattern where either could plausibly be
 *    "current").
 */
export function calculateExperienceBreakdown(
  workExperience: WorkExperience[],
  referenceDate: Date = new Date(),
  userConfirmedDomain: string | null = null
): ExperienceBreakdown {
  const total = calculateTotalExperience(workExperience, referenceDate);

  const domained: DomainedRole[] = workExperience.map((exp) => ({
    exp,
    domain: classifyDomain(exp.jobTitle),
  }));

  const detectedDomains = Array.from(
    new Set(domained.map((d) => d.domain).filter((d): d is string => d !== null))
  );

  // Find the most recent role with a usable date to anchor "current."
  const validRoles = domained.filter((d) => d.exp.jobTitle !== "Unknown — review required");
  const mostRecent = [...validRoles].sort((a, b) => {
    if (a.exp.period.isCurrent && !b.exp.period.isCurrent) return -1;
    if (b.exp.period.isCurrent && !a.exp.period.isCurrent) return 1;
    return (b.exp.period.endDate ?? "").localeCompare(a.exp.period.endDate ?? "");
  })[0];

  let currentDomain: string | null = userConfirmedDomain ?? mostRecent?.domain ?? null;

  // Compute tenure-per-domain to detect a genuine multi-domain / career-change pattern.
  const tenureByDomain = new Map<string, number>();
  for (const domain of detectedDomains) {
    const rolesInDomain = domained.filter((d) => d.domain === domain).map((d) => d.exp);
    const calc = calculateTotalExperience(rolesInDomain, referenceDate);
    tenureByDomain.set(domain, calc.totalMonths ?? 0);
  }
  const domainsWithSubstantialTenure = Array.from(tenureByDomain.entries()).filter(
    ([, months]) => months >= 12
  );

  const latestTitleUnclassified = mostRecent && mostRecent.domain === null;
  const multipleSubstantialDomains = domainsWithSubstantialTenure.length >= 2;

  const needsUserConfirmation =
    !userConfirmedDomain && (latestTitleUnclassified || (multipleSubstantialDomains && !mostRecent?.domain));

  // Best-guess default to SHOW as a suggestion in the confirmation UI, even
  // when we're not confident enough to set currentDomain automatically.
  // Preference order: the most recent role's domain if it has one, else
  // whichever domain has the most accumulated tenure.
  const domainByMostTenure =
    domainsWithSubstantialTenure.length > 0
      ? domainsWithSubstantialTenure.sort((a, b) => b[1] - a[1])[0][0]
      : null;
  const recommendedDomain = userConfirmedDomain ?? mostRecent?.domain ?? domainByMostTenure ?? null;

  // If confirmation is needed and we have no reliable anchor, don't guess —
  // currentDomain stays whatever the (possibly null) most-recent-role
  // classification produced; it is NOT backfilled from the largest domain,
  // since "biggest bucket historically" and "current direction" are not the
  // same claim.
  let currentDomainYears: number | null = null;
  let currentDomainMonths: number | null = null;

  if (currentDomain) {
    const rolesInCurrentDomain = domained.filter((d) => d.domain === currentDomain).map((d) => d.exp);
    const calc = calculateTotalExperience(rolesInCurrentDomain, referenceDate);
    currentDomainYears = calc.years;
    currentDomainMonths = calc.months;
  }

  return {
    totalYears: total.years,
    totalMonths: total.months,
    currentDomain,
    recommendedDomain,
    currentDomainYears,
    currentDomainMonths,
    detectedDomains,
    needsUserConfirmation,
    userConfirmedDomain,
  };
}
