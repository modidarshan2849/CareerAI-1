import { createClient } from "@/lib/supabase/server";
import {
  CareerStrengthResult,
  EducationRecord,
  JobPreferences,
  SkillEvidence,
  SuggestedRole,
  ValidationWarning,
  WorkExperience,
} from "@/lib/types";
import { calculateTotalExperience } from "@/lib/experience";
import { calculateExperienceBreakdown } from "@/lib/careerDomain";
import { combineWithExplicitTargets } from "@/lib/roles";

function mapWorkExperience(row: any): WorkExperience {
  return {
    id: row.id,
    jobTitle: row.job_title,
    employer: row.employer,
    period: {
      startDate: row.start_date,
      endDate: row.end_date,
      isCurrent: row.is_current,
    },
    responsibilities: row.responsibilities ?? [],
    achievements: row.achievements ?? [],
    technologies: row.technologies ?? [],
    employmentType: row.employment_type,
    leadershipEvidence: row.leadership_evidence ?? [],
    source: row.source ?? "",
    needsReview: row.needs_review,
  };
}

function mapSkill(row: any): SkillEvidence {
  return {
    skillName: row.skill_name,
    yearsOfExperience: row.years_of_experience,
    monthsOfExperience: row.months_of_experience,
    confidence: row.confidence,
    evidence: row.evidence ?? [],
    sourceRoleIds: row.source_role_ids ?? [],
  };
}

function mapEducation(row: any): EducationRecord {
  return {
    id: row.id,
    institution: row.institution,
    credential: row.credential,
    field: row.field,
    graduationDate: row.graduation_date,
    source: row.source ?? "",
  };
}

function mapPreferences(row: any): JobPreferences {
  return {
    targetRoles: row.target_roles ?? [],
    location: row.location,
    radiusMiles: row.radius_miles,
    remote: row.remote,
    hybrid: row.hybrid,
    onsite: row.onsite,
    targetSalary: row.target_salary,
    absoluteMinimumSalary: row.absolute_minimum_salary,
    employmentType: row.employment_type ?? [],
    workAuthorization: row.work_authorization,
    visaStatus: row.visa_status,
    sponsorshipRequired: row.sponsorship_required,
    endDate: row.end_date,
  };
}

function mapWarning(row: any): ValidationWarning {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    relatedRecordId: row.related_record_id,
    resolved: row.resolved,
  };
}

function mapSuggestedRole(row: any): SuggestedRole {
  return {
    role: row.role,
    tier: row.tier,
    rationale: row.rationale,
    supportingEvidence: row.supporting_evidence ?? [],
    importantGaps: row.important_gaps ?? [],
    seniorityRelation: row.seniority_relation ?? "lateral",
    isExplicitUserTarget: false, // persisted rows are always system-generated; see schema comment
  };
}

export async function getFullProfile(userId: string) {
  const supabase = await createClient();

  const [workExpRes, skillsRes, educationRes, warningsRes, prefsRes, strengthRes, rolesRes, activeResumeRes] =
    await Promise.all([
      supabase.from("work_experience").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", userId),
      supabase.from("education").select("*").eq("user_id", userId),
      supabase.from("validation_warnings").select("*").eq("user_id", userId).eq("resolved", false),
      supabase.from("job_preferences").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("career_strength_snapshots")
        .select("*")
        .eq("user_id", userId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("suggested_roles").select("*").eq("user_id", userId),
      supabase.from("resumes").select("*").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    ]);

  const workExperience = (workExpRes.data ?? []).map(mapWorkExperience);
  const skills = (skillsRes.data ?? []).map(mapSkill);
  const education = (educationRes.data ?? []).map(mapEducation);
  const warnings = (warningsRes.data ?? []).map(mapWarning);
  const preferences = prefsRes.data ? mapPreferences(prefsRes.data) : null;
  const systemSuggestedRoles = (rolesRes.data ?? []).map(mapSuggestedRole);
  // Explicit Job Preference target roles are merged in here, at read time —
  // never persisted alongside system suggestions — so changing preferences
  // takes effect immediately without needing to recompute the system side.
  const suggestedRoles = combineWithExplicitTargets(systemSuggestedRoles, preferences?.targetRoles ?? []);
  // NOTE (duplicate-logic audit): calculateTotalExperience/calculateExperienceBreakdown
  // are called here AND inside lib/recompute.ts. This is intentional, not a duplicate
  // implementation — both call sites import the exact same pure function from
  // lib/experience.ts / lib/careerDomain.ts. recompute.ts calls it at WRITE time
  // (to compute gaps/strength/roles that get persisted); this call happens at READ
  // time so total/current-domain experience always reflect the current
  // confirmed_career_domain immediately, without needing their own snapshot table.
  // Since the function is pure and cheap, calling it twice per write-then-read cycle
  // carries no correctness risk — but it's flagged here so it's never mistaken for
  // an independent second implementation of the experience math.
  const totalExperience = calculateTotalExperience(workExperience);
  const experienceBreakdown = calculateExperienceBreakdown(
    workExperience,
    new Date(),
    prefsRes.data?.confirmed_career_domain ?? null
  );

  const careerStrength: CareerStrengthResult | null = strengthRes.data
    ? {
        score: strengthRes.data.score,
        breakdown: strengthRes.data.breakdown,
        strengths: strengthRes.data.strengths ?? [],
        gaps: strengthRes.data.gaps ?? [],
        reasoning: strengthRes.data.reasoning ?? [],
      }
    : null;

  return {
    workExperience,
    skills,
    education,
    validationWarnings: warnings,
    preferences,
    careerStrength,
    suggestedRoles,
    totalExperience,
    experienceBreakdown,
    hasActiveResume: !!activeResumeRes.data,
    activeResumeId: activeResumeRes.data?.id ?? null,
  };
}
