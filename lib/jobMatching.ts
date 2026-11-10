export interface CandidatePreferences {
  targetTitles: string[];
  workModes: string[];
  minSalary: number;
  citizenshipStatus: "US_Citizen" | "Green_Card" | "EAD_OPT" | "H1B_Transfer" | "Requires_Sponsorship";
  requiresSponsorship: boolean;
  totalExperienceYears: number;
  preferredIndustries: string[];
  homeCity: string;
  homeState: string;
  maxCommuteMiles: number;
}

export interface RawDbJob {
  id: string;
  title: string;
  employer: string;
  location: string;
  country: string;
  work_mode: string;
  is_remote: boolean;
  remote_policy?: string | null;
  industry?: string | null;
  experience_level?: string | null;
  min_years_required?: number | null;
  sponsorship_policy?: string | null;
  requires_us_clearance?: boolean | null;
  salary_min?: number | null;
  salary_max?: number | null;
  description?: string | null;
  required_skills?: string[] | null;
  preferred_skills?: string[] | null;
  source_url?: string | null;
  source_platform?: string | null;
  posted_at?: string | null;
  is_active?: boolean;
}

export interface CompatibilityVector {
  skillsCoverage: number;
  seniorityFit: number;
  salaryFit: number;
  industryAffinity: number;
}

export interface EvaluatedJobMatch {
  jobId: string;
  rank: number;
  title: string;
  employer: string;
  location: string;
  resolvedWorkMode: "remote" | "hybrid" | "onsite";
  workModeNote: string | null;
  industry: string;
  experienceLevel: string;
  sponsorshipPolicy: string;
  salaryDisplay: string;
  salaryMin: number | null;
  salaryMax: number | null;
  sourcePlatform: string;
  sourceUrl: string;
  postedAt: string;
  daysAgo: number;
  urgencyStatus: "fresh" | "active" | "expiring";
  matchScore: number;
  compatibility: CompatibilityVector;
  isEligible: boolean;
  hardExclusions: string[];
  advisoryWarnings: string[];
  matchedSkills: string[];
  missingSkills: string[];
  topUnlockSkill: string | null;
  fitReasons: string[];
}

function formatSalary(min?: number | null, max?: number | null): string {
  if (min && max) return `$${Math.round(min / 1000)}k – $${Math.round(max / 1000)}k`;
  if (min) return `From $${Math.round(min / 1000)}k`;
  if (max) return `Up to $${Math.round(max / 1000)}k`;
  return "Competitive / Unlisted";
}

const KNOWN_METROS: Record<string, { lat: number; lon: number }> = {
  "virginia beach": { lat: 36.8529, lon: -75.978 },
  "norfolk": { lat: 36.8508, lon: -76.2859 },
  "richmond": { lat: 37.5407, lon: -77.436 },
  "washington": { lat: 38.9072, lon: -77.0369 },
  "new york": { lat: 40.7128, lon: -74.006 },
  "denver": { lat: 39.7392, lon: -104.9903 },
  "san francisco": { lat: 37.7749, lon: -122.4194 },
  "seattle": { lat: 47.6062, lon: -122.3321 },
};

function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const CORE_DOMAIN_KEYWORDS = [
  "data", "analytic", "analytics", "bi", "business intelligence", 
  "warehouse", "warehousing", "snowflake", "etl", "pipeline", 
  "dbt", "reporting", "insights", "sql", "tableau", "power bi"
];

const IRRELEVANT_TITLE_BLOCKLIST = [
  "accounting", "finance manager", "p2p", "procure to pay", 
  "control plane", "dataplane", "infrastructure manager", 
  "site reliability", "sre", "hardware", "firmware", "sales manager",
  "talent", "recruiter", "customer delivery", "workforce transformation"
];

// Must vs. May Visa Evaluator
export function evaluateVisaConstraint(
  descText: string,
  candidateStatus: string
): { isHardGated: boolean; hardReason: string | null; advisoryWarning: string | null } {
  const text = (descText || "").toLowerCase();

  // 1. Mandatory Gate ("Must Require")
  const hardPatterns = [
    /\bmust be a u\.?s\.? citizen\b/i,
    /\bu\.?s\.? citizenship (?:is )?required\b/i,
    /\bcitizens? or green card only\b/i,
    /\bactive (?:secret|top secret|ts\/sci) clearance required\b/i,
    /\bunable to sponsor(?: now or in the future)?\b/i,
    /\bno (?:visa )?sponsorship available\b/i,
    /\bnot offering sponsorship\b/i,
    /\bno c2c\b/i
  ];

  for (const pattern of hardPatterns) {
    if (pattern.test(text)) {
      if (candidateStatus === "Requires_Sponsorship" || candidateStatus === "H1B_Transfer") {
        return {
          isHardGated: true,
          hardReason: "Employer explicitly requires US Citizenship / Green Card or offers no visa sponsorship",
          advisoryWarning: null
        };
      }
      if (candidateStatus !== "US_Citizen" && pattern.source.includes("clearance")) {
        return {
          isHardGated: true,
          hardReason: "Role requires active US Government Security Clearance",
          advisoryWarning: null
        };
      }
    }
  }

  // 2. Advisory Warning ("May Require" - e.g. Jobicy Lead Data Engineer)
  const advisoryPatterns = [
    /\bmay require (?:u\.?s\.? )?citizenship\b/i,
    /\bcitizenship preferred\b/i,
    /\bclient (?:contracts? )?may require u\.?s\.? citizenship\b/i,
    /\bsubject to export control(?: regulations)?\b/i,
    /\bability to obtain (?:a )?(?:security )?clearance\b/i,
    /\bitar compliance\b/i
  ];

  for (const pattern of advisoryPatterns) {
    if (pattern.test(text)) {
      if (candidateStatus !== "US_Citizen") {
        return {
          isHardGated: false,
          hardReason: null,
          advisoryWarning: "Advisory: Employer notes US citizenship may be preferred or required for specific contracts"
        };
      }
    }
  }

  return { isHardGated: false, hardReason: null, advisoryWarning: null };
}

export function evaluateJobFit(
  job: RawDbJob,
  candidateSkills: string[],
  prefs: CandidatePreferences
): EvaluatedJobMatch {
  const hardExclusions: string[] = [];
  const advisoryWarnings: string[] = [];
  const fitReasons: string[] = [];
  const titleLower = (job.title || "").toLowerCase();
  const locLower = (job.location || "").toLowerCase();
  const descLower = (job.description || "").toLowerCase();

  // 1. Recency & Urgency
  const postedDate = job.posted_at ? new Date(job.posted_at) : new Date();
  const now = new Date();
  const diffHours = Math.max(0, (now.getTime() - postedDate.getTime()) / (1000 * 60 * 60));
  const daysAgo = Math.floor(diffHours / 24);

  let urgencyStatus: "fresh" | "active" | "expiring" = "active";
  if (daysAgo <= 2) urgencyStatus = "fresh";
  else if (daysAgo >= 24) urgencyStatus = "expiring";

  // 2. Irrelevant Track & Management Gating
  if (IRRELEVANT_TITLE_BLOCKLIST.some((block) => titleLower.includes(block))) {
    hardExclusions.push(`Role family mismatch ("${job.title}" is administrative/infrastructure scope)`);
  }

  const isTargetingManagement = (prefs.targetTitles || []).some((ut) => /manager|director|lead/i.test(ut));
  if (/engineering manager/i.test(titleLower) && !isTargetingManagement) {
    hardExclusions.push(`Seniority mismatch: Engineering Manager role requires explicit people-management target`);
  }

  // 3. Location & Radius Resolving
  const userHomeKey = `${prefs.homeCity.toLowerCase()}`;
  const userCoords = KNOWN_METROS[userHomeKey] || KNOWN_METROS["virginia beach"];
  const hasRemoteOption = locLower.includes("remote") || job.is_remote;
  const hasHybridOption = locLower.includes("hybrid");

  let resolvedWorkMode: "remote" | "hybrid" | "onsite" = "remote";
  let workModeNote: string | null = null;

  if (hasHybridOption && !hasRemoteOption) {
    resolvedWorkMode = "hybrid";
    for (const [metro, coords] of Object.entries(KNOWN_METROS)) {
      if (locLower.includes(metro)) {
        const distance = calculateDistanceMiles(userCoords.lat, userCoords.lon, coords.lat, coords.lon);
        if (distance > prefs.maxCommuteMiles) {
          hardExclusions.push(
            `Location requires onsite presence in ${metro.toUpperCase()} (~${distance} miles away, exceeds ${prefs.maxCommuteMiles}mi limit)`
          );
        } else {
          workModeNote = `Within commute range (${distance} miles from ${prefs.homeCity})`;
        }
        break;
      }
    }
  } else if (hasHybridOption && hasRemoteOption) {
    resolvedWorkMode = "remote";
    workModeNote = "Multi-hub role (Hybrid in regional offices, remote eligible for your location)";
    fitReasons.push("Remote eligible for candidate home state");
  } else {
    resolvedWorkMode = job.work_mode === "onsite" ? "onsite" : "remote";
  }

  // 4. Visa & Clearance Evaluation (Must vs. May)
  const fullText = `${descLower} ${titleLower} ${locLower}`;
  const visaResult = evaluateVisaConstraint(fullText, prefs.citizenshipStatus);

  if (visaResult.isHardGated && visaResult.hardReason) {
    hardExclusions.push(visaResult.hardReason);
  }
  if (visaResult.advisoryWarning) {
    advisoryWarnings.push(visaResult.advisoryWarning);
  }

  if (
    (prefs.requiresSponsorship || prefs.citizenshipStatus === "Requires_Sponsorship") &&
    job.sponsorship_policy === "no_sponsorship" &&
    !hardExclusions.some((e) => e.includes("sponsorship"))
  ) {
    hardExclusions.push("Visa restriction: Employer explicitly does not sponsor visas");
  }

  // 5. Domain Relevance & Compensation Floor
  const matchesDomain = CORE_DOMAIN_KEYWORDS.some((kw) => titleLower.includes(kw));
  const matchesTargetTitles = (prefs.targetTitles || []).some((target) => {
    const t = target.toLowerCase();
    return titleLower.includes(t) || t.includes(titleLower);
  });

  if (!matchesDomain && !matchesTargetTitles) {
    hardExclusions.push(`Role family mismatch ("${job.title}" is outside data/analytics scope)`);
  }

  if (job.country && job.country.toUpperCase() !== "US") {
    hardExclusions.push(`Outside target country (${job.country})`);
  }

  if (job.salary_max && prefs.minSalary > 0 && job.salary_max < prefs.minSalary) {
    hardExclusions.push(
      `Compensation ceiling ($${Math.round(job.salary_max / 1000)}k) is below your minimum floor ($${Math.round(prefs.minSalary / 1000)}k)`
    );
  }

  const reqYears = job.min_years_required || 0;
  if (reqYears > prefs.totalExperienceYears + 3) {
    hardExclusions.push(`Requires ${reqYears}+ years experience (Profile evidences ~${prefs.totalExperienceYears} years)`);
  }

  // 6. Compatibility Vector & Scoring
  const candidateSkillSet = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));
  const required = Array.isArray(job.required_skills) ? job.required_skills : [];
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const req of required) {
    const clean = String(req || "").toLowerCase().trim();
    if (candidateSkillSet.has(clean)) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  }

  const skillsCoverage = required.length > 0 ? Math.round((matchedSkills.length / required.length) * 100) : 80;
  let seniorityFit = 85;
  if (job.experience_level === "Senior" || job.experience_level === "Lead") seniorityFit = 95;
  else if (job.experience_level === "Entry") seniorityFit = 60;

  let salaryFit = 80;
  if (job.salary_min && job.salary_min >= prefs.minSalary) salaryFit = 100;
  else if (job.salary_max && job.salary_max < prefs.minSalary) salaryFit = 30;

  let industryAffinity = 75;
  if (job.industry && (prefs.preferredIndustries || []).includes(job.industry)) industryAffinity = 100;

  const weighted = Math.round(
    skillsCoverage * 0.55 + seniorityFit * 0.20 + salaryFit * 0.15 + industryAffinity * 0.10
  );

  const isEligible = hardExclusions.length === 0;
  const finalScore = isEligible
    ? Math.max(20, Math.min(95, weighted))
    : Math.min(25, Math.max(10, weighted - 45));

  const topUnlockSkill = missingSkills.length > 0 ? missingSkills[0] : null;

  return {
    jobId: job.id,
    rank: 0,
    title: job.title,
    employer: job.employer,
    location: job.location,
    resolvedWorkMode,
    workModeNote,
    industry: job.industry || "Technology & SaaS",
    experienceLevel: job.experience_level || "Senior",
    sponsorshipPolicy: job.sponsorship_policy || "unknown",
    salaryDisplay: formatSalary(job.salary_min, job.salary_max),
    salaryMin: job.salary_min || null,
    salaryMax: job.salary_max || null,
    sourcePlatform: job.source_platform || "Enterprise ATS",
    sourceUrl: job.source_url || `https://www.google.com/search?q=${encodeURIComponent(job.title + " " + job.employer + " careers")}`,
    postedAt: job.posted_at || new Date().toISOString(),
    daysAgo,
    urgencyStatus,
    matchScore: finalScore,
    compatibility: {
      skillsCoverage,
      seniorityFit,
      salaryFit,
      industryAffinity,
    },
    isEligible,
    hardExclusions,
    advisoryWarnings,
    matchedSkills,
    missingSkills,
    topUnlockSkill,
    fitReasons,
  };
}

export function calculateJobMatch(userSkills: string[], job: RawDbJob): any {
  const defaultPrefs: CandidatePreferences = {
    targetTitles: ["Senior Data Analyst", "Lead Data Analyst", "Analytics Engineer"],
    workModes: ["remote", "hybrid"],
    minSalary: 120000,
    citizenshipStatus: "US_Citizen",
    requiresSponsorship: false,
    totalExperienceYears: 8,
    preferredIndustries: [],
    homeCity: "Virginia Beach",
    homeState: "VA",
    maxCommuteMiles: 50,
  };
  return evaluateJobFit(job, userSkills, defaultPrefs);
}
