export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { recomputeDerivedProfile } from "@/lib/recompute";
import { WorkExperience } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

/**
 * Accepts the full edited work_experience array from the review screen,
 * persists it, then recomputes every derived field via the single shared
 * recompute function — never trusting client-supplied scores directly
 * (section 14: corrections must persist through refresh/logout/login;
 * section 6: scores are always evidence-derived, not client state).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const workExperience: WorkExperience[] = body.workExperience ?? [];

  for (const exp of workExperience) {
    await supabase
      .from("work_experience")
      .update({
        job_title: exp.jobTitle,
        employer: exp.employer,
        start_date: exp.period.startDate,
        end_date: exp.period.endDate,
        is_current: exp.period.isCurrent,
        needs_review: exp.jobTitle === "Unknown — review required" || exp.employer === "Unknown — review required",
        updated_at: new Date().toISOString(),
      })
      .eq("id", exp.id)
      .eq("user_id", user.id); // RLS also enforces this, but explicit is safer
  }

  const [{ data: freshWorkRows }, { data: skillRows }, { data: eduRows }, { data: prefsRow }] = await Promise.all([
    supabase.from("work_experience").select("*").eq("user_id", user.id),
    supabase.from("skills").select("*").eq("user_id", user.id),
    supabase.from("education").select("*").eq("user_id", user.id),
    supabase.from("job_preferences").select("confirmed_career_domain").eq("user_id", user.id).maybeSingle(),
  ]);

  const freshWork: WorkExperience[] = (freshWorkRows ?? []).map((row: any) => ({
    id: row.id,
    jobTitle: row.job_title,
    employer: row.employer,
    period: { startDate: row.start_date, endDate: row.end_date, isCurrent: row.is_current },
    responsibilities: row.responsibilities,
    achievements: row.achievements,
    technologies: row.technologies,
    employmentType: row.employment_type,
    leadershipEvidence: row.leadership_evidence,
    source: row.source,
    needsReview: row.needs_review,
  }));

  const skills = (skillRows ?? []).map((row: any) => ({
    skillName: row.skill_name,
    yearsOfExperience: row.years_of_experience,
    monthsOfExperience: row.months_of_experience,
    confidence: row.confidence,
    evidence: row.evidence,
    sourceRoleIds: row.source_role_ids,
  }));

  const education = (eduRows ?? []).map((row: any) => ({
    id: row.id,
    institution: row.institution,
    credential: row.credential,
    field: row.field,
    graduationDate: row.graduation_date,
    source: row.source,
  }));

  const confirmedDomain = prefsRow?.confirmed_career_domain ?? null;
  const derived = recomputeDerivedProfile(freshWork, skills as any, education, confirmedDomain);

  // Recompute warnings from scratch — resolved warnings whose issue no
  // longer reproduces simply won't appear again (section 12).
  await supabase.from("validation_warnings").delete().eq("user_id", user.id);
  if (derived.validationWarnings.length > 0) {
    await supabase.from("validation_warnings").insert(
      derived.validationWarnings.map((w) => ({
        user_id: user.id,
        type: w.type,
        message: w.message,
        related_record_id: w.relatedRecordId,
        resolved: false,
      }))
    );
  }

  await supabase.from("career_strength_snapshots").insert({
    user_id: user.id,
    score: derived.strength.score,
    breakdown: derived.strength.breakdown,
    strengths: derived.strength.strengths,
    gaps: derived.gaps,
    reasoning: derived.strength.reasoning,
  });

  await supabase.from("suggested_roles").delete().eq("user_id", user.id);
  if (derived.systemSuggestedRoles.length > 0) {
    await supabase.from("suggested_roles").insert(
      derived.systemSuggestedRoles.map((r) => ({
        user_id: user.id,
        role: r.role,
        tier: r.tier,
        rationale: r.rationale,
        supporting_evidence: r.supportingEvidence,
        important_gaps: r.importantGaps,
        seniority_relation: r.seniorityRelation,
      }))
    );
  }

  return NextResponse.json({
    success: true,
    warningCount: derived.validationWarnings.length,
    score: derived.strength.score,
  });
}
