import { NextResponse } from "next/server";
import { executeEnterpriseAiJob } from "@/lib/enterpriseAiGateway";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON request payload." }, { status: 400 });
    }

    const { jobTitle, company, hiringManager, jobDescription, candidateSummary, masterSkills } = body;

    if (!jobTitle || !company) {
      return NextResponse.json(
        { error: "jobTitle and company are required fields." },
        { status: 400 }
      );
    }

    const cleanJobDesc = (jobDescription || "").slice(0, 8000);
    const cleanSummary = (candidateSummary || "").slice(0, 4000);

    const systemPrompt = `You are a Principal Executive Recruiter and Outreach Strategist.
Generate high-conversion outreach for LinkedIn that avoids spammy AI phrasing.

CONSTRAINTS:
1. CONNECTION NOTE (STRICT 300 CHARACTERS MAX): Must fit LinkedIn's free invitation connection limit. Count characters carefully. State a specific shared domain or technical overlap.
2. FULL INMAIL (100-160 WORDS): High-impact message for recruiters or hiring managers. Start with a direct hook about their team's domain, highlight 2 concrete quantified metrics (e.g., query optimization, revenue protection, ETL scale), and close with a low-friction question.
3. ZERO HALLUCINATION: Ground claims strictly in the candidate's actual data engineering and analytics experience.
4. PURE JSON ONLY: Respond strictly with valid JSON. No markdown code blocks, backticks, or preamble.`;

    const userPrompt = `TARGET OPPORTUNITY:
- Role: ${jobTitle}
- Company: ${company}
- Recipient / Hiring Lead: ${hiringManager || "Hiring Team"}
- Job Overview: ${cleanJobDesc || "Enterprise data platform engineering & analytics"}

CANDIDATE PROFILE:
- Experience Overview: ${cleanSummary || "Lead Data Analytics Engineer with 12+ years in Snowflake, SQL, dbt, Python, and enterprise logistics/fintech."}
- Core Skills: ${Array.isArray(masterSkills) ? masterSkills.join(", ") : masterSkills || "Snowflake, SQL, Python, dbt, Tableau, Power BI"}

Return JSON strictly matching this structure:
{
  "connectionNote": "Personalized LinkedIn connection message strictly under 280 characters.",
  "subjectLine": "5-8 word punchy InMail subject line",
  "inMailBody": "Dear [Name], 3 concise paragraphs (Hook -> Proof Points -> Low-friction CTA).",
  "strategicTalkingPoints": [
    "Talking point 1 highlighting relevant match",
    "Talking point 2 highlighting quantified achievement"
  ]
}`;

    const rawResponse = await executeEnterpriseAiJob({
      systemPrompt,
      userPrompt,
      responseMimeType: "application/json",
    });

    const sanitizedJson = rawResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsedData = JSON.parse(sanitizedJson);

    // Hard safeguard for LinkedIn 300-char connection limits
    if (parsedData.connectionNote && parsedData.connectionNote.length > 295) {
      parsedData.connectionNote = parsedData.connectionNote.slice(0, 292).trim() + "...";
    }

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("[InMail API Failure]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate outreach materials" },
      { status: 500 }
    );
  }
}
