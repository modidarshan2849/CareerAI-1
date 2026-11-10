import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeEnterpriseAiJob } from "@/lib/enterpriseAiGateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobTitle, companyName, keySkills } = await req.json();

    const { data: workRecords } = await supabase
      .from("work_experience")
      .select("company, position, description")
      .eq("user_id", user.id)
      .limit(2);

    const prompt = `
Write a high-converting, punchy 65-75 word LinkedIn InMail to the hiring manager for this role.
Target Role: ${jobTitle} at ${companyName}
Required Core Skills: ${JSON.stringify(keySkills || [])}
Candidate Verified Background: ${JSON.stringify(workRecords || [])}

Strict Rules:
1. No generic pleasantries ("Hope this finds you well").
2. State the target role directly in line 1.
3. Highlight 1 specific verified achievement with a quantified outcome and tool.
4. Conclude with a direct call to action regarding the submitted application.
5. Max length: 75 words.
`;

    const text = await executeEnterpriseAiJob({
      systemPrompt: "You are an executive talent strategist drafting high-response direct recruiter outreach.",
      userPrompt: prompt,
    });

    return NextResponse.json({ message: text.trim() });
  } catch (err: any) {
    console.error("Outreach generation error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate outreach" }, { status: 500 });
  }
}
