"use client";

import React, { useEffect, useMemo, useState } from "react";

export interface JobRecord {
  id: string;
  req_id?: string | null;
  title: string;
  company: string;
  location?: string | null;
  url: string;
  score?: number | null;
  is_remote?: boolean | null;
  miles_from_home?: number | null;
  work_mode?: string | null;
  zone?: string | null;
  sponsorship_status?: string | null;
  sponsorship_code?: string | null;
  posted_label?: string | null;
  posted_at?: string | null;
  last_date?: string | null;
  last_verified_at?: string | null;
  created_at?: string | null;
  keywords?: string[] | null;
  salary_range?: string | null;
  source?: string | null;
  description?: string | null;
  is_active?: boolean | null;
}

export interface HistoryEntry {
  id: string;
  company: string;
  title: string;
  reqId?: string | null;
  location?: string | null;
  workMode?: string | null;
  workStatus?: string | null;
  url: string;
  status: "APPLIED" | "VIEWED";
  timestamp: string;
}

export interface ResumeExperienceRole {
  title: string;
  org: string;
  period: string;
  bullets: string[];
}

export interface AttachedResumeMeta {
  fileName: string;
  fileSizeKb: number;
  uploadedDate: string;
  extractedPreview?: string;
}

interface Props {
  initialJobs: JobRecord[];
}

export type WorkStatusKey = "GC_OR_CITIZEN_REQ" | "NOT_SPECIFIED";
type TopView = "ROLE_COMMAND" | "HISTORY" | "PREFERENCES" | "PROFILE";

const TARGET_STACK = [
  { key: "sql", label: "SQL", weight: 4 },
  { key: "snowflake", label: "Snowflake", weight: 4 },
  { key: "python", label: "Python", weight: 3 },
  { key: "etl", label: "ETL / ELT", weight: 3 },
  { key: "data warehouse", label: "Data Warehouse", weight: 3 },
  { key: "finance", label: "Finance Data Marts", weight: 3 },
  { key: "tableau", label: "Tableau", weight: 2 },
  { key: "power bi", label: "Power BI", weight: 2 },
  { key: "dbt", label: "dbt", weight: 2 },
  { key: "analytics", label: "Analytics", weight: 2 }
];

const ATS_CHECK_TERMS = [
  "SQL",
  "Snowflake",
  "Python",
  "ETL",
  "Data Warehouse",
  "Data Mart",
  "Data Modeling",
  "Data Governance",
  "Data Quality",
  "Business Intelligence",
  "Tableau",
  "Power BI",
  "QlikView",
  "Qlik Sense",
  "KPI",
  "Reporting",
  "Stakeholder"
];

const GC_CITIZEN_REGEX =
  /\b(us citizen|u\.s\. citizen|united states citizen|united states citizenship|green card|permanent resident|lawful permanent|security clearance|secret clearance|top secret|ts\/sci|public trust|will not sponsor|does not sponsor|cannot sponsor|unable to sponsor|no visa sponsorship|without visa sponsorship|without sponsorship|not eligible for visa sponsorship|must be legally authorized.*without.*sponsorship)\b/i;

function formatUniformDate(input?: string | null, fallback = "Not Listed"): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(trimmed)) {
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    });
  }
  return trimmed;
}


const FORTUNE_500_PATTERNS = [
  /\b(performance food group|\bpfg\b|capital one|carmax|dominion energy|dollar tree|hilton|general dynamics|northrop grumman|booz allen|leidos|saic|altria|markel|norfolk southern|huntington ingalls|dxc technology|aes corp|\bnvr\b)\b/i,
  /\b(walmart|amazon|apple|microsoft|alphabet|google|meta platforms|facebook|berkshire hathaway|unitedhealth|optum|mckesson|cencora|amerisourcebergen|cardinal health|cvs health|aetna|cigna|elevance|anthem|humana|centene|molina)\b/i,
  /\b(jpmorgan|jp morgan|bank of america|wells fargo|citigroup|citi\b|goldman sachs|morgan stanley|american express|visa\b|mastercard|charles schwab|blackrock|state street|truist|pnc\b|u\.s\. bank|us bank|discover|synchrony|ally financial)\b/i,
  /\b(exxon|chevron|conocophillips|marathon petroleum|valero|phillips 66|duke energy|southern company|nextera|exelon|american electric power|sempra)\b/i,
  /\b(lockheed martin|boeing|\brtx\b|raytheon|honeywell|caterpillar|john deere|deere & company|general electric|\bge aerospace\b|3m\b|ford motor|general motors|tesla|paccar|cummins)\b/i,
  /\b(cisco|oracle|ibm\b|salesforce|intel\b|nvidia|amd\b|qualcomm|broadcom|texas instruments|adobe|servicenow|workday|intuit|paycom|adp\b|cognizant|accenture|hp inc|hewlett packard|dell technologies)\b/i,
  /\b(verizon|at&t|t-mobile|comcast|charter communications|walt disney|netflix|warner bros|paramount)\b/i,
  /\b(target|costco|home depot|lowe.s|walgreens|kroger|albertsons|best buy|tjx|ross stores|autozone|o.reilly|starbucks|mcdonald.s|yum! brands|marriott|delta air lines|united airlines|american airlines|southwest airlines|\bups\b|fedex)\b/i,
  /\b(procter & gamble|\bp&g\b|johnson & johnson|pfizer|merck|abbvie|bristol-myers|eli lilly|amgen|gilead|abbott|thermo fisher|danaher|medtronic|stryker|becton dickinson|pepsico|coca-cola|mondelez|kraft heinz|general mills|tyson foods|sysco|us foods)\b/i
];

function isFortune500Company(company?: string | null): boolean {
  const c = (company || "").trim();
  if (!c) return false;
  return FORTUNE_500_PATTERNS.some((re) => re.test(c));
}

function decodeAndFormatDescription(raw?: string | null): string[] {
  if (!raw) return [];
  const decoded = raw
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");

  const structured = decoded
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|h1|h2|h3|h4|tr)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*li\s*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  return structured
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

function extractJobDates(job: JobRecord): {
  postedDate: string;
  closingDate: string;
  verifiedDate: string;
} {
  const plainDesc = (job.description || "").replace(/<[^>]+>/g, " ");
  const descDateMatch = plainDesc.match(
    /(?:posted|date posted|published|closing|deadline|apply by)\s*:?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i
  );

  const posted =
    formatUniformDate(job.posted_label || job.posted_at || job.created_at || descDateMatch?.[1] || null, "Active Listing");
  const closing = formatUniformDate(job.last_date || null, "Open Until Filled");
  const verified = formatUniformDate(job.last_verified_at || job.created_at || null, "Nov 19, 2026");

  return { postedDate: posted, closingDate: closing, verifiedDate: verified };
}

function extractKeyHighlights(job: JobRecord): string[] {
  const text = `${job.title || ""} ${(job.description || "").replace(/<[^>]+>/g, " ")}`;
  const highlights: string[] = [];

  const techHits = [
    "SQL",
    "Snowflake",
    "Python",
    "dbt",
    "Tableau",
    "Power BI",
    "QlikView",
    "Qlik Sense",
    "ETL",
    "Data Warehouse"
  ].filter((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));

  if (techHits.length > 0) {
    highlights.push(`Stack: ${techHits.slice(0, 6).join(", ")}`);
  }

  const expMatch = text.match(/(\d+\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:experience|exp)[^.;\n]{0,70})/i);
  if (expMatch?.[1]) {
    highlights.push(`Experience: ${expMatch[1].trim()}`);
  }

  const eduMatch = text.match(/\b(bachelor'?s?|master'?s?|mba|b\.s\.|m\.s\.|degree)\s+(?:in\s+)?[a-z\s,&/]{3,40}/i);
  if (eduMatch?.[0]) {
    highlights.push(`Education: ${eduMatch[0].trim()}`);
  }

  return highlights.slice(0, 3);
}

function estimateMilesFromVirginiaBeach(job: JobRecord): { miles: number | null; label: string } {
  if (typeof job.miles_from_home === "number" && !Number.isNaN(job.miles_from_home)) {
    return {
      miles: job.miles_from_home,
      label: job.miles_from_home === 0 ? "Remote / 0 mi" : `~${Math.round(job.miles_from_home)} mi`
    };
  }

  const loc = `${job.location || ""} ${job.zone || ""} ${job.work_mode || ""}`.toLowerCase();
  if (job.is_remote || /\bremote\b/i.test(loc)) {
    return { miles: 0, label: "Remote (0 mi)" };
  }

  const cityTable: { re: RegExp; miles: number }[] = [
    { re: /\bvirginia beach\b/i, miles: 5 },
    { re: /\bnorfolk\b|\bchesapeake\b|\bportsmouth\b|\bhampton\b|\bnewport news\b/i, miles: 18 },
    { re: /\bwilliamsburg\b/i, miles: 48 },
    { re: /\brichmond\b|\bglen allen\b|\bhenrico\b|\bchesterfield\b/i, miles: 95 },
    { re: /\bcharlottesville\b/i, miles: 155 },
    { re: /\bfredericksburg\b/i, miles: 145 },
    { re: /\bwashington,?\s*dc\b|\barlington\b|\balexandria\b|\bfalls church\b/i, miles: 195 },
    { re: /\bmclean\b|\btysons\b|\breston\b|\bherndon\b|\bashburn\b|\bfairfax\b|\bdmv\b/i, miles: 205 },
    { re: /\bbaltimore\b|\bannapolis\b|\bbethesda\b|\bsilver spring\b|\bmaryland\b|\bmd\b/i, miles: 225 },
    { re: /\braleigh\b|\bdurham\b|\bcharlotte\b|\bnorth carolina\b|\bnc\b/i, miles: 185 }
  ];

  for (const entry of cityTable) {
    if (entry.re.test(loc)) {
      return { miles: entry.miles, label: `~${entry.miles} mi` };
    }
  }

  if (/\bvirginia\b|\bva\b/i.test(loc)) {
    return { miles: 110, label: "~110 mi (VA)" };
  }

  return { miles: null, label: "US / Non-Local" };
}

function resolveSalaryInfo(job: JobRecord): { label: string; minAnnual: number | null } {
  const direct = (job.salary_range || "").trim();
  const desc = (job.description || "").replace(/<[^>]+>/g, " ");
  const sourceStr =
    direct ||
    desc.match(/\$\s?\d{2,3}(?:,\d{3})?(?:\s?k)?\s*(?:-|to|–)\s*\$?\s?\d{2,3}(?:,\d{3})?(?:\s?k)?/i)?.[0] ||
    "";

  if (!sourceStr) {
    return { label: "Compensation Not Listed", minAnnual: null };
  }

  const nums = [...sourceStr.matchAll(/\$?\s*(\d{2,3})(?:,(\d{3}))?\s*(k)?/gi)].map((m) => {
    const base = Number(m[1]);
    const thousands = m[2] ? Number(m[2]) : 0;
    return m[2] ? base * 1000 + thousands : m[3] || base < 1000 ? base * 1000 : base;
  });

  const annualNums = nums.filter((n) => n >= 40000 && n <= 600000);
  const minAnnual = annualNums.length > 0 ? Math.min(...annualNums) : null;

  return {
    label: direct || sourceStr.trim(),
    minAnnual
  };
}

function getRoleTrack(title: string): "ANALYST" | "ENGINEER" | "BI" | "SCIENTIST" {
  const t = (title || "").toLowerCase();
  if (/\b(business intelligence|\bbi\b|power bi|tableau|reporting)\b/.test(t)) return "BI";
  if (/\b(data engineer|analytics engineer|data architect|data modeler|etl)\b/.test(t)) return "ENGINEER";
  if (/\b(data scientist|decision scien|machine learning|\bml\b|ai\b)\b/.test(t)) return "SCIENTIST";
  return "ANALYST";
}

function detectWorkStatus(job: JobRecord): WorkStatusKey {
  const code = (job.sponsorship_code || "").toUpperCase();
  const status = (job.sponsorship_status || "").trim();
  const combinedText = `${job.title || ""} ${status} ${job.description || ""} ${job.source || ""}`;

  if (
    code === "NO_SPONSORSHIP" ||
    /usajobs|federal/i.test(job.source || "") ||
    GC_CITIZEN_REGEX.test(combinedText)
  ) {
    return "GC_OR_CITIZEN_REQ";
  }
  return "NOT_SPECIFIED";
}

function workStatusDisplay(key: WorkStatusKey): string {
  if (key === "GC_OR_CITIZEN_REQ") return "Requires Green Card / Citizenship";
  return "Not Specified";
}

function formatReqBadge(reqId?: string | null): string | null {
  if (!reqId) return null;
  const clean = reqId.trim();
  if (!clean || /^(EXT|GJ|LI|LI-IDX|WD)$/i.test(clean)) return null;
  if (clean.length > 14) return `Req #${clean.slice(0, 10)}…`;
  return `Req #${clean}`;
}

function buildMasterProfileSuggestions(
  headline: string,
  skillsText: string,
  summaryText: string,
  rolesList: ResumeExperienceRole[],
  activeTitlesList: string[]
): string[] {
  const blob = `${headline} ${skillsText} ${summaryText} ${rolesList.map((r) => `${r.title} ${r.org}`).join(" ")}`.toLowerCase();
  const candidates: string[] = [];

  if (/analyst|analytics|sql/.test(blob)) {
    candidates.push("Senior Data Analyst", "Lead Data Analyst", "Principal Data Analyst");
  }
  if (/finance|mart|billing|revenue/.test(blob)) {
    candidates.push("Senior Finance Data Analyst", "Revenue & Billing Analytics Lead");
  }
  if (/warehouse|snowflake|etl|data engineering|mapping/.test(blob)) {
    candidates.push("Data Warehouse Analyst", "Senior ETL / Data Mapping Specialist", "Analytics Engineering Lead");
  }
  if (/tableau|power bi|qlik|bi\b|dashboard/.test(blob)) {
    candidates.push("Senior Business Intelligence Analyst", "BI & Reporting Lead");
  }
  if (/lead|team|coach|manage|mentor/.test(blob)) {
    candidates.push("Analytics Manager", "Data & Analytics Lead");
  }

  return Array.from(new Set(candidates)).filter(
    (c) => !activeTitlesList.some((act) => act.toLowerCase() === c.toLowerCase())
  );
}

function parseProfileFromUrlOrText(profileUrl: string, pastedText: string) {
  const combined = `${profileUrl} ${pastedText}`.trim();
  const skillsDetected = [
    "SQL",
    "Python",
    "R",
    "Snowflake",
    "Tableau",
    "Power BI",
    "QlikView",
    "Qlik Sense",
    "ETL Optimization",
    "Data Warehouse Design",
    "Data Mapping",
    "Finance Data Mart",
    "Data Governance"
  ].filter((sk) => new RegExp(`\\b${sk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(combined));

  let slugName: string | null = null;
  const liMatch = profileUrl.match(/linkedin\.com\/in\/([a-z0-9-]+)/i);
  if (liMatch?.[1]) {
    const rawSlug = liMatch[1].replace(/\d+$/, "").replace(/-/g, " ").trim();
    if (rawSlug.length > 2) {
      slugName = rawSlug
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  const lines = pastedText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    inferredName: slugName || lines[0] || null,
    inferredHeadline: lines.find((l) => /analyst|engineer|data|manager|lead|scientist/i.test(l) && l.length < 130) || null,
    inferredSummary: lines.length > 1 ? lines.slice(0, 4).join(" ").slice(0, 480) : null,
    skillsDetected
  };
}

function evaluateCandidateScore(job: JobRecord, profileSkillsLower: string[]) {
  const title = job.title || "";
  const fullText = `${title} ${job.description || ""} ${(job.keywords || []).join(" ")}`.toLowerCase();
  const track = getRoleTrack(title);

  const trackPts = track === "ANALYST" ? 94 : track === "BI" || track === "ENGINEER" ? 88 : 78;
  const matched = TARGET_STACK.filter((s) => fullText.includes(s.key) || profileSkillsLower.includes(s.key));
  const skillMatchPct = Math.min(100, Math.max(45, 50 + matched.length * 10));

  const distInfo = estimateMilesFromVirginiaBeach(job);
  const locText = `${job.zone || ""} ${job.location || ""} ${job.work_mode || ""}`.toLowerCase();
  const isVA = /virginia|\bva\b|dmv|richmond|mclean|arlington|reston|norfolk|virginia beach|dc|maryland/i.test(locText);
  const isRemote = Boolean(job.is_remote) || /remote/i.test(locText);
  const geoMatchPct = isVA ? 98 : isRemote ? 94 : 68;

  let score = 60;
  const factors: { label: string; delta: string; positive: boolean }[] = [];

  if (track === "ANALYST") {
    score += 14;
    factors.push({ label: "Core Data / Analytics track", delta: "+14", positive: true });
  } else if (track === "BI" || track === "ENGINEER") {
    score += 11;
    factors.push({ label: "Adjacent BI / Data Engineering track", delta: "+11", positive: true });
  } else {
    score += 6;
    factors.push({ label: "Data Science / ML specialization", delta: "+6", positive: true });
  }

  if (/\b(senior|sr\.?|lead|principal)\b/i.test(title)) {
    score += 8;
    factors.push({ label: "Senior / Lead level match", delta: "+8", positive: true });
  } else if (/\b(manager|architect|staff)\b/i.test(title)) {
    score += 6;
    factors.push({ label: "Staff / Architect / Manager scope", delta: "+6", positive: true });
  } else {
    score += 3;
    factors.push({ label: "Mid-level analytics scope", delta: "+3", positive: true });
  }

  const stackPts = Math.min(10, matched.reduce((sum, s) => sum + s.weight, 0));
  if (stackPts > 0) {
    score += stackPts;
    factors.push({
      label: `Stack: ${matched.slice(0, 4).map((m) => m.label).join(", ")}`,
      delta: `+${stackPts}`,
      positive: true
    });
  }

  if (isVA) {
    score += 5;
    factors.push({ label: `VA / DMV corridor (${distInfo.label})`, delta: "+5", positive: true });
  } else if (isRemote) {
    score += 4;
    factors.push({ label: "US Remote eligible", delta: "+4", positive: true });
  } else {
    score -= 5;
    factors.push({ label: `Outside VA / Non-Remote (${distInfo.label})`, delta: "-5", positive: false });
  }

  const workStatus = detectWorkStatus(job);
  if (workStatus === "GC_OR_CITIZEN_REQ") {
    factors.push({ label: "Requires Green Card / Citizenship", delta: "Note", positive: false });
  } else {
    factors.push({ label: "Work status: Not Specified", delta: "0", positive: true });
  }

  const salaryInfo = resolveSalaryInfo(job);
  const datesInfo = extractJobDates(job);
  const highlights = extractKeyHighlights(job);
  const isFortune500 = isFortune500Company(job.company);
  const finalScore = Math.max(55, Math.min(98, score));

  return {
    score: finalScore,
    isFortune500,
    track,
    trackPts,
    skillMatchPct,
    geoMatchPct,
    miles: distInfo.miles,
    distanceLabel: distInfo.label,
    factors,
    workStatus,
    workStatusText: workStatusDisplay(workStatus),
    salaryLabel: salaryInfo.label,
    minSalaryAnnual: salaryInfo.minAnnual,
    dates: datesInfo,
    highlights,
    formattedBlocks: decodeAndFormatDescription(job.description)
  };
}

const DEFAULT_ROLES: ResumeExperienceRole[] = [
  {
    title: "Sr Data Analyst II",
    org: "Performance Food Group (PFG) • Richmond, Virginia",
    period: "Feb 2025 - Present",
    bullets: [
      "Led end-to-end development and delivery of a Finance Data Mart, designing and implementing a scalable data repository to centralize financial reporting across business units, significantly improving data accessibility and reporting efficiency.",
      "Designed and maintained Power BI dashboards and Tableau reports to track KPIs across supply chain, sales, finance, and operations, enabling executives to make informed real-time decisions.",
      "Extracted, cleaned, and transformed large datasets using SQL, Python, and ETL tools, resulting in a 25% reduction in data processing time.",
      "Developed predictive models and trend analyses to forecast customer demand, identify sales opportunities, mitigate inventory risks, and support pricing optimization and market expansion.",
      "Implemented data validation processes, QA checks, and data governance standards across internal reporting systems while mentoring junior analysts on analytical standards and documentation."
    ]
  },
  {
    title: "Senior Data Analyst",
    org: "Codemax Consulting LLC (Contracted to Maryland MDThink, Department of Health Services)",
    period: "Dec 2023 - Feb 2025",
    bullets: [
      "Developed and executed comprehensive monitoring strategies and data repositories ensuring accuracy and efficiency across enterprise-wide data pipelines.",
      "Conducted detailed data mapping and source-to-target analysis to align systems and validate transformation logic, resolving inconsistencies and improving data flow by 40%.",
      "Designed and implemented data warehouse schema optimizations that enhanced query performance by 50%, and built SQL reporting tools automating complex workflows to reduce manual effort by 30%.",
      "Developed Tableau KPI dashboards, led root-cause analysis on data discrepancies, and strengthened data governance frameworks for regulatory compliance."
    ]
  },
  {
    title: "Lead Data Analyst",
    org: "Royal Mail Group Ltd. • London, United Kingdom",
    period: "May 2016 - Nov 2023",
    bullets: [
      "Phase 1 (May 2016 - Nov 2020): Analyzed Mailmark barcode scan and operational datasets across millions of mail items per period, built automated Excel VBA and reporting tools, and supported revenue protection, billing compliance, and Finance/Operations leadership.",
      "Phase 2 (Dec 2020 - Nov 2023): Served as Subject Matter Expert for Events-Based Billing (EBB), designed a customer transition database, and led and mentored a team of ~20 data analysts across prioritization, QA, and performance management.",
      "Developed enterprise QlikView and Qlik Sense dashboards and revenue-leakage methodologies driving $30M in revenue growth while managing billing escalations and data integration pipelines."
    ]
  },
  {
    title: "Mailmark Reporting Analyst",
    org: "Royal Mail Group Ltd. • London, United Kingdom",
    period: "Jun 2014 - May 2016",
    bullets: [
      "Developed ad-hoc analytical reports for Network Access Carriers, automated CMT file conversion into finance and customer logs via Excel Macros, determined billing adjustments for non-compliant items, and surfaced Mail Centre operational issues."
    ]
  },
  {
    title: "Downstream Access Central Control (DSACC) Admin",
    org: "Royal Mail Group Ltd. • London, United Kingdom",
    period: "Dec 2013 - May 2014",
    bullets: [
      "Analyzed Dockethub operational datasets, built Excel/VBA macros for DSACC Ineligible Items and RM Sampling reporting, and supported Downstream Access and plant operations."
    ]
  },
  {
    title: "Operational Staff / Work Place Coach",
    org: "Royal Mail Group Ltd. • London, United Kingdom",
    period: "Nov 2011 - Nov 2013",
    bullets: [
      "Supported front-line postal processing and delivery operations, coached and trained staff on quality initiatives, and managed resources against mail traffic SLAs."
    ]
  },
  {
    title: "Team Coach",
    org: "EDF Energy • United Kingdom",
    period: "Jul 2005 - Nov 2011",
    bullets: [
      "Analyzed team performance reports using Microsoft Excel and SAP Business Objects, built SQL reporting solutions for real-time monitoring, and coached/recruited team members against targets."
    ]
  }
];

export default function EnterpriseJobsDashboard({ initialJobs }: Props) {
  const [topView, setTopView] = useState<TopView>("ROLE_COMMAND");
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  const [search, setSearch] = useState<string>("");
  const [titleQuery, setTitleQuery] = useState<string>("");
  const [zone, setZone] = useState<"ALL" | "VA_DMV" | "REMOTE">("ALL");
  const [trackFilter, setTrackFilter] = useState<"ALL" | "ANALYST" | "ENGINEER" | "BI" | "SCIENTIST">("ALL");
  const [workMode, setWorkMode] = useState<"ALL" | "Remote" | "Hybrid">("ALL");
  const [workStatus, setWorkStatus] = useState<"ALL" | WorkStatusKey>("ALL");
  const [minScore, setMinScore] = useState<number>(0);
  const [fortune500Only, setFortune500Only] = useState<boolean>(false);
  const [minSalaryFloor, setMinSalaryFloor] = useState<number>(0);
  const [maxMiles, setMaxMiles] = useState<number>(0);

  // Target titles in Preferences + staged removals when clicking green active buttons
  const [targetTitlesText, setTargetTitlesText] = useState<string>("");
  const [pendingRemovalTitles, setPendingRemovalTitles] = useState<string[]>([]);

  const [hideApplied, setHideApplied] = useState<boolean>(false);
  const [appliedMap, setAppliedMap] = useState<Record<string, boolean>>({});
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [candidateName, setCandidateName] = useState<string>("Darshan Modi");
  const [candidateHeadline, setCandidateHeadline] = useState<string>(
    "Senior Data Analyst | SQL, Python, R, Snowflake, Tableau, Power BI, QlikView/Qlik Sense & Finance Data Marts"
  );
  const [candidateContact, setCandidateContact] = useState<string>(
    "Virginia Beach, VA • 757-502-9173 • modi.darshan268@gmail.com • linkedin.com/in/modidarshan268 • Eligible to work in the US"
  );
  const [socialProfileUrl, setSocialProfileUrl] = useState<string>("https://www.linkedin.com/in/modidarshan268");
  const [profileImportText, setProfileImportText] = useState<string>("");
  const [profileSkillsText, setProfileSkillsText] = useState<string>(
    "SQL, Python, R, Tableau, Power BI, QlikView, Qlik Sense, Excel VBA, SAP Business Objects, ETL Optimization, Data Warehouse Design, Data Mapping, Finance Data Mart, EBB Methodology, Data Governance"
  );
  const [attachedResume, setAttachedResume] = useState<AttachedResumeMeta | null>(null);
  const [validationMessage, setValidationMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [executiveSummary, setExecutiveSummary] = useState<string>(
    "Senior Data Analyst with 15+ years of progressive experience in data analytics, business intelligence, revenue protection, and team leadership across the United Kingdom and United States. Proven expertise building scalable data repositories, finance data marts, and KPI reporting frameworks in SQL, Python, R, Tableau, Power BI, QlikView, and Qlik Sense, with deep end-to-end data mapping, source-to-target analysis, ETL optimization, and data warehouse architecture. Experienced leading cross-functional teams (~20 analysts) and serving as Subject Matter Expert for Events-Based Billing (EBB) across corporate, public-sector, and large-scale operational environments."
  );

  const [roles, setRoles] = useState<ResumeExperienceRole[]>(DEFAULT_ROLES);

  const [educationAndCerts, setEducationAndCerts] = useState<string[]>([
    "Bachelor of Computer Application (BCA) — Gujarat University, Ahmedabad, India (2000-2003): Specialized in Programming Languages, Database Management Systems, Data Analysis, and Business Intelligence.",
    "Certifications: Advanced Excel Certification (eLearning), Data Visualization with Power BI (LinkedIn Learning), Advanced SQL Certification (Gujarat University)."
  ]);

  const [awardsAndImpact, setAwardsAndImpact] = useState<string[]>([
    "Drove $30M in revenue growth through strategic data insights and QlikView/Qlik Sense enterprise dashboards at Royal Mail Group.",
    "Reduced data processing time by 25% at Performance Food Group through SQL, Python, and ETL improvements.",
    "Improved data flow by 40% via source-to-target mapping and enhanced query performance by 50% via data warehouse optimization on Maryland State engagement."
  ]);

  const recordHistory = (job: JobRecord, status: "APPLIED" | "VIEWED", workStatusText?: string) => {
    setHistoryLog((prev) => {
      const existing = prev.find((h) => h.id === job.id);
      const formattedTs = formatUniformDate(new Date().toISOString());
      const entry: HistoryEntry = {
        id: job.id,
        company: job.company || "Employer",
        title: job.title || "Role",
        reqId: job.req_id ?? null,
        location: job.location ?? "United States",
        workMode: job.work_mode || (job.is_remote ? "Remote" : "Hybrid"),
        workStatus: workStatusText || workStatusDisplay(detectWorkStatus(job)),
        url: job.url || "#",
        status: status === "APPLIED" || existing?.status === "APPLIED" ? "APPLIED" : "VIEWED",
        timestamp: formattedTs
      };
      const filteredPrev = prev.filter((h) => h.id !== job.id);
      const next = [entry, ...filteredPrev].slice(0, 200);
      try {
        localStorage.setItem("careerai_history_v27", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && resumeModalOpen) {
        setResumeModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resumeModalOpen]);

  useEffect(() => {
    try {
      const savedApplied = localStorage.getItem("careerai_applied_v27");
      if (savedApplied) setAppliedMap(JSON.parse(savedApplied));

      const savedHistory = localStorage.getItem("careerai_history_v27");
      if (savedHistory) {
        const parsedHist = JSON.parse(savedHistory);
        if (Array.isArray(parsedHist)) setHistoryLog(parsedHist);
      }

      const savedPrefs = localStorage.getItem("careerai_prefs_v31");
      if (savedPrefs) {
        const p = JSON.parse(savedPrefs);
        if (p.zone) setZone(p.zone);
        if (p.workMode) setWorkMode(p.workMode);
        if (p.workStatus === "GC_OR_CITIZEN_REQ" || p.workStatus === "NOT_SPECIFIED" || p.workStatus === "ALL") {
          setWorkStatus(p.workStatus);
        }
        if (typeof p.minSalaryFloor === "number") setMinSalaryFloor(p.minSalaryFloor);
        if (typeof p.maxMiles === "number") setMaxMiles(p.maxMiles);
        if (typeof p.targetTitlesText === "string") setTargetTitlesText(p.targetTitlesText);
        if (typeof p.hideApplied === "boolean") setHideApplied(p.hideApplied);
      }

      const savedProfile = localStorage.getItem("careerai_master_profile_v27");
      if (savedProfile) {
        const prof = JSON.parse(savedProfile);
        if (typeof prof.candidateName === "string") setCandidateName(prof.candidateName);
        if (typeof prof.candidateHeadline === "string") setCandidateHeadline(prof.candidateHeadline);
        if (typeof prof.candidateContact === "string") setCandidateContact(prof.candidateContact);
        if (typeof prof.socialProfileUrl === "string") setSocialProfileUrl(prof.socialProfileUrl);
        if (typeof prof.profileSkillsText === "string") setProfileSkillsText(prof.profileSkillsText);
        if (typeof prof.executiveSummary === "string") setExecutiveSummary(prof.executiveSummary);
        if (prof.attachedResume) setAttachedResume(prof.attachedResume);
      }
    } catch {}
  }, []);

  const handleResumeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExt = /\.(pdf|doc|docx|txt)$/i;
    if (!allowedExt.test(file.name)) {
      setValidationMessage({
        type: "err",
        text: "Please attach a valid resume file (.pdf, .doc, .docx, or .txt)."
      });
      return;
    }

    let preview = "";
    if (/\.txt$/i.test(file.name)) {
      try {
        const text = await file.text();
        preview = text.slice(0, 600);
        if (text.trim().length > 80) {
          setExecutiveSummary(text.trim().slice(0, 520));
        }
      } catch {}
    }

    const meta: AttachedResumeMeta = {
      fileName: file.name,
      fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
      uploadedDate: formatUniformDate(new Date().toISOString()),
      extractedPreview: preview || undefined
    };

    setAttachedResume(meta);
    try {
      const existing = JSON.parse(localStorage.getItem("careerai_master_profile_v27") || "{}");
      localStorage.setItem("careerai_master_profile_v27", JSON.stringify({ ...existing, attachedResume: meta }));
    } catch {}

    setValidationMessage({
      type: "ok",
      text: `Attached resume "${meta.fileName}" (${meta.fileSizeKb} KB) to your Master Profile.`
    });
  };

  const activeTitlesList = useMemo(
    () =>
      (targetTitlesText || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [targetTitlesText]
  );

  const togglePendingRemovalTitle = (titleItem: string) => {
    setPendingRemovalTitles((prev) =>
      prev.some((x) => x.toLowerCase() === titleItem.toLowerCase())
        ? prev.filter((x) => x.toLowerCase() !== titleItem.toLowerCase())
        : [...prev, titleItem]
    );
  };

  const addSuggestedTitle = (titleToAdd: string) => {
    // If marked for removal, unmark it; otherwise append
    if (pendingRemovalTitles.some((x) => x.toLowerCase() === titleToAdd.toLowerCase())) {
      setPendingRemovalTitles((prev) => prev.filter((x) => x.toLowerCase() !== titleToAdd.toLowerCase()));
      return;
    }
    if (!activeTitlesList.some((t) => t.toLowerCase() === titleToAdd.toLowerCase())) {
      const updated = [...activeTitlesList, titleToAdd].join(", ");
      setTargetTitlesText(updated);
    }
  };

  const validateAndSavePreferences = (next?: {
    zone?: "ALL" | "VA_DMV" | "REMOTE";
    workMode?: "ALL" | "Remote" | "Hybrid";
    workStatus?: "ALL" | WorkStatusKey;
    minSalaryFloor?: number;
    maxMiles?: number;
    targetTitlesText?: string;
    hideApplied?: boolean;
  }) => {
    const remainingTitles = (next?.targetTitlesText ?? targetTitlesText)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => !pendingRemovalTitles.some((rem) => rem.toLowerCase() === t.toLowerCase()));

    const finalizedTitlesStr = remainingTitles.join(", ");
    setTargetTitlesText(finalizedTitlesStr);
    setPendingRemovalTitles([]);

    const payload = {
      zone: next?.zone ?? zone,
      workMode: next?.workMode ?? workMode,
      workStatus: next?.workStatus ?? workStatus,
      minSalaryFloor: next?.minSalaryFloor ?? minSalaryFloor,
      maxMiles: next?.maxMiles ?? maxMiles,
      targetTitlesText: finalizedTitlesStr,
      hideApplied: next?.hideApplied ?? hideApplied
    };

    if (payload.minSalaryFloor < 0 || payload.maxMiles < 0) {
      setValidationMessage({ type: "err", text: "Salary and distance thresholds cannot be negative." });
      return false;
    }

    try {
      localStorage.setItem("careerai_prefs_v31", JSON.stringify(payload));
      setValidationMessage({ type: "ok", text: "Preferences saved and Requisition Hub updated." });
      return true;
    } catch {
      setValidationMessage({ type: "err", text: "Unable to save preferences in browser storage." });
      return false;
    }
  };

  const applyLinkedOrIndeedProfile = () => {
    const urlTrimmed = (socialProfileUrl || "").trim();
    if (urlTrimmed && !/^(https?:\/\/)?(www\.)?(linkedin\.com|indeed\.com)\//i.test(urlTrimmed)) {
      setValidationMessage({
        type: "err",
        text: "Please enter a valid LinkedIn or Indeed profile URL (e.g., https://www.linkedin.com/in/... or https://my.indeed.com/...)."
      });
      return;
    }

    const parsed = parseProfileFromUrlOrText(urlTrimmed, profileImportText || "");
    if (parsed.inferredName) setCandidateName(parsed.inferredName);
    if (parsed.inferredHeadline) setCandidateHeadline(parsed.inferredHeadline);
    if (parsed.inferredSummary) setExecutiveSummary(parsed.inferredSummary);
    const mergedSkills =
      parsed.skillsDetected.length > 0
        ? Array.from(
            new Set([
              ...(profileSkillsText || "").split(",").map((s) => s.trim()).filter(Boolean),
              ...parsed.skillsDetected
            ])
          ).join(", ")
        : profileSkillsText || "";
    setProfileSkillsText(mergedSkills);

    const normalizedUrl = urlTrimmed
      ? /^https?:\/\//i.test(urlTrimmed)
        ? urlTrimmed
        : `https://${urlTrimmed}`
      : "";

    try {
      localStorage.setItem(
        "careerai_master_profile_v27",
        JSON.stringify({
          candidateName: parsed.inferredName || candidateName,
          candidateHeadline: parsed.inferredHeadline || candidateHeadline,
          candidateContact,
          socialProfileUrl: normalizedUrl,
          profileSkillsText: mergedSkills,
          executiveSummary: parsed.inferredSummary || executiveSummary,
          attachedResume
        })
      );
    } catch {}

    setValidationMessage({
      type: "ok",
      text: `Master profile updated from ${urlTrimmed || "profile details"}${
        parsed.skillsDetected.length ? ` (${parsed.skillsDetected.length} skills synced)` : ""
      }.`
    });
  };

  const validateAndSaveProfile = () => {
    if (!(candidateName || "").trim()) {
      setValidationMessage({ type: "err", text: "Candidate name is required for your master profile and resume." });
      return false;
    }
    if (!(profileSkillsText || "").trim()) {
      setValidationMessage({ type: "err", text: "Enter at least one skill so candidate fit scoring can evaluate roles." });
      return false;
    }
    const urlTrimmed = (socialProfileUrl || "").trim();
    if (urlTrimmed && !/^(https?:\/\/)?(www\.)?(linkedin\.com|indeed\.com)\//i.test(urlTrimmed)) {
      setValidationMessage({
        type: "err",
        text: "Profile link must be a valid LinkedIn or Indeed URL."
      });
      return false;
    }

    try {
      localStorage.setItem(
        "careerai_master_profile_v27",
        JSON.stringify({
          candidateName: candidateName.trim(),
          candidateHeadline: (candidateHeadline || "").trim(),
          candidateContact: (candidateContact || "").trim(),
          socialProfileUrl: urlTrimmed,
          profileSkillsText: profileSkillsText.trim(),
          executiveSummary: (executiveSummary || "").trim(),
          attachedResume
        })
      );
      setValidationMessage({ type: "ok", text: "Master profile validated and saved." });
      return true;
    } catch {
      setValidationMessage({ type: "err", text: "Failed to persist master profile." });
      return false;
    }
  };

  const toggleApplied = (job: JobRecord, workStatusText?: string) => {
    setAppliedMap((prev) => {
      const nextVal = !prev[job.id];
      const next = { ...prev, [job.id]: nextVal };
      try {
        localStorage.setItem("careerai_applied_v27", JSON.stringify(next));
      } catch {}
      if (nextVal) {
        recordHistory(job, "APPLIED", workStatusText);
      }
      return next;
    });
  };

  const profileSkillsLower = useMemo(
    () =>
      (profileSkillsText || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [profileSkillsText]
  );

  const suggestedTitlesFromProfile = useMemo(
    () =>
      buildMasterProfileSuggestions(
        candidateHeadline || "",
        profileSkillsText || "",
        executiveSummary || "",
        roles,
        activeTitlesList
      ),
    [candidateHeadline, profileSkillsText, executiveSummary, roles, activeTitlesList]
  );

  const enriched = useMemo(() => {
    return (initialJobs || [])
      .filter((j) => j.is_active !== false && !/\bjobs\s*$/i.test((j.title || "").trim()))
      .map((job) => ({ job, fit: evaluateCandidateScore(job, profileSkillsLower) }))
      .sort((a, b) => b.fit.score - a.fit.score);
  }, [initialJobs, profileSkillsLower]);

  const fortune500Count = useMemo(() => enriched.filter((x) => x.fit.isFortune500).length, [enriched]);

  const statusCounts = useMemo(() => {
    let gcCitizen = 0;
    let notSpec = 0;
    for (const item of enriched) {
      if (item.fit.workStatus === "GC_OR_CITIZEN_REQ") gcCitizen++;
      else notSpec++;
    }
    return { gcCitizen, notSpec };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    const tq = (titleQuery || "").trim().toLowerCase();

    return enriched.filter(({ job, fit }) => {
      if (hideApplied && appliedMap[job.id]) return false;

      if (tq && !(job.title || "").toLowerCase().includes(tq)) return false;

      if (activeTitlesList.length > 0) {
        const tLower = (job.title || "").toLowerCase();
        const matchesAnyTargetTitle = activeTitlesList.some((tt) => tLower.includes(tt.toLowerCase()));
        if (!matchesAnyTargetTitle) return false;
      }

      if (zone !== "ALL") {
        const locStr = `${job.zone || ""} ${job.location || ""}`.toLowerCase();
        if (
          zone === "VA_DMV" &&
          !/virginia|\bva\b|dmv|richmond|mclean|arlington|reston|norfolk|virginia beach|dc|maryland/i.test(locStr)
        ) {
          return false;
        }
        if (zone === "REMOTE" && !job.is_remote && !/remote/i.test(`${locStr} ${job.work_mode || ""}`)) {
          return false;
        }
      }

      if (trackFilter !== "ALL" && fit.track !== trackFilter) return false;

      if (workMode !== "ALL") {
        const mode = (job.work_mode || (job.is_remote ? "Remote" : "Hybrid")).toLowerCase();
        if (mode !== workMode.toLowerCase()) return false;
      }

      if (workStatus !== "ALL" && fit.workStatus !== workStatus) return false;
      if (minScore > 0 && fit.score < minScore) return false;
      if (fortune500Only && !fit.isFortune500) return false;

      if (minSalaryFloor > 0) {
        if (!fit.minSalaryAnnual || fit.minSalaryAnnual < minSalaryFloor) return false;
      }

      if (maxMiles > 0) {
        if (fit.miles === null || fit.miles > maxMiles) return false;
      }

      if (q) {
        const hay = `${job.title || ""} ${job.company || ""} ${job.location || ""} ${job.req_id || ""} ${fit.salaryLabel} ${fit.formattedBlocks.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [enriched, search, titleQuery, activeTitlesList, zone, trackFilter, workMode, workStatus, minScore, fortune500Only, minSalaryFloor, maxMiles, hideApplied, appliedMap]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const vaCount = filtered.filter(({ job }) =>
      /virginia|\bva\b|dmv|richmond|mclean|arlington|reston|norfolk|virginia beach|dc|maryland/i.test(`${job.zone || ""} ${job.location || ""}`)
    ).length;
    const remoteCount = filtered.filter(({ job }) =>
      Boolean(job.is_remote) || /remote/i.test(`${job.work_mode || ""} ${job.zone || ""} ${job.location || ""}`)
    ).length;
    const topTierCount = filtered.filter(({ fit }) => fit.score >= 90).length;
    const avgScore = total
      ? Math.round(filtered.reduce((s, x) => s + x.fit.score, 0) / total)
      : 0;

    return { total, vaCount, remoteCount, topTierCount, avgScore };
  }, [filtered]);

  const activeItem = useMemo(() => {
    if (filtered.length === 0) return enriched[0] || null;
    return filtered.find((x) => x.job.id === selectedId) || filtered[0];
  }, [filtered, selectedId, enriched]);

  const atsAudit = useMemo(() => {
    const job = activeItem?.job;
    const jobText = `${job?.title || ""} ${job?.description || ""} ${(job?.keywords || []).join(" ")}`.toLowerCase();
    const resumeBlob = [
      candidateHeadline || "",
      executiveSummary || "",
      profileSkillsText || "",
      ...roles.flatMap((r) => [r.title, r.org, r.period, ...r.bullets]),
      ...educationAndCerts,
      ...awardsAndImpact
    ]
      .join(" ")
      .toLowerCase();

    const matched = ATS_CHECK_TERMS.filter(
      (t) => jobText.includes(t.toLowerCase()) && resumeBlob.includes(t.toLowerCase())
    );
    const missing = ATS_CHECK_TERMS.filter(
      (t) => jobText.includes(t.toLowerCase()) && !resumeBlob.includes(t.toLowerCase())
    );
    const denom = matched.length + missing.length;
    const pct = denom > 0 ? Math.round((matched.length / denom) * 100) : 96;
    const skillsList = (profileSkillsText || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return { job, matched, missing, pct, skillsList };
  }, [activeItem, candidateHeadline, executiveSummary, profileSkillsText, roles, educationAndCerts, awardsAndImpact]);

  const downloadWordDoc = () => {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8"><style>
        body { font-family: Calibri, Arial, sans-serif; color: #0f172a; line-height: 1.42; margin: 28px; }
        h1 { font-size: 20pt; margin: 0 0 2px 0; color: #0f172a; }
        .headline { font-size: 10.5pt; font-weight: bold; color: #3730a3; margin-bottom: 2px; }
        .contact { font-size: 9.5pt; color: #475569; margin-bottom: 10px; }
        h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.6px; color: #1e293b; border-bottom: 1.5px solid #4f46e5; padding-bottom: 2px; margin-top: 12px; }
        .role-title { font-weight: bold; font-size: 10.5pt; margin-top: 8px; color: #0f172a; }
        .role-meta { font-size: 9.5pt; color: #475569; margin-bottom: 3px; }
        ul { margin: 3px 0 8px 18px; }
        li { margin-bottom: 3.5px; font-size: 9.8pt; }
      </style></head>
      <body>
        <h1>${candidateName}</h1>
        <div class="headline">${candidateHeadline}</div>
        <div class="contact">${candidateContact}</div>

        <h2>Professional Summary</h2>
        <p style="font-size:9.8pt;">${executiveSummary}</p>

        <h2>Key Skills</h2>
        <p style="font-size:9.8pt;">${atsAudit.skillsList.join("  •  ")}</p>

        <h2>Professional Experience</h2>
        ${roles
          .map(
            (r) => `
          <div class="role-title">${r.title}</div>
          <div class="role-meta">${r.org} • <strong>${r.period}</strong></div>
          <ul>${r.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
        `
          )
          .join("")}

        <h2>Education &amp; Certifications</h2>
        <ul>${educationAndCerts.map((b) => `<li>${b}</li>`).join("")}</ul>

        <h2>Awards &amp; Achievements</h2>
        <ul>${awardsAndImpact.map((b) => `<li>${b}</li>`).join("")}</ul>
      </body></html>
    `;
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(candidateName || "Resume").replace(/\s+/g, "_")}_Resume.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const win = window.open("", "_blank", "width=940,height=1180");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${candidateName} - Resume</title>
        <style>
          @page { size: letter; margin: 0.48in; }
          body { font-family: Inter, -apple-system, Arial, sans-serif; color: #0f172a; line-height: 1.44; margin: 0; }
          .header { border-bottom: 2.5px solid #4f46e5; padding-bottom: 8px; margin-bottom: 10px; }
          .name { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
          .headline { font-size: 11px; font-weight: 700; color: #4338ca; margin-top: 2px; }
          .contact { font-size: 9.8px; color: #475569; margin-top: 2px; }
          h2 { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 11px 0 5px; break-after: avoid; }
          p { font-size: 9.8px; margin: 3px 0 7px; color: #1e293b; }
          .role-block { break-inside: avoid; margin-bottom: 7px; }
          .role-hdr { font-size: 10.2px; font-weight: 700; color: #0f172a; }
          .role-meta { font-size: 9.3px; color: #475569; margin-bottom: 2px; }
          ul { margin: 2px 0 6px 16px; padding: 0; }
          li { font-size: 9.6px; margin-bottom: 3px; color: #1e293b; }
          .skills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
          .skill { font-size: 9px; font-weight: 600; background: #eef2ff; color: #3730a3; padding: 1.5px 6px; border-radius: 3px; border: 1px solid #c7d2fe; }
          script { display: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="name">${candidateName}</div>
          <div class="headline">${candidateHeadline}</div>
          <div class="contact">${candidateContact}</div>
        </div>

        <h2>Executive Summary</h2>
        <p>${executiveSummary}</p>

        <h2>Key Skills</h2>
        <div class="skills">
          ${atsAudit.skillsList.map((s) => `<span class="skill">${s}</span>`).join("")}
        </div>

        <h2>Professional Experience</h2>
        ${roles
          .map(
            (r) => `
          <div class="role-block">
            <div class="role-hdr">${r.title}</div>
            <div class="role-meta">${r.org} • <strong>${r.period}</strong></div>
            <ul>${r.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
          </div>
        `
          )
          .join("")}

        <h2>Education &amp; Certifications</h2>
        <ul>${educationAndCerts.map((b) => `<li>${b}</li>`).join("")}</ul>

        <h2>Awards &amp; Achievements</h2>
        <ul>${awardsAndImpact.map((b) => `<li>${b}</li>`).join("")}</ul>

        <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const resetAll = () => {
    setSearch("");
    setTitleQuery("");
    setZone("ALL");
    setTrackFilter("ALL");
    setWorkMode("ALL");
    setWorkStatus("ALL");
    setMinScore(0);
    setFortune500Only(false);
    setMinSalaryFloor(0);
    setMaxMiles(0);
    setTargetTitlesText("");
    setPendingRemovalTitles([]);
    setHideApplied(false);
    try { localStorage.removeItem("careerai_prefs_v31"); } catch {}
    setValidationMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-[1480px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-extrabold text-sm">
              CA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">CareerAI Intelligence</span>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  v3.1
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Requisition Hub • Master Profile &amp; Resume Attachment • Uniform Dates • Per-Role ATS Resume
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTopView("ROLE_COMMAND");
                  setValidationMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  topView === "ROLE_COMMAND" ? "bg-indigo-600 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Requisition Hub ({filtered.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTopView("HISTORY");
                  setValidationMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  topView === "HISTORY" ? "bg-amber-600 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                History ({historyLog.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTopView("PREFERENCES");
                  setValidationMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  topView === "PREFERENCES" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Preferences
              </button>
              <button
                type="button"
                onClick={() => {
                  setTopView("PROFILE");
                  setValidationMessage(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  topView === "PROFILE" ? "bg-violet-600 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                Profile
              </button>
            </div>

            {topView === "ROLE_COMMAND" && (
              <>
                <input
                  type="text"
                  value={search ?? ""}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search company, salary, SQL, Req #..."
                  className="w-56 sm:w-64 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:border-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>

        {/* Interactive Filter Strip + Dedicated Title Filter */}
        {topView === "ROLE_COMMAND" && (
          <div className="bg-white text-slate-700 border-b border-slate-200">
            <div className="max-w-[1480px] mx-auto px-6 py-2.5 flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1">
                <label htmlFor="title-filter-input" className="text-slate-400 font-semibold mr-0.5">
                  Title Filter:
                </label>
                <input
                  id="title-filter-input"
                  type="text"
                  value={titleQuery ?? ""}
                  onChange={(e) => setTitleQuery(e.target.value)}
                  placeholder="Filter by job title..."
                  className="w-40 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Zone:</span>
                {[
                  { id: "ALL", label: "All" },
                  { id: "VA_DMV", label: "VA / DMV" },
                  { id: "REMOTE", label: "US Remote" }
                ].map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZone(z.id as "ALL" | "VA_DMV" | "REMOTE")}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      zone === z.id ? "bg-indigo-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Track:</span>
                {[
                  { id: "ALL", label: "All" },
                  { id: "ANALYST", label: "Data Analyst" },
                  { id: "BI", label: "BI" },
                  { id: "ENGINEER", label: "Data Eng" },
                  { id: "SCIENTIST", label: "Data Sci" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrackFilter(t.id as "ALL" | "ANALYST" | "ENGINEER" | "BI" | "SCIENTIST")}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      trackFilter === t.id ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Mode:</span>
                {(["ALL", "Remote", "Hybrid"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWorkMode(m)}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      workMode === m ? "bg-indigo-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {m === "ALL" ? "All" : m}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Distance:</span>
                {[
                  { val: 0, label: "All" },
                  { val: 25, label: "≤ 25 mi" },
                  { val: 50, label: "≤ 50 mi" },
                  { val: 100, label: "≤ 100 mi" },
                  { val: 200, label: "≤ 200 mi" }
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => setMaxMiles(d.val)}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      maxMiles === d.val ? "bg-cyan-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Salary:</span>
                {[
                  { val: 0, label: "All" },
                  { val: 110000, label: "$110k+" },
                  { val: 130000, label: "$130k+" },
                  { val: 150000, label: "$150k+" }
                ].map((sal) => (
                  <button
                    key={sal.val}
                    type="button"
                    onClick={() => setMinSalaryFloor(sal.val)}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      minSalaryFloor === sal.val ? "bg-blue-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {sal.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Work Status:</span>
                {[
                  { id: "ALL", label: "All" },
                  { id: "NOT_SPECIFIED", label: `Not Specified (${statusCounts.notSpec})` }
                ].map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setWorkStatus(ws.id as "ALL" | WorkStatusKey)}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      workStatus === ws.id ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {ws.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-0.5">Match:</span>
                {[
                  { val: 0, label: "All" },
                  { val: 85, label: "85%+" },
                  { val: 90, label: "90%+" }
                ].map((sc) => (
                  <button
                    key={sc.val}
                    type="button"
                    onClick={() => setMinScore(sc.val)}
                    className={`px-2 py-1 rounded-md font-medium transition ${
                      minScore === sc.val ? "bg-indigo-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-300">|</span>

              <button
                type="button"
                onClick={() => setFortune500Only((prev) => !prev)}
                className={`px-2.5 py-1 rounded-md font-semibold transition border ${
                  fortune500Only
                    ? "bg-amber-500 text-slate-950 border-amber-600 shadow-2xs"
                    : "bg-amber-50/70 hover:bg-amber-100 text-amber-900 border-amber-200"
                }`}
              >
                ★ Fortune 500 ({fortune500Count})
              </button>

              <label className="ml-auto inline-flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideApplied}
                  onChange={(e) => setHideApplied(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                Hide Applied ({Object.values(appliedMap).filter(Boolean).length})
              </label>
            </div>
          </div>
        )}
      </header>

      {/* POP-UP MODAL FOR PER-JOB ATS RESUME */}
      {resumeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setResumeModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-6xl max-h-[92vh] rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-950 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-extrabold tracking-tight">ATS Resume</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                    {atsAudit.pct}% Keyword Match
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Role:{" "}
                  <span className="text-indigo-300 font-semibold">
                    {atsAudit.job ? `${atsAudit.job.title} — ${atsAudit.job.company}` : "Senior Data Analyst"}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadWordDoc}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold"
                >
                  Download .DOC
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => setResumeModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start bg-slate-100">
              <div className="lg:col-span-4 space-y-3.5 text-xs bg-white p-4 rounded-xl border border-slate-200">
                <div className="font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Customize &amp; Keyword Check
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Professional Summary</label>
                  <textarea
                    rows={5}
                    value={executiveSummary ?? ""}
                    onChange={(e) => setExecutiveSummary(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-800 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {roles[0].title} ({roles[0].period})
                  </label>
                  <textarea
                    rows={6}
                    value={(roles[0]?.bullets || []).join("\n")}
                    onChange={(e) => {
                      const updated = [...roles];
                      updated[0] = {
                        ...updated[0],
                        bullets: e.target.value.split("\n").filter((l) => l.trim().length > 0)
                      };
                      setRoles(updated);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-800 leading-relaxed"
                  />
                </div>

                {atsAudit.matched.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-950">
                    <strong>Matched ATS Terms ({atsAudit.matched.length}):</strong> {atsAudit.matched.join(", ")}
                  </div>
                )}

                {atsAudit.missing.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-950">
                    <strong>Role terms not yet explicit:</strong> {atsAudit.missing.join(", ")}
                  </div>
                )}
              </div>

              <article className="lg:col-span-8 bg-white rounded-xl border border-slate-300 p-8 shadow-sm space-y-4">
                <div className="border-b-2 border-indigo-600 pb-3">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{candidateName}</h2>
                  <div className="text-xs font-bold text-indigo-700 mt-0.5">{candidateHeadline}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{candidateContact}</div>
                </div>

                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                    Professional Summary
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">{executiveSummary}</p>
                </div>

                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                    Key Skills
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {atsAudit.skillsList.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3.5 pt-1">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                    Professional Experience
                  </h3>

                  {roles.map((role, rIdx) => (
                    <div key={rIdx} className="space-y-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900">{role.title}</div>
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {role.period}
                        </span>
                      </div>
                      <div className="text-[11px] italic text-slate-500">{role.org}</div>
                      <ul className="mt-1 space-y-1.5 list-disc pl-4 text-xs text-slate-700 leading-relaxed">
                        {role.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                    Education &amp; Certifications
                  </h3>
                  <ul className="space-y-1.5 list-disc pl-4 text-xs text-slate-700 leading-relaxed">
                    {educationAndCerts.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5 pt-1">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                    Awards &amp; Achievements
                  </h3>
                  <ul className="space-y-1.5 list-disc pl-4 text-xs text-slate-700 leading-relaxed">
                    {awardsAndImpact.map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1480px] mx-auto px-6 py-4 space-y-4">
        {/* KPI Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 border-t-4 border-t-indigo-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Matching Roles</span>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {enriched.length} Total
              </span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{kpis.total}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full"
                style={{ width: `${enriched.length ? Math.round((kpis.total / enriched.length) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 border-t-4 border-t-blue-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Virginia / DMV</span>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                Target Corridor
              </span>
            </div>
            <div className="text-2xl font-extrabold text-blue-600 mt-1">{kpis.vaCount}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${kpis.total ? Math.round((kpis.vaCount / kpis.total) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 border-t-4 border-t-emerald-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">US Remote</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Remote Eligible
              </span>
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">{kpis.remoteCount}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${kpis.total ? Math.round((kpis.remoteCount / kpis.total) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 border-t-4 border-t-violet-600">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">90%+ Strong Fit</span>
              <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                Avg {kpis.avgScore}%
              </span>
            </div>
            <div className="text-2xl font-extrabold text-violet-600 mt-1">{kpis.topTierCount}</div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full"
                style={{ width: `${kpis.total ? Math.round((kpis.topTierCount / kpis.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        </section>

        {validationMessage && (
          <div
            className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
              validationMessage.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {validationMessage.text}
          </div>
        )}

        {topView === "HISTORY" ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Job Activity &amp; Application History</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Persists every requisition you inspect or mark applied ({historyLog.length} recorded).
                </p>
              </div>
              <div className="flex items-center gap-2">
                {activeItem && (
                  <button
                    type="button"
                    onClick={() => recordHistory(activeItem.job, "VIEWED", activeItem.fit.workStatusText)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    + Log Selected Role
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTopView("ROLE_COMMAND")}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  ← Back to Requisition Hub
                </button>
              </div>
            </div>

            {historyLog.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No history entries recorded yet. Click any requisition in Requisition Hub or mark a role Applied to start your log.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {historyLog.map((item) => (
                  <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white hover:bg-slate-50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            item.status === "APPLIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="font-bold text-slate-800">{item.company}</span>
                        {item.reqId && <span className="font-mono text-slate-500">Req #{item.reqId}</span>}
                        <span className="text-slate-400">• {formatUniformDate(item.timestamp)}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">
                        {item.location || "United States"} • {item.workMode || "Hybrid"} • {item.workStatus}
                      </div>
                    </div>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      Open Posting →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : topView === "PREFERENCES" ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Search &amp; Filtering Preferences</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any green active title to mark for removal, or click a suggested title from your Master Profile to add—then save to update Requisition Hub.
              </p>
            </div>

            {/* Active Added Titles as Green Toggle Buttons */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <label htmlFor="pref-target-titles" className="font-bold text-slate-700">
                  Active Target Job Titles (Green = Active; Click to Stage Removal Before Saving)
                </label>
                {pendingRemovalTitles.length > 0 && (
                  <span className="text-[11px] font-semibold text-rose-600">
                    Staged for removal on save: {pendingRemovalTitles.join(", ")}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {activeTitlesList.map((titleItem) => {
                  const markedForRemove = pendingRemovalTitles.some(
                    (rem) => rem.toLowerCase() === titleItem.toLowerCase()
                  );
                  return (
                    <button
                      key={titleItem}
                      type="button"
                      onClick={() => togglePendingRemovalTitle(titleItem)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition border ${
                        markedForRemove
                          ? "bg-rose-50 text-rose-700 border-rose-300 line-through"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                      }`}
                    >
                      {markedForRemove ? `✕ ${titleItem}` : `✓ ${titleItem}`}
                    </button>
                  );
                })}
              </div>

              <input
                id="pref-target-titles"
                type="text"
                value={targetTitlesText ?? ""}
                onChange={(e) => setTargetTitlesText(e.target.value)}
                placeholder="Comma-separated titles (leave empty to match all titles)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 mt-1"
              />

              {/* Suggested Titles From Master Profile */}
              {suggestedTitlesFromProfile.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block mb-1.5">
                    Suggested Titles From Your Master Profile:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTitlesFromProfile.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => addSuggestedTitle(sug)}
                        className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold transition"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Default Region / Zone</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as "ALL" | "VA_DMV" | "REMOTE")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="ALL">All Zones</option>
                  <option value="VA_DMV">Virginia / DMV</option>
                  <option value="REMOTE">US Remote</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Max Distance From Home Base</label>
                <select
                  value={maxMiles}
                  onChange={(e) => setMaxMiles(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value={0}>All Distances</option>
                  <option value={25}>Up to 25 miles</option>
                  <option value={50}>Up to 50 miles</option>
                  <option value={100}>Up to 100 miles</option>
                  <option value={200}>Up to 200 miles</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Minimum Base Salary Floor</label>
                <select
                  value={minSalaryFloor}
                  onChange={(e) => setMinSalaryFloor(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value={0}>Any Listed / Unlisted Salary</option>
                  <option value={110000}>$110,000+ / yr</option>
                  <option value={130000}>$130,000+ / yr</option>
                  <option value={150000}>$150,000+ / yr</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Default Work Status Filter</label>
                <select
                  value={workStatus}
                  onChange={(e) => setWorkStatus(e.target.value as "ALL" | WorkStatusKey)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="ALL">All Work Statuses</option>
                  <option value="NOT_SPECIFIED">Not Specified</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (validateAndSavePreferences()) setTopView("ROLE_COMMAND");
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
              >
                Save &amp; Update Requisition Hub →
              </button>
            </div>
          </div>
        ) : topView === "PROFILE" ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-4xl space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Master Profile, Resume Attachment &amp; LinkedIn / Indeed Sync</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Attach a resume (.PDF, .DOC, .DOCX, .TXT) or sync from a LinkedIn / Indeed profile link to build your master profile.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900">Attach Resume File (.PDF, .DOC, .DOCX, .TXT)</span>
                {attachedResume && (
                  <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                    Attached: {attachedResume.fileName} ({attachedResume.fileSizeKb} KB • {attachedResume.uploadedDate})
                  </span>
                )}
              </div>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleResumeFileUpload}
                className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer"
              />
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="font-bold text-indigo-950">Create / Update Master Profile From LinkedIn or Indeed Link</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={socialProfileUrl ?? ""}
                  onChange={(e) => setSocialProfileUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-profile or https://my.indeed.com/p/..."
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                />
                <button
                  type="button"
                  onClick={applyLinkedOrIndeedProfile}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0"
                >
                  Sync From Profile Link
                </button>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Optional: Paste Profile Headline, Summary, or Experience Text
                </label>
                <textarea
                  rows={3}
                  value={profileImportText ?? ""}
                  onChange={(e) => setProfileImportText(e.target.value)}
                  placeholder="Paste summary or experience text from LinkedIn or Indeed..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={candidateName ?? ""}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Location &amp; Contact</label>
                <input
                  type="text"
                  value={candidateContact ?? ""}
                  onChange={(e) => setCandidateContact(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">Headline</label>
              <input
                type="text"
                value={candidateHeadline ?? ""}
                onChange={(e) => setCandidateHeadline(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">Core Skills &amp; Stack (Comma-Separated) *</label>
              <input
                type="text"
                value={profileSkillsText ?? ""}
                onChange={(e) => setProfileSkillsText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (validateAndSaveProfile()) setTopView("ROLE_COMMAND");
                }}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700"
              >
                Validate &amp; Save Master Profile →
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
            <div className="text-sm font-bold text-slate-900">No roles match the selected filters</div>
            <p className="text-xs text-slate-500">Click Reset to restore all {enriched.length} verified roles.</p>
            <button
              type="button"
              onClick={resetAll}
              className="mt-2 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Role Queue */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 divide-y divide-slate-200 max-h-[calc(100vh-255px)] overflow-y-auto">
              {filtered.map(({ job, fit }, idx) => {
                const isSelected = activeItem?.job.id === job.id;
                const isApplied = Boolean(appliedMap[job.id]);
                const reqBadge = formatReqBadge(job.req_id);

                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(job.id);
                      recordHistory(job, "VIEWED", fit.workStatusText);
                    }}
                    className={`w-full text-left px-4 py-3 transition block ${
                      isSelected
                        ? "bg-indigo-50/80 border-l-4 border-l-indigo-600"
                        : "hover:bg-slate-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono text-slate-400">#{idx + 1}</span>
                          <span className="font-bold text-slate-800 truncate">{job.company}</span>
                          {fit.isFortune500 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                              ★ F500
                            </span>
                          )}
                          {isApplied && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                              Applied
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-1">
                          {job.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {job.location || "United States"} ({fit.distanceLabel}) •{" "}
                          {job.work_mode || (job.is_remote ? "Remote" : "Hybrid")} •{" "}
                          <span className="font-semibold text-slate-700">{fit.salaryLabel}</span>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-bold ${
                          fit.score >= 90
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : fit.score >= 82
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {fit.score}% Fit
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          fit.workStatus === "GC_OR_CITIZEN_REQ"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {fit.workStatusText}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[10px]">
                        Posted: {fit.dates.postedDate}
                      </span>
                      {reqBadge && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                          {reqBadge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Detail Inspector */}
            {activeItem && (
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-4 lg:sticky lg:top-32 max-h-[calc(100vh-255px)] overflow-y-auto">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-indigo-700">{activeItem.job.company}</span>
                      {activeItem.fit.isFortune500 && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                          ★ Fortune 500
                        </span>
                      )}
                      {formatReqBadge(activeItem.job.req_id) && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                          {formatReqBadge(activeItem.job.req_id)}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {activeItem.job.work_mode || (activeItem.job.is_remote ? "Remote" : "Hybrid")}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px] font-medium">
                        {activeItem.fit.distanceLabel}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 leading-snug">
                      {activeItem.job.title}
                    </h2>

                    <div className="text-xs text-slate-600">
                      {activeItem.job.location || "United States"} •{" "}
                      <strong className="text-emerald-700">{activeItem.fit.salaryLabel}</strong>
                      {activeItem.job.source ? ` • Source: ${activeItem.job.source}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setResumeModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    >
                      ATS Resume
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleApplied(activeItem.job, activeItem.fit.workStatusText)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        appliedMap[activeItem.job.id]
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {appliedMap[activeItem.job.id] ? "✓ Applied" : "Mark Applied"}
                    </button>

                    <a
                      href={activeItem.job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => recordHistory(activeItem.job, "APPLIED", activeItem.fit.workStatusText)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Apply Direct →
                    </a>
                  </div>
                </div>

                {/* Uniform Dates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Posted Date
                    </span>
                    <span className="font-semibold text-slate-800">{activeItem.fit.dates.postedDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Verified Date
                    </span>
                    <span className="font-semibold text-slate-800">{activeItem.fit.dates.verifiedDate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Closing Date
                    </span>
                    <span className="font-semibold text-slate-800">{activeItem.fit.dates.closingDate}</span>
                  </div>
                </div>

                {activeItem.fit.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeItem.fit.highlights.map((h, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-indigo-50/70 text-indigo-950 border border-indigo-200 text-[11px] font-medium"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Candidate Fit Visualization: {activeItem.fit.score}% Overall
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        activeItem.fit.workStatus === "GC_OR_CITIZEN_REQ"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      Work Status: {activeItem.fit.workStatusText}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex justify-between font-medium text-slate-600 mb-1">
                        <span>Track Fit</span>
                        <span className="font-bold text-indigo-700">{activeItem.fit.trackPts}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${activeItem.fit.trackPts}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex justify-between font-medium text-slate-600 mb-1">
                        <span>Stack Match</span>
                        <span className="font-bold text-emerald-700">{activeItem.fit.skillMatchPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600" style={{ width: `${activeItem.fit.skillMatchPct}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex justify-between font-medium text-slate-600 mb-1">
                        <span>Location / Mode</span>
                        <span className="font-bold text-blue-700">{activeItem.fit.geoMatchPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${activeItem.fit.geoMatchPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Original Requisition Description
                  </div>
                  {activeItem.fit.formattedBlocks.length > 0 ? (
                    <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                      {activeItem.fit.formattedBlocks.map((block, idx) => (
                        <p key={idx} className="whitespace-pre-line">
                          {block}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Full requisition description is hosted directly on the employer portal. Click <strong>Apply Direct</strong> above to review complete job details.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
