import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeEnterpriseAiJob } from "@/lib/enterpriseAiGateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobTitle, jobDescription, requiredSkills } = await req.json();

    const [{ data: workHistory }, { data: userSkills }] = await Promise.all([
      supabase.from("work_experience").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
      supabase.from("skills").select("skill_name, category").eq("user_id", user.id),
    ]);

    const prompt = `
You are an executive resume writer and ATS optimization engine.
Analyze the target job description and align the candidate's verified background.

STRICT WRITING RULES:
1. ZERO HALLUCINATION: Never invent companies, tools, dates, or metrics not present in the candidate profile.
2. HUMAN-CONVERTING BULLET FORMULA: Every bullet MUST follow this formula:
   [Strong Action Verb] + [Specific Problem/Project Scope] + [Tools/Mechanism Used] + [Quantified Business/Technical Impact].
3. NO AI CLICHÉS: Banned phrases include "spearheaded cross-functional initiatives", "leveraged cutting-edge solutions", and "responsible for".
4. DUAL NOTATION: For technical acronyms (e.g., ETL, AWS, ATS, CI/CD), provide both the full name and abbreviation.
5. CONTEXTUAL REORDERING: Place bullets demonstrating the target job's mandatory technical stack at index 0 and 1.

Target Role: ${jobTitle}
Target Stack: ${JSON.stringify(requiredSkills || [])}
Job Context: ${(jobDescription || "").slice(0, 3000)}

Candidate History:
- Verified Skills: ${JSON.stringify(userSkills || [])}
- Work History: ${JSON.stringify(workHistory || [])}

Return valid JSON:
{
  "summary": "3-line executive profile targeting ${jobTitle} highlighting verified tenure and key achievements. No first-person pronouns.",
  "coreCompetencies": [
    { "category": "Platforms & Core Tools", "skills": ["Tool 1", "Tool 2"] },
    { "category": "Methodologies & Pipelines", "skills": ["Method 1", "Method 2"] }
  ],
  "tailoredExperience": [
    {
      "company": "Company Name",
      "position": "Targeted/Verified Position",
      "period": "Start - End Date",
      "location": "City, State / Remote",
      "alignedBullets": [
        "Action + context + tool + metric bullet..."
      ]
    }
  ]
}
`;

    const rawJson = await executeEnterpriseAiJob({
      systemPrompt: "You are an ATS compliance compiler. Return only verifiable, valid JSON.",
      userPrompt: prompt,
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(rawJson);

    return NextResponse.json({ success: true, resume: parsed });
  } catch (err: any) {
    console.error("Resume tailoring error:", err);
    return NextResponse.json({ error: err.message || "Failed to tailor resume" }, { status: 500 });
  }
}
