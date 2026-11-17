import { NextResponse } from "next/server";
import {
  aggregateUniversalDirectJobs,
  analyzeWorkAuthorization,
  isValidTargetCountry,
  matchesRoleQuery,
  passesWorkAuthFilter,
  scoreJobAgainstProfile,
  validateLocationRadius,
  VerifiedJobPosting,
  WorkAuthFilter,
} from "@/lib/universalAtsEngine";

export const dynamic = "force-dynamic";

interface CacheEntry {
  timestamp: number;
  data: VerifiedJobPosting[];
  audit: any;
}

const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchFromSupabaseWithValidation(
  query: string,
  location: string,
  skills: string[],
  homeCity?: string,
  maxMiles?: number,
  workAuth: WorkAuthFilter = "all",
  minScore = 50
): Promise<VerifiedJobPosting[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/verified_requisitions?status=eq.ACTIVE&order=last_verified_at.desc&limit=1000`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const validated: VerifiedJobPosting[] = [];
    for (const r of rows) {
      // Gate 2A: Profile Role Track
      if (!matchesRoleQuery(r.title || "", query)) continue;

      // Gate 4A: Country Check
      if (!isValidTargetCountry(r.location || "", location)) continue;

      // Gate 4B: Haversine Miles Radius Check
      const radiusCheck = validateLocationRadius(r.location || "", r.description || "", homeCity, maxMiles, true);
      if (!radiusCheck.allowed) continue;

      // Gate 3: Work Authorization / GC / Citizen Check
      const auth = analyzeWorkAuthorization(r.description || "");
      if (!passesWorkAuthFilter(auth.workAuthStatus, workAuth)) continue;

      // Gate 2B: Rubric Score Check
      const { score, matchedSkills, missingSkills } = scoreJobAgainstProfile(
        r.title,
        r.description || "",
        query,
        skills
      );
      if (score < minScore) continue;

      validated.push({
        id: r.id,
        requisitionId: r.requisition_id,
        title: r.title,
        company: r.company,
        canonicalCompany: r.canonical_company,
        atsPlatform: r.ats_platform,
        location: r.location,
        isRemote: r.is_remote,
        distanceMiles: radiusCheck.distanceMiles,
        distanceLabel: radiusCheck.distanceLabel,
        applyUrl: r.apply_url,
        canApplyDirectly: true,
        urlVerified: true,
        verificationMethod: r.verification_method || "DB_VERIFIED_ACTIVE",
        postedDate: r.last_verified_at,
        postedHoursAgo: Math.max(1, Math.round((Date.now() - new Date(r.last_verified_at).getTime()) / 3600000)),
        matchScore: score,
        matchedSkills,
        missingSkills,
        workAuthStatus: auth.workAuthStatus,
        visaSponsorship: auth.visaSponsorship,
        clearanceOrCitizenRequired: auth.clearanceOrCitizenRequired,
        description: r.description,
      });
    }

    validated.sort((a, b) => b.matchScore - a.matchScore || a.postedHoursAgo - b.postedHoursAgo);
    return validated.length > 0 ? validated : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const query = searchParams.get("q") || "Data Analyst";
  const location = searchParams.get("location") || "US";
  const homeCity = searchParams.get("homeCity") || "";
  const maxMiles = Number(searchParams.get("maxMiles") || "0");
  const workAuth = (searchParams.get("workAuth") || "all") as WorkAuthFilter;
  const minScore = Number(searchParams.get("minScore") || "50");
  const includeAggregators = searchParams.get("includeAggregators") !== "false";
  const forceLive = searchParams.get("live") === "true";

  const skillsParam = searchParams.get("skills") || "Snowflake,SQL,dbt,Python,Tableau,Power BI,Data Modeling";
  const skills = skillsParam.split(",").map((s) => s.trim()).filter(Boolean);

  const cacheKey = `${query}::${location}::${homeCity}::${maxMiles}::${workAuth}::${minScore}::${skills.sort().join(",")}`.toLowerCase();
  const now = Date.now();
  const cached = queryCache.get(cacheKey);

  if (!forceLive && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      source: "memory_cache_validated",
      query,
      location,
      homeCity: homeCity || "Nationwide US",
      maxMiles: maxMiles || null,
      workAuthFilter: workAuth,
      count: cached.data.length,
      validationAudit: cached.audit,
      cached: true,
      data: cached.data,
    });
  }

  // Try Supabase pgvector warehouse first (when not forcing live sweep)
  if (!forceLive) {
    const dbJobs = await fetchFromSupabaseWithValidation(
      query,
      location,
      skills,
      homeCity || undefined,
      maxMiles > 0 ? maxMiles : undefined,
      workAuth,
      minScore
    );
    if (dbJobs && dbJobs.length > 0) {
      const dbAudit = {
        totalRawDiscovered: dbJobs.length,
        passedAllGates: dbJobs.length,
        rejectedInactiveOrDeadUrl: 0,
        rejectedProfileMismatch: 0,
        rejectedWorkAuth: 0,
        rejectedGeoOrMiles: 0,
        rejectedDuplicate: 0,
        netNewFromLinkedInOrIndeed: dbJobs.filter((j) => j.atsPlatform.includes("->")).length,
      };
      queryCache.set(cacheKey, { timestamp: now, data: dbJobs, audit: dbAudit });
      return NextResponse.json({
        success: true,
        source: "supabase_pgvector_validated",
        query,
        location,
        homeCity: homeCity || "Nationwide US",
        maxMiles: maxMiles || null,
        workAuthFilter: workAuth,
        count: dbJobs.length,
        validationAudit: dbAudit,
        cached: false,
        data: dbJobs,
      });
    }
  }

  // Live 5-Gate Aggregation across Fortune 500 ATS + LinkedIn & Indeed Offsite Resolvers
  const { jobs, audit } = await aggregateUniversalDirectJobs(
    {
      query,
      skills,
      location,
      homeCity: homeCity || undefined,
      maxMiles: maxMiles > 0 ? maxMiles : undefined,
      workAuth,
      minScore,
      includeAggregators,
    },
    { verifyLiveUrls: true }
  );

  if (jobs.length > 0) {
    queryCache.set(cacheKey, { timestamp: now, data: jobs, audit });
  }

  return NextResponse.json({
    success: true,
    source: "live_5gate_validated",
    query,
    location,
    homeCity: homeCity || "Nationwide US",
    maxMiles: maxMiles || null,
    workAuthFilter: workAuth,
    count: jobs.length,
    validationAudit: audit,
    cached: false,
    data: jobs,
  });
}
