import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeEnterpriseAiJob } from "@/lib/enterpriseAiGateway";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { sourceType, rawText } = body;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ error: "Profile text cannot be empty." }, { status: 400 });
    }

    const extractionPrompt = `
Extract and normalize this candidate profile into structured JSON:
PROFILE DATA:
${rawText.slice(0, 15000)}

Return ONLY JSON:
{
  "fullName": "Candidate Name",
  "email": "email@domain.com or null",
  "location": "City, State or null",
  "totalTenureMonths": 120,
  "experience": [
    {
      "company": "Company Name",
      "position": "Title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "location": "City, State",
      "bullets": ["Action + outcome bullet..."]
    }
  ],
  "skills": {
    "coreTools": ["Tool1", "Tool2"],
    "methodologies": ["Method1"],
    "domainKnowledge": ["Domain1"],
    "certifications": ["Cert1"]
  },
  "education": [
    { "institution": "School Name", "degree": "Degree", "year": "YYYY" }
  ]
}
`;

    const rawJson = await executeEnterpriseAiJob({
      systemPrompt: "You are an executive talent parser. Return only valid JSON.",
      userPrompt: extractionPrompt,
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(rawJson);

    // 1. Upsert Profile
    await supabase.from("user_profiles").upsert({
      user_id: user.id,
      full_name: parsed.fullName,
      location: parsed.location,
      total_tenure_months: parsed.totalTenureMonths,
      profile_source: sourceType,
      updated_at: new Date().toISOString(),
    });

    // 2. Refresh Work History
    await supabase.from("work_experience").delete().eq("user_id", user.id);
    if (parsed.experience?.length) {
      const records = parsed.experience.map((exp: any) => ({
        user_id: user.id,
        company: exp.company,
        position: exp.position,
        start_date: exp.startDate,
        end_date: exp.endDate,
        location: exp.location,
        description: Array.isArray(exp.bullets) ? exp.bullets.join("\n") : exp.bullets,
      }));
      await supabase.from("work_experience").insert(records);
    }

    // 3. Refresh Skills
    await supabase.from("skills").delete().eq("user_id", user.id);
    const flattenedSkills: { user_id: string; skill_name: string; category: string }[] = [];
    Object.entries(parsed.skills || {}).forEach(([cat, list]: [string, any]) => {
      if (Array.isArray(list)) {
        list.forEach((s) => flattenedSkills.push({ user_id: user.id, skill_name: s, category: cat }));
      }
    });
    if (flattenedSkills.length) {
      await supabase.from("skills").insert(flattenedSkills);
    }

    return NextResponse.json({ success: true, profile: parsed });
  } catch (err: any) {
    console.error("Profile Ingestion Error:", err);
    return NextResponse.json({ error: err.message || "Failed to process profile" }, { status: 500 });
  }
}
