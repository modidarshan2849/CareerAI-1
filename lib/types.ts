/**
 * CareerAI V0.1 — Core data model
 *
 * Design rule (non-negotiable, per product spec):
 * The system must NEVER invent experience, skills, job titles, employers,
 * salary eligibility, visa compatibility, or qualifications.
 * Unknown information stays UNKNOWN. It is never treated as positive evidence.
 */

export type Confidence = "High" | "Medium" | "Low";

export type ISODate = string; // "YYYY-MM-DD" or "YYYY-MM"

export interface EmploymentPeriod {
  startDate: ISODate | null;
  endDate: ISODate | null; // null + isCurrent = "present"
  isCurrent: boolean;
}

export interface WorkExperience {
  id: string;
  jobTitle: string | "Unknown — review required";
  employer: string | "Unknown — review required";
  period: EmploymentPeriod;
  responsibilities: string[];
  achievements: string[];
  technologies: string[];
  employmentType:
    | "full-time"
    | "part-time"
    | "contract"
    | "internship"
    | "freelance"
    | "unknown";
  leadershipEvidence: string[]; // verbatim/paraphrased evidence strings, not a boolean guess
  source: string; // evidence pointer, e.g. "resume:section 2, line 14"
  needsReview: boolean;
}

export interface SkillEvidence {
  skillName: string;
  /** Only populated when supported by dated work experience or explicit resume statement. */
  yearsOfExperience: number | null;
  monthsOfExperience: number | null;
  confidence: Confidence | "Experience not established";
  evidence: string[]; // pointers to supporting facts
  sourceRoleIds: string[]; // WorkExperience.id references
}

export interface EducationRecord {
  id: string;
  institution: string;
  credential: string;
  field: string | null;
  graduationDate: ISODate | null;
  source: string;
}

export interface CareerGap {
  gap: string;
  whyItMatters: string;
  evidence: string; // what in the profile supports this being a real gap
  suggestedImprovement: string;
  priority: "High" | "Medium" | "Low";
}

export type RoleTier = "BEST_FIT" | "GOOD_FIT" | "STRETCH";

export interface SuggestedRole {
  role: string;
  tier: RoleTier;
  rationale: string;
  supportingEvidence: string[];
  importantGaps: string[];
  /**
   * lateral   = same seniority level as the user's current evidenced role
   * higher    = a step up (e.g. individual contributor -> manager); only
   *             ever included when evidenced, and the UI must label it
   *             distinctly from lateral suggestions
   * downgrade = more junior than the user's current role in the same role
   *             family; these are filtered out before suggestions are
   *             returned and should never reach the UI
   */
  seniorityRelation: "lateral" | "higher";
  /**
   * True only for a role the person explicitly typed into Job Preferences
   * as a target. These bypass the career-direction guard entirely — an
   * explicit choice is not a system recommendation and must never be
   * blocked, relabeled, or silently dropped the way an automatic downgrade
   * suggestion would be.
   */
  isExplicitUserTarget: boolean;
}

export interface CareerStrengthResult {
  score: number; // capped at 95
  breakdown: {
    experienceDepth: number;
    skillCoverage: number;
    education: number;
    quantifiedAchievements: number;
    leadership: number;
    profileCompleteness: number;
  };
  strengths: string[];
  gaps: CareerGap[];
  reasoning: string[];
}

export interface ValidationWarning {
  id: string;
  type:
    | "missing_title"
    | "missing_employer"
    | "missing_dates"
    | "impossible_dates"
    | "overlapping_employment_flagged"
    | "duplicate_role"
    | "duplicate_period"
    | "contradictory_dates"
    | "contradictory_employer"
    | "unsupported_skill_years"
    | "contradictory_skill_evidence"
    | "skill_became_job"
    | "achievement_became_job";
  message: string;
  relatedRecordId: string | null;
  resolved: boolean;
}

export interface JobPreferences {
  targetRoles: string[];
  location: string | null;
  radiusMiles: number | null;
  remote: boolean;
  hybrid: boolean;
  onsite: boolean;
  targetSalary: number | null; // preference, NOT a hard exclusion
  absoluteMinimumSalary: number | null; // may be a hard exclusion
  employmentType: WorkExperience["employmentType"][];
  workAuthorization: string | null;
  visaStatus: string | null;
  sponsorshipRequired: boolean | null; // null = unknown, must NOT default to true or false
  endDate: ISODate | null;
}

export interface ExperienceBreakdown {
  /** Career-wide total, across every domain the person has ever worked in. */
  totalYears: number | null;
  totalMonths: number | null;
  /** The domain of the person's most recent evidenced role, if confidently classified. */
  currentDomain: string | null;
  /**
   * A best-guess default to highlight in the confirmation UI — the most
   * recent role's domain if classified, otherwise whichever detected domain
   * has the most tenure. This is ALWAYS just a suggestion for the person to
   * accept or override; it never substitutes for currentDomain being set,
   * and needsUserConfirmation is unaffected by whether this is non-null.
   */
  recommendedDomain: string | null;
  /** Union of tenure within roles belonging to currentDomain only. */
  currentDomainYears: number | null;
  currentDomainMonths: number | null;
  /** All distinct domains detected across the person's work history. */
  detectedDomains: string[];
  /**
   * True when the system can't confidently tell which domain represents the
   * person's intended current career direction (e.g. a recent title with no
   * clear domain keywords, or multiple substantial domains with no signal
   * about which is the target). When true, the UI must ask the person to
   * confirm rather than assuming all history belongs to one path.
   */
  needsUserConfirmation: boolean;
  /** Set once the person explicitly confirms/overrides their current domain. */
  userConfirmedDomain: string | null;
}

export interface MasterCareerProfile {
  userId: string;
  workExperience: WorkExperience[];
  skills: SkillEvidence[];
  education: EducationRecord[];
  totalExperience: {
    years: number | null;
    months: number | null;
    isUnknown: boolean;
    flagged: boolean;
  };
  experienceBreakdown: ExperienceBreakdown | null;
  careerStrength: CareerStrengthResult | null;
  suggestedRoles: SuggestedRole[];
  preferences: JobPreferences | null;
  validationWarnings: ValidationWarning[];
  activeResumeId: string | null;
  updatedAt: string;
}

export interface JobPosting {
  id: string;
  title: string;
  employer: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  requiresSponsorship: boolean | null; // null = unknown
  requirements: string[];
  isOpen: boolean;
}

export type MatchStatus = "GREEN" | "AMBER" | "RED";

export interface MatchScores {
  careerMatch: number; // 0-100
  eligibility: number; // 0-100
  preferenceMatch: number; // 0-100
  verificationConfidence: number; // 0-100
  overallFit: number; // 0-100
  status: MatchStatus;
  hardExclusionReasons: string[];
  reasoning: string[];
}
