export interface UserScenario {
  id: string;
  scenario_name: string;
  highest_degree: "bachelors" | "masters" | "phd";
  requires_sponsorship: boolean;
  target_titles: string[];
  target_locations: string[];
  min_years_exp?: number | null;
  max_years_exp?: number | null;
}

export interface JobPosting {
  job_id: string;
  source_company: string;
  title: string | null;
  apply_url: string | null;
  description?: string | null;
  location?: string | null;
  withdrawn_at?: string | null;
}

export interface EvaluatedJob {
  isWithdrawn: boolean;
  redFlags: string[];
  titleMatches: boolean;
}

const MASTERS_REQUIRED_PATTERNS = [
  /master'?s\s+(degree\s+)?(in\s+)?[a-z\s]+\s+(is\s+)?required/i,
  /requires?\s+(a\s+|an\s+)?m\.?s\.?\s*(or|\/|,|\s+degree)/i,
  /minimum\s+education:\s*master/i,
];

const NO_SPONSORSHIP_PATTERNS = [
  /will\s+not\s+sponsor/i,
  /no\s+visa\s+sponsorship/i,
  /sponsorship\s+is\s+not\s+available/i,
  /u\.?s\.?\s+citizen(ship)?\s+only/i,
  /active\s+(security\s+)?clearance\s+required/i,
];

export function evaluateJobForScenario(
  job: JobPosting,
  scenario: UserScenario
): EvaluatedJob {
  const text = `${job.title ?? ""} ${job.description ?? ""}`.trim();
  const redFlags: string[] = [];

  if (
    scenario.highest_degree === "bachelors" &&
    MASTERS_REQUIRED_PATTERNS.some((rx) => rx.test(text))
  ) {
    redFlags.push("MANDATORY_MASTERS");
  }

  if (
    scenario.requires_sponsorship &&
    NO_SPONSORSHIP_PATTERNS.some((rx) => rx.test(text))
  ) {
    redFlags.push("SPONSORSHIP_RISK");
  }

  const normalizedTitle = (job.title ?? "").toLowerCase();
  const titleMatches =
    scenario.target_titles.length === 0 ||
    scenario.target_titles.some((t) =>
      normalizedTitle.includes(t.toLowerCase().trim())
    );

  return {
    isWithdrawn: Boolean(job.withdrawn_at),
    redFlags,
    titleMatches,
  };
}
