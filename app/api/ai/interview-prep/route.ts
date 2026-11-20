import { logApiUsage } from "@/lib/usageTelemetry";
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

    const { jobId, jobTitle, jobDescription, matchedSkills } = await req.json();

    const { data: workRecords } = await supabase
      .from("work_experience")
      .select("company, position, description")
      .eq("user_id", user.id);

    const prompt = `
You are an enterprise technical screening interviewer.
Target Role: ${jobTitle}
Key Technical Stack: ${JSON.stringify(matchedSkills || [])}
Job Description Context: ${(jobDescription || "").slice(0, 1500)}
Candidate Work Profile: ${JSON.stringify(workRecords || [])}

Generate the 5 most probable technical screening questions for this role and provide bullet points using the STAR method (Situation, Task, Action, Result) grounded strictly in the candidate's real work history.

Return JSON adhering to:
{
  "questions": [
    {
      "question": "Question text",
      "focusSkill": "e.g., Snowflake Clustering",
      "starFramework": {
        "situation": "Context from history",
        "task": "Problem to solve",
        "action": "Technical actions taken",
        "result": "Measured business/infrastructure outcome"
      }
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(response.text || "{}");

    await supabase.from("ai_career_artifacts").insert({
      user_id: user.id,
      job_id: jobId || null,
      artifact_type: "interview_prep",
      generated_content: parsed,
      model_version: "gemini-3.8-flash",
    });

    return NextResponse.json({ success: true, prep: parsed });
  } catch (err: any) {
    console.error("Interview Prep AI Error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate interview prep" }, { status: 500 });
  }
}
