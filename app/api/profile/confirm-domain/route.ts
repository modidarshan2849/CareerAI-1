export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { recomputeDerivedProfile } from "@/lib/recompute";
import { WorkExperience } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

/**
 * The ONLY way confirmed_career_domain ever gets set — always an explicit
 * person-initiated action, never inferred automatically. See lib/careerDomain.ts.
 *
 * Also the second write path (besides resume upload / profile edits) that
 * must recompute derived data, since changing the confirmed domain changes
 * current-domain experience, domain-related gaps, and which role suggestions
 * clear the career-direction guard — all through the same shared
 * recomputeDerivedProfile() used everywhere else.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { domain } = await request.json();
  if (typeof domain !== "string" || domain.trim().length === 0) {
    return NextResponse.json({ error: "A domain must be provided." }, { status: 400 });
  }

  const { error: upsertError } = await supabase.from("job_preferences").upsert(
    {
      user_id: user.id,
      confirmed_career_domain: domain,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertError) return NextResponse.json({ error: "Failed to save your confirmation." }, { status: 500 });

  const [{ data: workRows }, { data: skillRows }, { data: eduRows }] = await Promise.all([
    supabase.from("work_experience").select("*").eq("user_id", user.id),
    supabase.from("skills").select("*").eq("user_id", user.id),
    supabase.from("education").select("*").eq("user_id", user.id),
  ]);

  const workExperience: WorkExperience[] = (workRows ?? []).map((row: any) => ({
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

  // Note: total experience is NOT recomputed here because it doesn't
  // depend on confirmedDomain at all (calculateTotalExperience never takes
  // a domain argument) — only current-domain experience, gaps, and role
  // suggestions do. This is what guarantees "total experience does not
  // change" as a structural property, not just a tested behavior.
  const derived = recomputeDerivedProfile(workExperience, skills as any, education, domain);

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
    currentDomainYears: derived.experienceBreakdown.currentDomainYears,
    totalYears: derived.experienceBreakdown.totalYears,
  });
}
