export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "build-key-fallback" });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobUrl, rawJobText } = await req.json();
    if (!rawJobText && !jobUrl) {
      return NextResponse.json({ error: "Provide either job text or a job posting URL" }, { status: 400 });
    }

    let textToAnalyze = rawJobText || "";
    if (jobUrl && !rawJobText) {
      try {
        const res = await fetch(jobUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        textToAnalyze = await res.text();
      } catch (err) {
        textToAnalyze = `Job reference URL: ${jobUrl}`;
      }
    }

    const parsePrompt = `
Analyze this external job vacancy text and extract required parameters.
TEXT:
${textToAnalyze.slice(0, 8000)}

Return JSON:
{
  "company": "Company Name",
  "title": "Clean Role Title",
  "location": "City, State or Remote",
  "workMode": "remote" | "hybrid" | "onsite",
  "salaryFloor": 120000,
  "salaryCeiling": 150000,
  "requiredSkills": ["Skill 1", "Skill 2", "Skill 3"]
}
`;

    const aiRes = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: parsePrompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(aiRes.text || "{}");

    // Fetch user skills to compute match fit
    const { data: userSkills } = await supabase.from("skills").select("skill_name").eq("user_id", user.id);
    const candidateSkills = (userSkills || []).map((s) => s.skill_name.toLowerCase());
    const requiredSkills: string[] = parsed.requiredSkills || [];

    const overlap = requiredSkills.filter((s) => candidateSkills.includes(s.toLowerCase()));
    const matchScore = requiredSkills.length > 0 ? Math.round((overlap.length / requiredSkills.length) * 100) : 75;

    // Persist to clipped jobs
    const { data: clippedJob, error } = await supabase
      .from("user_clipped_jobs")
      .insert({
        user_id: user.id,
        job_url: jobUrl || null,
        raw_job_text: textToAnalyze.slice(0, 4000),
        parsed_company: parsed.company || "External Employer",
        parsed_title: parsed.title || "Target Position",
        parsed_location: parsed.location || "Unspecified",
        parsed_salary: parsed.salaryCeiling ? `$${Math.round(parsed.salaryCeiling / 1000)}k` : "Disclosed on Apply",
        parsed_skills: parsed.requiredSkills || [],
        match_score: matchScore,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, job: clippedJob });
  } catch (err: any) {
    console.error("Job clip error:", err);
    return NextResponse.json({ error: err.message || "Failed to parse job" }, { status: 500 });
  }
}
