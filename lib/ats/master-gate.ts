export interface UserPreferences {
  targetTitles: string[];
  maxMiles: number;
  includeRemote: boolean;
  minScore: number;
  minExperienceYears: number;
  requiredKeywords: string[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  targetTitles: [
    "Data Analyst",
    "Senior Data Analyst",
    "Lead Data Analyst",
    "Analytics Engineer",
    "BI Analyst",
    "Data Scientist",
    "Data Engineer"
  ],
  maxMiles: 30,
  includeRemote: true,
  minScore: 80,
  minExperienceYears: 5,
  requiredKeywords: ["Python", "SQL"]
};

export interface JobRequisition {
  id: string;
  title: string;
  company: string;
  location: string;
  milesFromHome: number;
  isRemote: boolean;
  score: number;
  experience_years: number;
  keywords: string[];
  url?: string;
  postedAt?: string;
  status?: string;
}

export interface GateCheck {
  gateNumber: number;
  name: string;
  passed: boolean;
  reason: string;
}

export interface MasterGateReport {
  jobId: string;
  overallPassed: boolean;
  gates: GateCheck[];
}

export function evaluateMasterGate(
  job: JobRequisition,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): MasterGateReport {
  const gates: GateCheck[] = [];

  // Gate 1: Preferred Title & Miles Radius
  const titleLower = (job.title || "").toLowerCase();
  const titleMatched =
    prefs.targetTitles.length === 0 ||
    prefs.targetTitles.some(t => titleLower.includes(t.toLowerCase().trim()));
  const distanceMatched =
    (job.isRemote && prefs.includeRemote) || job.milesFromHome <= prefs.maxMiles;
  const g1Passed = titleMatched && distanceMatched;

  gates.push({
    gateNumber: 1,
    name: "Title & Miles",
    passed: g1Passed,
    reason: g1Passed
      ? `${job.isRemote ? "Remote" : job.milesFromHome + " mi"} & title matched`
      : !titleMatched
      ? "Title outside preferences"
      : `${job.milesFromHome} mi exceeds ${prefs.maxMiles} mi`
  });

  // Gate 2: ATS Score Threshold
  const g2Passed = typeof job.score === "number" && job.score >= prefs.minScore;
  gates.push({
    gateNumber: 2,
    name: "ATS Score",
    passed: g2Passed,
    reason: g2Passed ? `${job.score} pts >= ${prefs.minScore}` : `${job.score} pts < ${prefs.minScore}`
  });

  // Gate 3: Tech Keywords & Experience
  const jobKwLower = (job.keywords || []).map(k => k.toLowerCase().trim());
  const missingKw = prefs.requiredKeywords.filter(
    req => !jobKwLower.includes(req.toLowerCase().trim())
  );
  const expPassed = (job.experience_years ?? 5) >= prefs.minExperienceYears;
  const g3Passed = missingKw.length === 0 && expPassed;

  gates.push({
    gateNumber: 3,
    name: "Keywords & Exp",
    passed: g3Passed,
    reason: g3Passed
      ? `${job.experience_years}y exp & keywords matched`
      : missingKw.length > 0
      ? `Missing: ${missingKw.join(", ")}`
      : `${job.experience_years}y < ${prefs.minExperienceYears}y`
  });

  // Gate 4: Schema & Active Status
  const g4Passed = Boolean(job.id && job.title && job.company);
  gates.push({
    gateNumber: 4,
    name: "Integrity",
    passed: g4Passed,
    reason: g4Passed ? "Valid job record" : "Incomplete job schema"
  });

  // Gate 5: Master Layer Check (Verifies Gates 1-4 all ran and passed)
  const masterPassed = gates.length === 4 && gates.every(g => g.passed);
  gates.push({
    gateNumber: 5,
    name: "Master Gate",
    passed: masterPassed,
    reason: masterPassed ? "All 4 gates verified" : "Filtered by Master Gate"
  });

  return {
    jobId: job.id,
    overallPassed: masterPassed,
    gates
  };
}
