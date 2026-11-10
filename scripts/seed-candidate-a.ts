/**
 * DEV/TEST-ONLY seed script. This does NOT run automatically — it is not
 * wired into `npm run dev`, `npm run build`, or any CI step. It must be
 * invoked explicitly:
 *
 *   npx tsx scripts/seed-candidate-a.ts --user-id=<a real auth.users id> --confirm
 *
 * Both --user-id and --confirm are required. Without --confirm, the script
 * prints what it WOULD do and exits without touching the database.
 *
 * This seeds Candidate A (see scripts/candidateAFixture.ts) into a REAL
 * Supabase project's work_experience/skills/education tables for the given
 * user id, then runs the same recomputeDerivedProfile() used by the live
 * app to populate suggested_roles and career_strength_snapshots — so the
 * seeded profile is exactly what a real upload would have produced, not a
 * hand-crafted shortcut.
 *
 * This script NEVER creates a user account itself and NEVER seeds the
 * `jobs` table with fake listings — it only populates one real, existing
 * user's profile data for manual QA against a live environment.
 */

import { createClient } from "@supabase/supabase-js";
import {
  CANDIDATE_A_WORK_EXPERIENCE,
  CANDIDATE_A_SKILLS,
  CANDIDATE_A_EDUCATION,
} from "./candidateAFixture";
import { recomputeDerivedProfile } from "../lib/recompute";

function parseArgs() {
  const args = process.argv.slice(2);
  const userIdArg = args.find((a) => a.startsWith("--user-id="));
  const confirmed = args.includes("--confirm");
  const userId = userIdArg?.split("=")[1];
  return { userId, confirmed };
}

async function main() {
  const { userId, confirmed } = parseArgs();

  if (!userId) {
    console.error("Missing --user-id=<uuid>. This must be a real auth.users id from your Supabase project.");
    console.error("Find one via: select id, email from auth.users; in the Supabase SQL editor.");
    process.exit(1);
  }

  if (!confirmed) {
    console.log("DRY RUN (no --confirm flag passed). This script would:");
    console.log(`  1. Delete any existing work_experience/skills/education rows for user_id=${userId}`);
    console.log(`  2. Insert ${CANDIDATE_A_WORK_EXPERIENCE.length} work experience record(s)`);
    console.log(`  3. Insert ${CANDIDATE_A_SKILLS.length} skill record(s)`);
    console.log(`  4. Insert ${CANDIDATE_A_EDUCATION.length} education record(s)`);
    console.log("  5. Recompute and persist career strength, gaps, and suggested roles");
    console.log("\nNo changes were made. Re-run with --confirm to actually seed this user.");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment. " +
        "The service role key is required (not the anon key) because this script writes on behalf of a specific user id, bypassing RLS intentionally for a one-time seed."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log(`Seeding Candidate A for user_id=${userId}...`);

  await supabase.from("work_experience").delete().eq("user_id", userId);
  await supabase.from("skills").delete().eq("user_id", userId);
  await supabase.from("education").delete().eq("user_id", userId);

  const { data: insertedWork, error: workError } = await supabase
    .from("work_experience")
    .insert(
      CANDIDATE_A_WORK_EXPERIENCE.map((w) => ({
        user_id: userId,
        job_title: w.jobTitle,
        employer: w.employer,
        start_date: w.period.startDate,
        end_date: w.period.endDate,
        is_current: w.period.isCurrent,
        responsibilities: w.responsibilities,
        achievements: w.achievements,
        technologies: w.technologies,
        employment_type: w.employmentType,
        leadership_evidence: w.leadershipEvidence,
        source: w.source,
        needs_review: w.needsReview,
      }))
    )
    .select();

  if (workError) {
    console.error("Failed to insert work experience:", workError.message);
    process.exit(1);
  }

  await supabase.from("skills").insert(
    CANDIDATE_A_SKILLS.map((s) => ({
      user_id: userId,
      skill_name: s.skillName,
      years_of_experience: s.yearsOfExperience,
      months_of_experience: s.monthsOfExperience,
      confidence: s.confidence,
      evidence: s.evidence,
      source_role_ids: s.sourceRoleIds,
    }))
  );

  await supabase.from("education").insert(
    CANDIDATE_A_EDUCATION.map((e) => ({
      user_id: userId,
      institution: e.institution,
      credential: e.credential,
      field: e.field,
      graduation_date: e.graduationDate,
      source: e.source,
    }))
  );

  // Recompute through the exact same shared path the live app uses, with
  // no confirmed domain yet. Note: because Candidate A's most recent role
  // ("Senior Data Analyst") classifies confidently on its own, the system
  // will NOT force a confirmation prompt — currentDomain auto-resolves to
  // "Data & Analytics" immediately. The always-visible "Change" control
  // will still show both detected domains (Sales, Data & Analytics) for
  // manual QA of the domain-switching flow. To exercise the FORCED
  // confirmation prompt instead, use a fixture whose most recent title is
  // unclassifiable (see lib/__tests__/careerDomain.test.ts for that case).
  const derived = recomputeDerivedProfile(
    CANDIDATE_A_WORK_EXPERIENCE,
    CANDIDATE_A_SKILLS,
    CANDIDATE_A_EDUCATION,
    null
  );

  await supabase.from("validation_warnings").delete().eq("user_id", userId);
  if (derived.validationWarnings.length > 0) {
    await supabase.from("validation_warnings").insert(
      derived.validationWarnings.map((w) => ({
        user_id: userId,
        type: w.type,
        message: w.message,
        related_record_id: w.relatedRecordId,
        resolved: false,
      }))
    );
  }

  await supabase.from("career_strength_snapshots").insert({
    user_id: userId,
    score: derived.strength.score,
    breakdown: derived.strength.breakdown,
    strengths: derived.strength.strengths,
    gaps: derived.gaps,
    reasoning: derived.strength.reasoning,
  });

  await supabase.from("suggested_roles").delete().eq("user_id", userId);
  if (derived.systemSuggestedRoles.length > 0) {
    await supabase.from("suggested_roles").insert(
      derived.systemSuggestedRoles.map((r) => ({
        user_id: userId,
        role: r.role,
        tier: r.tier,
        rationale: r.rationale,
        supporting_evidence: r.supportingEvidence,
        important_gaps: r.importantGaps,
        seniority_relation: r.seniorityRelation,
      }))
    );
  }

  console.log("Done. Candidate A seeded successfully.");
  console.log(`Total experience: ${derived.experienceBreakdown.totalYears}y`);
  console.log(`Needs domain confirmation: ${derived.experienceBreakdown.needsUserConfirmation}`);
  console.log(`Career strength: ${derived.strength.score}/95`);
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
