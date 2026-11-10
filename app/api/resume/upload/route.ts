export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { detectFormatFromFilename, extractResumeText } from "@/lib/parsing/extractText";
import { extractProfileFromText } from "@/lib/profileAI";
import { recomputeDerivedProfile } from "@/lib/recompute";
import { NextRequest, NextResponse } from "next/server";

function toSqlDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (/present|current|now/i.test(str)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}$/.test(str)) return `${str}-01`;
  if (/^\d{4}$/.test(str)) return `${str}-01-01`;

  const parsed = new Date(str);
  return !isNaN(parsed.getTime()) ? parsed.toISOString().split("T")[0] : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const format = detectFormatFromFilename(file.name) || "txt";
  const buffer = Buffer.from(await file.arrayBuffer());

  let extracted: any;
  try {
    extracted = await extractResumeText(buffer, format);
  } catch {
    return NextResponse.json(
      { error: "Could not read that file. Please verify it is not corrupted." },
      { status: 422 }
    );
  }

  const rawResumeText = String(extracted?.rawText ?? extracted?.text ?? "").trim();
  if (rawResumeText.length === 0) {
    return NextResponse.json(
      { error: "No readable text found in this file." },
      { status: 422 }
    );
  }

  const compressedText = rawResumeText
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`;

  const storageUploadTask = supabase.storage
    .from("resumes")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    })
    .catch((err) => console.warn("[Storage] Non-critical upload bypass:", err));

  const deactivateTask = supabase
    .from("resumes")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const insertResumeTask = supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      filename: file.name,
      storage_path: storagePath,
      format: format,
      raw_text: rawResumeText,
      is_active: true,
    })
    .select("id")
    .single();

  const aiExtractionTask = extractProfileFromText(compressedText);

  const [, , resumeInsertRes, extractedProfile] = await Promise.all([
    storageUploadTask,
    deactivateTask,
    insertResumeTask,
    aiExtractionTask,
  ]);

  if (resumeInsertRes.error || !resumeInsertRes.data) {
    return NextResponse.json(
      { error: "Database error creating resume: " + resumeInsertRes.error?.message },
      { status: 500 }
    );
  }

  const resumeId = resumeInsertRes.data.id;

  // recomputeDerivedProfile expects 4 arguments: workExperience, skills, education, confirmedDomain
  const derived = recomputeDerivedProfile(
    extractedProfile.workExperience as any,
    extractedProfile.skills as any,
    extractedProfile.education as any,
    null
  );

  const rawScore = Number(derived?.strength?.score) || 0;
  const clampedScore = Math.max(0, Math.min(95, Math.round(rawScore)));

  // Execute database writes using Promise.resolve() for Postgrest compatibility
  const workInsert = extractedProfile.workExperience?.length > 0
    ? supabase.from("work_experience").insert(
        extractedProfile.workExperience.map((w: any) => ({
          user_id: user.id,
          resume_id: resumeId,
          job_title: w.jobTitle,
          employer: w.employer,
          start_date: toSqlDate(w.period?.startDate),
          end_date: toSqlDate(w.period?.endDate),
          is_current: Boolean(w.period?.isCurrent),
          responsibilities: w.responsibilities ?? [],
          achievements: w.achievements ?? [],
          technologies: w.technologies ?? [],
          employment_type: w.employmentType ?? "full-time",
          leadership_evidence: w.leadershipEvidence ?? [],
          source: "extracted",
          needs_review: Boolean(w.needsReview),
        }))
      )
    : Promise.resolve();

  const educationInsert = extractedProfile.education?.length > 0
    ? supabase.from("education").insert(
        extractedProfile.education.map((e: any) => ({
          user_id: user.id,
          institution: e.institution,
          credential: e.credential,
          field: e.field ?? null,
          graduation_date: toSqlDate(e.graduationDate),
          source: "extracted",
        }))
      )
    : Promise.resolve();

  const skillsInsert = extractedProfile.skills?.length > 0
    ? supabase.from("skills").insert(
        extractedProfile.skills.map((s: any) => ({
          user_id: user.id,
          skill_name: s.skillName,
          confidence: s.confidence ?? "Medium",
          source: "extracted",
          evidence_role_ids: s.sourceRoleIds ?? [],
        }))
      )
    : Promise.resolve();

  const snapshotInsert = supabase.from("career_strength_snapshots").insert({
    user_id: user.id,
    score: clampedScore,
    breakdown: derived?.strength?.breakdown ?? {},
    strengths: derived?.strength?.strengths ?? [],
    gaps: derived?.gaps ?? [],
    reasoning: derived?.strength?.reasoning ?? [],
    computed_at: new Date().toISOString(),
  });

  await Promise.all([
    Promise.resolve(workInsert),
    Promise.resolve(educationInsert),
    Promise.resolve(skillsInsert),
    Promise.resolve(snapshotInsert),
  ]);

  return NextResponse.json({
    success: true,
    resumeId,
    redirectUrl: "/profile/review",
  });
}
