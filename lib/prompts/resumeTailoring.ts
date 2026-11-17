export interface TailorInput {
  masterResume: string;
  targetJobDescription: string;
}

export function buildResumeTailorPrompt(input: TailorInput) {
  const systemPrompt = `You are a Principal Executive Technical Resume Architect and Enterprise ATS Optimization Engine.
Generate an exhaustive, high-impact ATS resume JSON strictly grounded in the candidate's actual experience.

STRICT OPERATIONAL DIRECTIVES:
1. ROLE & TITLE EXTRACTION:
   - Extract the candidate's professional functional title (e.g., "Senior Data Analyst II", "Lead Data Analyst", "Data Analyst & Integration Specialist").
   - NEVER mislabel software or project systems (like "Resident 360") as a job title.
2. LOCATION INTEGRITY:
   - Preserve physical locations as stated in the master profile (e.g., "Ahmedabad, India" for university; "Virginia Beach, VA", "London, UK", "Annapolis, MD" for employers).
   - NEVER mark educational institutions as "Remote".
3. WORK EXPERIENCE BULLET DEPTH (EXACTLY 3-4 BULLETS PER ROLE):
   - Every single role MUST contain 3 to 4 dense, technical bullets using active verbs ("Architected...", "Refactored...", "Automated...", "Optimized...").
   - BANNED: Never write boilerplate phrasing like "by doing optimization of...".
4. KEY PROJECTS RIGOR & ANTI-REPETITION (CRITICAL):
   - BANNED CIRCULAR COPY: NEVER repeat the project name or the tech stack inside the description. (e.g., DO NOT write "Python/SQL transaction parsing engine..." when Python and SQL are already listed under technologies).
   - BANNED FLUFF: Strictly eliminate vague marketing copy like "providing real-time insights into sales performance and revenue growth".
   - REQUIRED: State the architectural challenge, engineering solution, and quantifiable outcome (e.g., data throughput, transaction scale, audit accuracy, rebate recovery dollars, latency reduction).
5. ZERO ACRONYM EXPANSION:
   - Use standard industry keywords directly: "SQL", "dbt", "Snowflake", "Python", "Tableau", "Power BI", "ETL", "ELT". Never expand to "Structured Query Language (SQL)".
6. OUTPUT FORMAT:
   - Output ONLY raw, parseable JSON conforming to the schema. No markdown fences, backticks, or meta-commentary.`;

  const userPrompt = `TARGET JOB SPECIFICATION:
${input.targetJobDescription}

CANDIDATE MASTER EXPERIENCE:
${input.masterResume}

Generate the final ATS-optimized JSON using this structure:
{
  "summary": "3-4 sentence executive narrative emphasizing career tenure (12+ years), core data engineering/BI stack, and enterprise business impact.",
  "coreCompetencies": [
    {
      "category": "Cloud Warehousing & Architecture",
      "skills": ["Snowflake", "Dimensional Modeling", "Data Marts", "Data Governance", "AWS"]
    },
    {
      "category": "Data Pipelines & Engineering",
      "skills": ["SQL", "Python", "dbt", "ETL/ELT Pipelines", "Automated Validation"]
    },
    {
      "category": "Business Intelligence & Visualization",
      "skills": ["Tableau", "Power BI", "Qlik Sense", "Executive KPI Dashboards", "Operational Analytics"]
    }
  ],
  "tailoredExperience": [
    {
      "company": "Exact Company Name",
      "position": "Accurate Professional Job Title",
      "period": "Start Date - End Date (or Present)",
      "location": "City, State / Country",
      "alignedBullets": [
        "Strong action verb + quantified impact + technical stack implementation...",
        "Strong action verb + quantified impact + technical stack implementation...",
        "Strong action verb + quantified impact + technical stack implementation..."
      ]
    }
  ],
  "projects": [
    {
      "name": "Exact Technical Project Title",
      "technologies": ["Tech1", "Tech2", "Tech3"],
      "description": "Architectural implementation detailing pipeline throughput, automation mechanism, and verified business/financial return without repeating technologies."
    }
  ],
  "education": [
    {
      "institution": "Institution Name",
      "degree": "Degree Title",
      "fieldOfStudy": "Field of Study",
      "location": "City, Country"
    }
  ]
}`;

  return { systemPrompt, userPrompt };
}
