import { EmploymentPeriod, WorkExperience } from "./types";

/**
 * Section 3 of spec: Total experience = UNION of employment date ranges, never
 * a naive sum. Overlapping jobs must not be double-counted.
 *
 * Example from spec:
 *   Jan 2015–Jan 2020  +  Jan 2018–Jan 2022  must NOT equal 9 years.
 *   The union is Jan 2015–Jan 2022 = 7 years.
 */

interface MonthRange {
  startMonths: number; // months since epoch (year*12 + monthIndex)
  endMonths: number; // exclusive
}

/** Parses "YYYY-MM-DD" or "YYYY-MM" or "YYYY" into an absolute month index. Returns null if unparseable. */
function toMonthIndex(date: string | null): number | null {
  if (!date) return null;
  const match = date.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = match[2] ? parseInt(match[2], 10) : 1;
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

export function nowMonthIndex(referenceDate: Date = new Date()): number {
  return referenceDate.getFullYear() * 12 + referenceDate.getMonth();
}

export interface ExperienceCalculationResult {
  totalMonths: number | null;
  years: number | null;
  months: number | null;
  isUnknown: boolean;
  flagged: boolean;
  flagReasons: string[];
  mergedRangeCount: number;
  excludedRecordIds: string[]; // records excluded because dates were unparseable
}

/**
 * Calculates total career experience as the union of all valid employment
 * date ranges. Records with missing/impossible dates are excluded from the
 * numeric total and reported via flagReasons, per spec section 3 & 4:
 * "Missing dates -> experience remains unknown/null and is flagged."
 * "Never invent dates."
 */
export function calculateTotalExperience(
  experiences: WorkExperience[],
  referenceDate: Date = new Date()
): ExperienceCalculationResult {
  const flagReasons: string[] = [];
  const excludedRecordIds: string[] = [];
  const ranges: MonthRange[] = [];
  const nowIdx = nowMonthIndex(referenceDate);

  for (const exp of experiences) {
    const range = periodToMonthRange(exp.period, nowIdx);
    if (range === "missing") {
      excludedRecordIds.push(exp.id);
      flagReasons.push(
        `Experience "${exp.jobTitle}" at "${exp.employer}" has missing dates and was excluded from the total.`
      );
      continue;
    }
    if (range === "impossible") {
      excludedRecordIds.push(exp.id);
      flagReasons.push(
        `Experience "${exp.jobTitle}" at "${exp.employer}" has an end date before its start date and was excluded from the total.`
      );
      continue;
    }
    ranges.push(range);
  }

  if (ranges.length === 0) {
    return {
      totalMonths: null,
      years: null,
      months: null,
      isUnknown: true,
      flagged: flagReasons.length > 0,
      flagReasons,
      mergedRangeCount: 0,
      excludedRecordIds,
    };
  }

  const merged = mergeRanges(ranges);
  const totalMonths = merged.reduce((sum, r) => sum + (r.endMonths - r.startMonths), 0);

  return {
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    isUnknown: false,
    flagged: flagReasons.length > 0,
    flagReasons,
    mergedRangeCount: merged.length,
    excludedRecordIds,
  };
}

function periodToMonthRange(
  period: EmploymentPeriod,
  nowIdx: number
): MonthRange | "missing" | "impossible" {
  const start = toMonthIndex(period.startDate);
  if (start === null) return "missing";

  let end: number;
  if (period.isCurrent) {
    end = nowIdx + 1; // treat "present" as inclusive through current month
  } else {
    const parsedEnd = toMonthIndex(period.endDate);
    if (parsedEnd === null) return "missing";
    end = parsedEnd;
  }

  if (end < start) return "impossible";
  // end is exclusive-ish for a same-month role; treat same start/end month as 1 month of tenure
  return { startMonths: start, endMonths: Math.max(end, start + 1) };
}

/** Standard interval-union merge, O(n log n). */
function mergeRanges(ranges: MonthRange[]): MonthRange[] {
  const sorted = [...ranges].sort((a, b) => a.startMonths - b.startMonths);
  const merged: MonthRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.startMonths <= last.endMonths) {
      last.endMonths = Math.max(last.endMonths, range.endMonths);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/** Detects overlapping employment periods for validation warnings (section 12). Does not alter the total. */
export function detectOverlaps(experiences: WorkExperience[]): Array<[string, string]> {
  const withRanges = experiences
    .map((exp) => ({ id: exp.id, range: periodToMonthRange(exp.period, nowMonthIndex()) }))
    .filter((x): x is { id: string; range: MonthRange } => typeof x.range === "object");

  const overlaps: Array<[string, string]> = [];
  for (let i = 0; i < withRanges.length; i++) {
    for (let j = i + 1; j < withRanges.length; j++) {
      const a = withRanges[i];
      const b = withRanges[j];
      if (a.range.startMonths < b.range.endMonths && b.range.startMonths < a.range.endMonths) {
        overlaps.push([a.id, b.id]);
      }
    }
  }
  return overlaps;
}
