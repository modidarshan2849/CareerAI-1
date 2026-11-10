export interface WorkExperienceRecord {
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  position?: string | null;
  company?: string | null;
}

interface DateInterval {
  startMs: number;
  endMs: number;
}

function parseFlexibleDate(d: string | null | undefined, isEnd = false): number | null {
  if (!d) return null;
  const clean = d.trim().toLowerCase();
  if (clean === "present" || clean === "current" || clean === "now") {
    return Date.now();
  }

  if (/^\d{4}$/.test(clean)) {
    return isEnd ? new Date(parseInt(clean, 10), 11, 31).getTime() : new Date(parseInt(clean, 10), 0, 1).getTime();
  }

  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export function calculateContinuousExperienceMonths(records: WorkExperienceRecord[]): number {
  if (!Array.isArray(records) || records.length === 0) return 0;

  const intervals: DateInterval[] = [];

  for (const r of records) {
    const startMs = parseFlexibleDate(r.start_date, false);
    let endMs = parseFlexibleDate(r.end_date, true);

    if (r.is_current || !endMs) {
      endMs = Date.now();
    }

    if (startMs && endMs && endMs >= startMs) {
      intervals.push({ startMs, endMs });
    }
  }

  if (intervals.length === 0) return 0;

  intervals.sort((a, b) => a.startMs - b.startMs);

  const merged: DateInterval[] = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = intervals[i];

    if (curr.startMs <= prev.endMs) {
      prev.endMs = Math.max(prev.endMs, curr.endMs);
    } else {
      merged.push(curr);
    }
  }

  let totalMonths = 0;
  const MS_PER_MONTH = (1000 * 60 * 60 * 24 * 365.25) / 12;

  for (const interval of merged) {
    const diff = interval.endMs - interval.startMs;
    totalMonths += Math.max(1, Math.round(diff / MS_PER_MONTH));
  }

  return totalMonths;
}

export function formatExperienceDisplay(totalMonths: number): string {
  if (totalMonths <= 0) return "0y 0m";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${years}y${months}m`;
}
