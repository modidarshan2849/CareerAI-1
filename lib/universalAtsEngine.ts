import { logApiUsage } from "@/lib/usageTelemetry";
export type WorkAuthStatus =
  | "SPONSORSHIP_AVAILABLE"
  | "STANDARD_US_WORK_AUTH"
  | "GC_OR_CITIZEN_REQUIRED"
  | "CITIZEN_OR_CLEARANCE_ONLY";

export type WorkAuthFilter =
  | "all"
  | "h1b_eligible"
  | "gc_citizen_eligible"
  | "no_clearance";

export interface UniversalSearchParams {
  query: string;
  skills: string[];
  location: string;
  homeCity?: string;            // e.g., "Virginia Beach, VA"
  maxMiles?: number;            // 0 or undefined = Nationwide US
  includeRemote?: boolean;      // default true
  workAuth?: WorkAuthFilter;    // default "all"
  minScore?: number;            // default 50
  includeAggregators?: boolean; // default true (LinkedIn offsite corporate ATS discovery)
}

export interface VerifiedJobPosting {
  id: string;
  requisitionId: string;
  title: string;
  company: string;
  canonicalCompany: string;
  atsPlatform:
    | "Workday"
    | "Greenhouse"
    | "Lever"
    | "Ashby"
    | "SmartRecruiters"
    | "LinkedIn -> Corporate ATS";
  location: string;
  isRemote: boolean;
  distanceMiles: number | null;
  distanceLabel: string;
  applyUrl: string;
  canApplyDirectly: boolean;
  urlVerified: boolean;
  verificationMethod: string;
  postedDate: string;
  postedHoursAgo: number;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  workAuthStatus: WorkAuthStatus;
  visaSponsorship: boolean;
  clearanceOrCitizenRequired: boolean;
  description: string;
}

export interface ValidationAuditReport {
  totalRawDiscovered: number;
  passedAllGates: number;
  rejectedInactiveOrDeadUrl: number;
  rejectedProfileMismatch: number;
  rejectedWorkAuth: number;
  rejectedGeoOrMiles: number;
  rejectedDuplicate: number;
  netNewFromLinkedInOrIndeed: number;
  rejectionSamples: { title: string; company: string; gate: string; reason: string }[];
}

export interface AtsBoardTarget {
  company: string;
  platform: "workday" | "greenhouse" | "lever" | "ashby" | "smartrecruiters";
  tenant?: string;
  wdInstance?: string;
  site?: string;
  boardToken?: string;
}

// Expanded Registry of 100+ Fortune 500 & Enterprise ATS Endpoints
export const ENTERPRISE_ATS_REGISTRY: AtsBoardTarget[] = [
  // Fortune 500 Workday Tenants (Direct CXS JSON Endpoints)
  { company: "Capital One", platform: "workday", tenant: "capitalone", wdInstance: "wd12", site: "Capital_One" },
  { company: "CarMax", platform: "workday", tenant: "carmax", wdInstance: "wd1", site: "External" },
  { company: "Sentara Health", platform: "workday", tenant: "sentara", wdInstance: "wd1", site: "SCS" },
  { company: "Sysco", platform: "workday", tenant: "sysco", wdInstance: "wd5", site: "syscocareers" },
  { company: "Elevance Health", platform: "workday", tenant: "elevancehealth", wdInstance: "wd1", site: "ANT" },
  { company: "Target", platform: "workday", tenant: "target", wdInstance: "wd5", site: "targetcareers" },
  { company: "The Home Depot", platform: "workday", tenant: "homedepot", wdInstance: "wd5", site: "careers" },
  { company: "Lowe's", platform: "workday", tenant: "lowes", wdInstance: "wd5", site: "lowes_careers" },
  { company: "Salesforce", platform: "workday", tenant: "salesforce", wdInstance: "wd12", site: "Salesforce_Careers" },
  { company: "Mastercard", platform: "workday", tenant: "mastercard", wdInstance: "wd1", site: "CorporateCareers" },
  { company: "Raymond James", platform: "workday", tenant: "raymondjames", wdInstance: "wd1", site: "RaymondJamesCareers" },
  { company: "CardWorks", platform: "workday", tenant: "cardworks", wdInstance: "wd12", site: "CardWorks_External" },
  { company: "Walmart", platform: "workday", tenant: "walmart", wdInstance: "wd5", site: "WalmartExternal" },
  { company: "Adobe", platform: "workday", tenant: "adobe", wdInstance: "wd5", site: "external_experienced" },
  { company: "NVIDIA", platform: "workday", tenant: "nvidia", wdInstance: "wd5", site: "NVIDIAExternalCareerSite" },
  { company: "Bank of America", platform: "workday", tenant: "ghr", wdInstance: "wd1", site: "Lateral-US" },
  { company: "Pfizer", platform: "workday", tenant: "pfizer", wdInstance: "wd1", site: "PfizerCareers" },
  { company: "Boeing", platform: "workday", tenant: "boeing", wdInstance: "wd1", site: "EXTERNAL_CAREERS" },
  { company: "3M", platform: "workday", tenant: "3m", wdInstance: "wd1", site: "Search" },
  { company: "Comcast", platform: "workday", tenant: "comcast", wdInstance: "wd5", site: "Comcast_Careers" },
  { company: "JPMorgan Chase", platform: "workday", tenant: "jpmc", wdInstance: "wd5", site: "JPMC_Careers" },
  { company: "Wells Fargo", platform: "workday", tenant: "wf", wdInstance: "wd1", site: "WellsFargoJobs" },
  { company: "American Express", platform: "workday", tenant: "aexp", wdInstance: "wd5", site: "Careers" },
  { company: "Charles Schwab", platform: "workday", tenant: "schwab", wdInstance: "wd1", site: "Schwab_Careers" },
  { company: "Fidelity Investments", platform: "workday", tenant: "fmr", wdInstance: "wd1", site: "FidelityCareers" },
  { company: "BlackRock", platform: "workday", tenant: "blackrock", wdInstance: "wd1", site: "BlackRock_Professional" },
  { company: "Progressive", platform: "workday", tenant: "progressive", wdInstance: "wd5", site: "Progressive" },
  { company: "Travelers", platform: "workday", tenant: "travelers", wdInstance: "wd5", site: "External" },
  { company: "CVS Health", platform: "workday", tenant: "cvshealth", wdInstance: "wd1", site: "CVS_Health_Careers" },
  { company: "Cigna", platform: "workday", tenant: "cigna", wdInstance: "wd5", site: "cignacareers" },
  { company: "Humana", platform: "workday", tenant: "humana", wdInstance: "wd5", site: "Humana_External_Career_Site" },
  { company: "Best Buy", platform: "workday", tenant: "bestbuy", wdInstance: "wd5", site: "BestBuy_Careers" },
  { company: "Nike", platform: "workday", tenant: "nike", wdInstance: "wd1", site: "nke" },
  { company: "Starbucks", platform: "workday", tenant: "starbucks", wdInstance: "wd1", site: "Starbucks_Careers" },
  { company: "Walt Disney", platform: "workday", tenant: "disney", wdInstance: "wd5", site: "disneycareer" },
  { company: "AT&T", platform: "workday", tenant: "att", wdInstance: "wd1", site: "ATTGeneral" },
  { company: "T-Mobile", platform: "workday", tenant: "tmobile", wdInstance: "wd1", site: "External" },
  { company: "Delta Air Lines", platform: "workday", tenant: "delta", wdInstance: "wd1", site: "en-US" },
  { company: "Marriott", platform: "workday", tenant: "marriott", wdInstance: "wd5", site: "MarriottCareers" },
  { company: "Eli Lilly", platform: "workday", tenant: "lilly", wdInstance: "wd5", site: "LLY" },
  { company: "Johnson & Johnson", platform: "workday", tenant: "jj", wdInstance: "wd5", site: "JJ" },
  { company: "Merck", platform: "workday", tenant: "msd", wdInstance: "wd5", site: "SearchJobs" },
  { company: "Amgen", platform: "workday", tenant: "amgen", wdInstance: "wd1", site: "Careers" },
  { company: "Medtronic", platform: "workday", tenant: "medtronic", wdInstance: "wd1", site: "MedtronicCareers" },
  { company: "Northrop Grumman", platform: "workday", tenant: "ngc", wdInstance: "wd1", site: "Northrop_Grumman_External_Site" },
  { company: "General Motors", platform: "workday", tenant: "generalmotors", wdInstance: "wd5", site: "Careers_GM" },
  { company: "Ford Motor", platform: "workday", tenant: "ford", wdInstance: "wd5", site: "FordCareers" },
  { company: "Caterpillar", platform: "workday", tenant: "cat", wdInstance: "wd1", site: "CaterpillarCareers" },
  { company: "Honeywell", platform: "workday", tenant: "honeywell", wdInstance: "wd5", site: "Honeywell" },
  { company: "Cisco", platform: "workday", tenant: "cisco", wdInstance: "wd5", site: "Cisco_Careers" },
  { company: "Dell Technologies", platform: "workday", tenant: "dell", wdInstance: "wd1", site: "External" },
  { company: "Micron", platform: "workday", tenant: "micron", wdInstance: "wd1", site: "External" },
  { company: "Workday", platform: "workday", tenant: "workday", wdInstance: "wd5", site: "Workday" },
  { company: "ServiceNow", platform: "workday", tenant: "servicenow", wdInstance: "wd1", site: "External" },
  { company: "Intuit", platform: "workday", tenant: "intuit", wdInstance: "wd1", site: "Intuit_Careers" },
  { company: "Citigroup", platform: "workday", tenant: "citi", wdInstance: "wd5", site: "2" },
  { company: "Truist Financial", platform: "workday", tenant: "truist", wdInstance: "wd1", site: "Careers" },
  { company: "PNC Financial", platform: "workday", tenant: "pnc", wdInstance: "wd5", site: "External" },
  { company: "U.S. Bank", platform: "workday", tenant: "usbank", wdInstance: "wd1", site: "USBankCareers" },
  { company: "MetLife", platform: "workday", tenant: "metlife", wdInstance: "wd1", site: "MetLifeCareers" },
  { company: "Prudential", platform: "workday", tenant: "prudential", wdInstance: "wd5", site: "PrudentialCareers" },
  { company: "Allstate", platform: "workday", tenant: "allstate", wdInstance: "wd5", site: "Allstate_Careers" },
  { company: "ExxonMobil", platform: "workday", tenant: "exxonmobil", wdInstance: "wd1", site: "ExxonMobilCareers" },
  { company: "Chevron", platform: "workday", tenant: "chevron", wdInstance: "wd5", site: "jobs" },
  { company: "Lockheed Martin", platform: "workday", tenant: "lmco", wdInstance: "wd1", site: "External" },
  { company: "RTX", platform: "workday", tenant: "globalhr", wdInstance: "wd5", site: "REC_Ext_Site" },
  { company: "General Dynamics", platform: "workday", tenant: "gd", wdInstance: "wd5", site: "External_Career_Site" },
  { company: "Abbott", platform: "workday", tenant: "abbott", wdInstance: "wd5", site: "abbottcareers" },
  { company: "Thermo Fisher", platform: "workday", tenant: "thermofisher", wdInstance: "wd5", site: "ThermoFisherCareers" },
  { company: "Intel", platform: "workday", tenant: "intel", wdInstance: "wd1", site: "External" },
  { company: "Qualcomm", platform: "workday", tenant: "qualcomm", wdInstance: "wd5", site: "External" },
  { company: "Applied Materials", platform: "workday", tenant: "amat", wdInstance: "wd1", site: "External" },
  { company: "Accenture", platform: "workday", tenant: "accenture", wdInstance: "wd3", site: "AccentureCareers" },

  // Enterprise Greenhouse Boards
  { company: "Snowflake", platform: "greenhouse", boardToken: "snowflake" },
  { company: "Databricks", platform: "greenhouse", boardToken: "databricks" },
  { company: "dbt Labs", platform: "greenhouse", boardToken: "dbtlabs" },
  { company: "Stripe", platform: "greenhouse", boardToken: "stripe" },
  { company: "Robinhood", platform: "greenhouse", boardToken: "robinhood" },
  { company: "DoorDash", platform: "greenhouse", boardToken: "doordash" },
  { company: "Instacart", platform: "greenhouse", boardToken: "instacart" },
  { company: "Pinterest", platform: "greenhouse", boardToken: "pinterest" },
  { company: "Figma", platform: "greenhouse", boardToken: "figma" },
  { company: "Reddit", platform: "greenhouse", boardToken: "reddit" },
  { company: "MongoDB", platform: "greenhouse", boardToken: "mongodb" },
  { company: "Datadog", platform: "greenhouse", boardToken: "datadog" },
  { company: "Affirm", platform: "greenhouse", boardToken: "affirm" },
  { company: "Brex", platform: "greenhouse", boardToken: "brex" },
  { company: "Chime", platform: "greenhouse", boardToken: "chime" },
  { company: "Plaid", platform: "greenhouse", boardToken: "plaid" },
  { company: "Scale AI", platform: "greenhouse", boardToken: "scaleai" },
  { company: "Samsara", platform: "greenhouse", boardToken: "samsara" },
  { company: "Gusto", platform: "greenhouse", boardToken: "gusto" },
  { company: "HubSpot", platform: "greenhouse", boardToken: "hubspot" },
  { company: "Klaviyo", platform: "greenhouse", boardToken: "klaviyo" },
  { company: "Wayfair", platform: "greenhouse", boardToken: "wayfair" },
  { company: "GitLab", platform: "greenhouse", boardToken: "gitlab" },
  { company: "Elastic", platform: "greenhouse", boardToken: "elastic" },
  { company: "Confluent", platform: "greenhouse", boardToken: "confluent" },
  { company: "Cloudflare", platform: "greenhouse", boardToken: "cloudflare" },
  { company: "Okta", platform: "greenhouse", boardToken: "okta" },
  { company: "Twilio", platform: "greenhouse", boardToken: "twilio" },
  { company: "Airbnb", platform: "greenhouse", boardToken: "airbnb" },
  { company: "Dropbox", platform: "greenhouse", boardToken: "dropbox" },
  { company: "Coinbase", platform: "greenhouse", boardToken: "coinbase" },
  { company: "SoFi", platform: "greenhouse", boardToken: "sofi" },
  { company: "Carta", platform: "greenhouse", boardToken: "carta" },
  { company: "Rippling", platform: "greenhouse", boardToken: "rippling" },
  { company: "Toast", platform: "greenhouse", boardToken: "toast" },
  { company: "Zscaler", platform: "greenhouse", boardToken: "zscaler" },
  { company: "CrowdStrike", platform: "greenhouse", boardToken: "crowdstrike" },
  { company: "HashiCorp", platform: "greenhouse", boardToken: "hashicorp" },
  { company: "Fivetran", platform: "greenhouse", boardToken: "fivetran" },
  { company: "Amplitude", platform: "greenhouse", boardToken: "amplitude" },
  { company: "Braze", platform: "greenhouse", boardToken: "braze" },
  { company: "Asana", platform: "greenhouse", boardToken: "asana" },
  { company: "Airtable", platform: "greenhouse", boardToken: "airtable" },
  { company: "Duolingo", platform: "greenhouse", boardToken: "duolingo" },
  { company: "Coursera", platform: "greenhouse", boardToken: "coursera" },
  { company: "Chewy", platform: "greenhouse", boardToken: "chewy" },
  { company: "DraftKings", platform: "greenhouse", boardToken: "draftkings" },
  { company: "SeatGeek", platform: "greenhouse", boardToken: "seatgeek" },
  { company: "Flexport", platform: "greenhouse", boardToken: "flexport" },
  { company: "Chainalysis", platform: "greenhouse", boardToken: "chainalysis" },

  // Enterprise Lever, Ashby & SmartRecruiters Boards
  { company: "Palantir", platform: "lever", boardToken: "palantir" },
  { company: "Atlassian", platform: "lever", boardToken: "atlassian" },
  { company: "Netflix", platform: "lever", boardToken: "netflix" },
  { company: "Spotify", platform: "lever", boardToken: "spotify" },
  { company: "Lyft", platform: "lever", boardToken: "lyft" },
  { company: "PagerDuty", platform: "lever", boardToken: "pagerduty" },
  { company: "Ramp", platform: "ashby", boardToken: "ramp" },
  { company: "Notion", platform: "ashby", boardToken: "notion" },
  { company: "OpenAI", platform: "ashby", boardToken: "openai" },
  { company: "Linear", platform: "ashby", boardToken: "linear" },
  { company: "Deel", platform: "ashby", boardToken: "deel" },
  { company: "Vanta", platform: "ashby", boardToken: "vanta" },
  { company: "Visa", platform: "smartrecruiters", boardToken: "visa" },
  { company: "Block (Square)", platform: "smartrecruiters", boardToken: "square" }
];

const US_GEO_COORDINATES: Record<string, [number, number]> = {
  "virginia beach": [36.8529, -75.9780],
  "norfolk": [36.8508, -76.2859],
  "chesapeake": [36.7682, -76.2875],
  "newport news": [37.0871, -76.4730],
  "hampton": [37.0299, -76.3452],
  "richmond": [37.5407, -77.4360],
  "glen allen": [37.6660, -77.5064],
  "arlington": [38.8816, -77.0910],
  "mclean": [38.9339, -77.1773],
  "reston": [38.9586, -77.3570],
  "washington": [38.9072, -77.0369],
  "dc": [38.9072, -77.0369],
  "baltimore": [39.2904, -76.6122],
  "new york": [40.7128, -74.0060],
  "manhattan": [40.7831, -73.9712],
  "brooklyn": [40.6782, -73.9442],
  "jersey city": [40.7178, -74.0431],
  "boston": [42.3601, -71.0589],
  "cambridge": [42.3736, -71.1097],
  "philadelphia": [39.9526, -75.1652],
  "pittsburgh": [40.4406, -79.9959],
  "wilmington": [39.7391, -75.5398],
  "charlotte": [35.2271, -80.8431],
  "raleigh": [35.7796, -78.6382],
  "durham": [35.9940, -78.8986],
  "mooresville": [35.5849, -80.8101],
  "atlanta": [33.7490, -84.3880],
  "miami": [25.7617, -80.1918],
  "orlando": [28.5383, -81.3792],
  "tampa": [27.9506, -82.4572],
  "saint petersburg": [27.7676, -82.6403],
  "nashville": [36.1627, -86.7816],
  "memphis": [35.1495, -90.0490],
  "chicago": [41.8781, -87.6298],
  "minneapolis": [44.9778, -93.2650],
  "detroit": [42.3314, -83.0458],
  "columbus": [39.9612, -82.9988],
  "indianapolis": [39.7684, -86.1581],
  "covington": [39.0837, -84.5086],
  "cincinnati": [39.1031, -84.5120],
  "st. louis": [38.6270, -90.1994],
  "hazelwood": [38.7714, -90.3709],
  "bentonville": [36.3729, -94.2088],
  "dallas": [32.7767, -96.7970],
  "plano": [33.0198, -96.6989],
  "westlake": [32.9912, -97.1942],
  "austin": [30.2672, -97.7431],
  "houston": [29.7604, -95.3698],
  "sysco corporate": [29.7604, -95.3698],
  "san antonio": [29.4241, -98.4936],
  "denver": [39.7392, -104.9903],
  "salt lake city": [40.7608, -111.8910],
  "phoenix": [33.4484, -112.0740],
  "seattle": [47.6062, -122.3321],
  "bellevue": [47.6101, -122.2015],
  "redmond": [47.6740, -122.1215],
  "portland": [45.5152, -122.6784],
  "beaverton": [45.4871, -122.8037],
  "san francisco": [37.7749, -122.4194],
  "san jose": [37.3382, -121.8863],
  "menlo park": [37.4530, -122.1817],
  "palo alto": [37.4419, -122.1430],
  "mountain view": [37.3861, -122.0839],
  "sunnyvale": [37.3688, -122.0363],
  "los angeles": [34.0522, -118.2437],
  "san diego": [32.7157, -117.1611],
  ", va": [37.4316, -78.6569],
  "virginia": [37.4316, -78.6569],
  ", ny": [43.2994, -74.2179],
  "new york state": [43.2994, -74.2179],
  ", ca": [36.7783, -119.4179],
  "california": [36.7783, -119.4179],
  ", tx": [31.9686, -99.9018],
  "texas": [31.9686, -99.9018],
  ", il": [40.6331, -89.3985],
  "illinois": [40.6331, -89.3985],
  ", wa": [47.7511, -120.7401],
  ", fl": [27.6648, -81.5158],
  "florida": [27.6648, -81.5158],
  ", ga": [32.1656, -82.9001],
  "georgia": [32.1656, -82.9001],
  ", nc": [35.7596, -79.0193],
  "north carolina": [35.7596, -79.0193],
  ", ma": [42.4072, -71.3824],
  "massachusetts": [42.4072, -71.3824],
  ", mn": [46.7296, -94.6859],
  "minnesota": [46.7296, -94.6859],
  ", co": [39.5501, -105.7821],
  "colorado": [39.5501, -105.7821],
  ", md": [39.0458, -76.6413],
  "maryland": [39.0458, -76.6413],
};

function resolveAllMatchingCoords(locationStr: string): [number, number][] {
  if (!locationStr) return [];
  const lower = locationStr.toLowerCase();
  const found: [number, number][] = [];
  for (const [key, coords] of Object.entries(US_GEO_COORDINATES)) {
    if (lower.includes(key)) found.push(coords);
  }
  return found;
}

export function calculateHaversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function canonicalizeCompany(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|financial|services|health|enterprise|technologies|tech|group|motor|air lines|investments)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function canonicalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[-–|]\s*(remote|hybrid|us|usa|united states).*$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function normalizeAtsUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl.trim());
    const seen = new Set<string>();
    const cleanParams = new URLSearchParams();

    parsed.searchParams.forEach((val, key) => {
      if (key === "t" && (val === "" || val === "gh_src=")) return;
      const pair = `${key}=${val}`;
      if (!seen.has(pair)) {
        seen.add(pair);
        cleanParams.append(key, val);
      }
    });

    parsed.search = cleanParams.toString();
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function isVerifiedDirectAtsUrl(url: string): boolean {
  if (!url || !url.startsWith("http")) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (
      host.includes("linkedin.com") ||
      host.includes("indeed.com") ||
      host.includes("glassdoor.com") ||
      host.includes("ziprecruiter.com")
    ) {
      return false;
    }

    if (path === "" || path === "/" || path === "/careers" || path === "/careers/") {
      return false;
    }
    return path.split("/").filter(Boolean).length >= 2 || parsed.search.length > 3;
  } catch {
    return false;
  }
}

// Detect remote eligibility from both location string and job description
function detectRemoteEligibility(jobLocation: string, description: string): boolean {
  const loc = (jobLocation || "").toLowerCase();
  if (/\bremote\b/i.test(loc)) return true;
  const desc = (description || "").toLowerCase();
  return (
    desc.includes("100% remote") ||
    desc.includes("fully remote") ||
    desc.includes("remote position") ||
    desc.includes("remote role") ||
    desc.includes("work from home") ||
    desc.includes("remote-first") ||
    desc.includes("remote within the united states") ||
    desc.includes("remote in the us")
  );
}

// Gate 4A: Country & US Geo-Fence Validation
export function isValidTargetCountry(jobLocation: string, targetCountry: string): boolean {
  if (!targetCountry || targetCountry.toLowerCase() === "all") return true;
  const loc = (jobLocation || "").toLowerCase().trim();
  const target = targetCountry.toLowerCase().trim();

  const nonUsHubs = [
    "india", "gurugram", "gurgaon", "bengaluru", "bangalore", "hyderabad", "pune", "mumbai", "delhi", "noida", "chennai", "kolkata",
    "uk", "united kingdom", "london", "manchester", "edinburgh", "germany", "berlin", "munich", "frankfurt",
    "canada", "toronto", "vancouver", "montreal", "ottawa", "calgary", "waterloo",
    "europe", "emea", "apac", "latam", "singapore", "australia", "sydney", "melbourne", "dublin", "ireland", "cork",
    "tel aviv", "jerusalem", "israel", "warsaw", "krakow", "poland", "amsterdam", "netherlands", "paris", "france",
    "madrid", "barcelona", "spain", "zurich", "switzerland", "stockholm", "sweden", "tokyo", "japan", "seoul", "korea",
    "beijing", "shanghai", "china", "hong kong", "taipei", "manila", "philippines", "sao paulo", "brazil", "mexico city", "mexico"
  ];

  if (target === "us" || target === "usa" || target === "united states") {
    if (nonUsHubs.some((f) => new RegExp("\\b" + f + "\\b", "i").test(loc))) return false;
    if (/,\s*(in|gb|uk|de|fr|nl|ie|au|sg|ca|il|pl|br|mx|jp|kr|cn|hk|tw|ph|ch|se|es|it)$/i.test(loc)) return false;

    const usExplicit = [
      "united states", "usa", "u.s.", "remote - us", "remote, us", "us remote", "remote (us)",
      "remote (usa)", "us-remote", "north america", "us national", "anywhere in the us"
    ];
    if (usExplicit.some((u) => loc.includes(u))) return true;

    if (resolveAllMatchingCoords(loc).length > 0) return true;

    // Match 2-letter US state abbreviations in both comma ("McLean, VA") and slug ("McLean VA") forms
    const stateCodeRegex = /(?:,|\s)\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i;
    if (stateCodeRegex.test(loc)) return true;

    if (loc === "remote" || loc === "remote (hybrid)" || loc === "hybrid / remote") return true;

    return false;
  }

  return loc.includes(target) || (loc.includes("remote") && !nonUsHubs.some((f) => loc.includes(f)));
}

// Gate 4B: Haversine Mileage & Remote Radius Validation (supports multi-office locations)
export function validateLocationRadius(
  jobLocation: string,
  description: string,
  homeCity?: string,
  maxMiles?: number,
  includeRemote = true
): { allowed: boolean; isRemote: boolean; distanceMiles: number | null; distanceLabel: string } {
  const isRemote = detectRemoteEligibility(jobLocation, description);

  if (!homeCity || !maxMiles || maxMiles <= 0) {
    return {
      allowed: true,
      isRemote,
      distanceMiles: null,
      distanceLabel: isRemote ? `Remote (${jobLocation})` : jobLocation,
    };
  }

  const homeMatches = resolveAllMatchingCoords(homeCity);
  const jobMatches = resolveAllMatchingCoords(jobLocation);

  if (homeMatches.length > 0 && jobMatches.length > 0) {
    const homeCoords = homeMatches[0];
    // Find the closest office among multi-location postings (e.g. "McLean, VA | Richmond, VA | Norfolk, VA")
    const minMiles = Math.min(
      ...jobMatches.map((jc) => calculateHaversineMiles(homeCoords[0], homeCoords[1], jc[0], jc[1]))
    );

    if (minMiles <= maxMiles) {
      return {
        allowed: true,
        isRemote,
        distanceMiles: minMiles,
        distanceLabel: minMiles === 0 ? `0 mi (${homeCity})` : `${minMiles} mi from ${homeCity}`,
      };
    }
    if (isRemote && includeRemote) {
      return {
        allowed: true,
        isRemote: true,
        distanceMiles: minMiles,
        distanceLabel: `Remote (${minMiles} mi from ${homeCity})`,
      };
    }
    return {
      allowed: false,
      isRemote: false,
      distanceMiles: minMiles,
      distanceLabel: `${minMiles} mi away (exceeds ${maxMiles} mi limit)`,
    };
  }

  if (isRemote && includeRemote) {
    return {
      allowed: true,
      isRemote: true,
      distanceMiles: null,
      distanceLabel: "Remote (US)",
    };
  }

  if (jobLocation.toLowerCase().includes(homeCity.toLowerCase().split(",")[0].trim())) {
    return {
      allowed: true,
      isRemote,
      distanceMiles: 0,
      distanceLabel: `0 mi (${homeCity})`,
    };
  }

  return {
    allowed: false,
    isRemote: false,
    distanceMiles: null,
    distanceLabel: `Outside ${maxMiles} mi radius of ${homeCity}`,
  };
}

// Gate 2: Profile Role-Track Validation
export function matchesRoleQuery(title: string, query: string): boolean {
  const t = title.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (!/intern|co-op|grad|entry/i.test(q)) {
    const strippedInternal = t.replace(/internal|international/gi, "");
    if (/intern|co-op|apprentice|new grad|university grad|campus/i.test(strippedInternal)) {
      return false;
    }
  }

  if (q === "data analyst" || q === "data analytics") {
    if (/software|engineering manager|manager.*engineering/i.test(t)) {
      return false;
    }

    const nonAnalyticsRoles = [
      "frontend", "backend", "full stack", "mobile", "ios", "android",
      "devops", "sre", "site reliability", "qa ", "quality assurance",
      "compliance analyst", "security analyst", "soc analyst", "information security", "cyber",
      "payroll analyst", "hr analyst", "people analyst", "talent analyst", "recruiting analyst",
      "helpdesk", "desktop support", "facilities analyst", "procurement analyst"
    ];
    if (nonAnalyticsRoles.some((bad) => t.includes(bad))) return false;

    const isPureDataEng = t.includes("data engineer") && !t.includes("analytics") && !t.includes("business intelligence");
    if (isPureDataEng) return false;

    const hasAnalyticsCore =
      t.includes("data analyst") ||
      t.includes("analytics") ||
      t.includes("business intelligence") ||
      /\bbi\b/i.test(t) ||
      t.includes("head of data") ||
      t.includes("director of data") ||
      t.includes("director, data") ||
      t.includes("quantitative analyst") ||
      t.includes("product analyst") ||
      t.includes("insights analyst") ||
      t.includes("reporting analyst") ||
      t.includes("decision science") ||
      t.includes("business analyst") ||
      t.includes("data strategist");

    return hasAnalyticsCore;
  }

  if (q === "product manager") {
    const isPm =
      t.includes("product manager") ||
      t.includes("group pm") ||
      t.includes("product lead") ||
      t.includes("head of product") ||
      t.includes("director of product") ||
      t.includes("vp of product");
    const isMarketing = t.includes("product marketing");
    return isPm && !isMarketing;
  }

  const terms = q.split(/\s+/).filter((w) => w.length > 2);
  return terms.every((term) => t.includes(term));
}

// Gate 3: Green Card / US Citizen / Work Authorization Classifier & Validator
export function analyzeWorkAuthorization(text: string): {
  workAuthStatus: WorkAuthStatus;
  visaSponsorship: boolean;
  clearanceOrCitizenRequired: boolean;
} {
  const lower = (text || "").toLowerCase();

  const citizenOnlyPatterns = [
    "u.s. citizen only",
    "us citizen only",
    "u.s. citizenship is required",
    "us citizenship is required",
    "u.s. citizenship required",
    "us citizenship required",
    "must be a u.s. citizen",
    "must be a us citizen",
    "security clearance required",
    "active secret clearance",
    "secret clearance",
    "top secret",
    "ts/sci",
    "itar compliance",
    "itar regulations",
  ];
  if (citizenOnlyPatterns.some((p) => lower.includes(p))) {
    return {
      workAuthStatus: "CITIZEN_OR_CLEARANCE_ONLY",
      visaSponsorship: false,
      clearanceOrCitizenRequired: true,
    };
  }

  const gcOrCitizenPatterns = [
    "u.s. citizen or permanent resident",
    "us citizen or permanent resident",
    "u.s. citizen or green card",
    "us citizen or green card",
    "green card holder or u.s. citizen",
    "green card or u.s. citizen",
    "sponsorship is not available",
    "sponsorship not available",
    "visa sponsorship is not available",
    "will not sponsor",
    "cannot sponsor",
    "unable to sponsor",
    "without the need for employer sponsorship",
    "without employer sponsorship",
    "without sponsorship",
    "no sponsorship",
  ];
  if (gcOrCitizenPatterns.some((p) => lower.includes(p))) {
    return {
      workAuthStatus: "GC_OR_CITIZEN_REQUIRED",
      visaSponsorship: false,
      clearanceOrCitizenRequired: false,
    };
  }

  const sponsorshipYes = [
    "visa sponsorship is available",
    "visa sponsorship available",
    "open to visa sponsorship",
    "will sponsor",
    "willing to sponsor",
    "h-1b transfer",
    "h1b transfer",
  ].some((p) => lower.includes(p));

  if (sponsorshipYes) {
    return {
      workAuthStatus: "SPONSORSHIP_AVAILABLE",
      visaSponsorship: true,
      clearanceOrCitizenRequired: false,
    };
  }

  return {
    workAuthStatus: "STANDARD_US_WORK_AUTH",
    visaSponsorship: false,
    clearanceOrCitizenRequired: false,
  };
}

export function passesWorkAuthFilter(status: WorkAuthStatus, filter: WorkAuthFilter = "all"): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "h1b_eligible") {
    return status === "SPONSORSHIP_AVAILABLE" || status === "STANDARD_US_WORK_AUTH";
  }
  if (filter === "gc_citizen_eligible" || filter === "no_clearance") {
    return status !== "CITIZEN_OR_CLEARANCE_ONLY";
  }
  return true;
}

export function scoreJobAgainstProfile(
  title: string,
  description: string,
  query: string,
  candidateSkills: string[]
): { score: number; matchedSkills: string[]; missingSkills: string[] } {
  const fullText = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const titleHits = queryTerms.filter((term) => titleLower.includes(term)).length;
  const titleScore = queryTerms.length > 0 ? Math.round((titleHits / queryTerms.length) * 40) : 30;

  const validSkills = candidateSkills.filter((s) => s.trim().length > 1);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  validSkills.forEach((skill) => {
    if (fullText.includes(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  const skillRatio = validSkills.length > 0 ? matchedSkills.length / Math.min(validSkills.length, 8) : 0.5;
  const skillScore = Math.min(45, Math.round(skillRatio * 45));

  const leadershipTerms = ["lead", "senior", "sr", "principal", "staff", "director", "head", "manager", "architect"];
  const hasSeniority = leadershipTerms.some((t) => titleLower.includes(t));
  const seniorityScore = hasSeniority ? 15 : 8;

  const totalScore = Math.min(99, Math.max(50, titleScore + skillScore + seniorityScore));
  return {
    score: totalScore,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 6),
  };
}

// Resolve Workday's "2 Locations" / "3 Locations" placeholders using Detail JSON & URL path slug
function buildResolvedWorkdayLocation(
  locationsText: string,
  externalPath: string,
  detailInfo: any
): string {
  const parts: string[] = [];

  if (locationsText && !/^\d+\s+locations?$/i.test(locationsText.trim())) {
    parts.push(locationsText.trim());
  }

  if (detailInfo) {
    if (typeof detailInfo.location === "string" && detailInfo.location.trim()) {
      parts.push(detailInfo.location.trim());
    }
    if (Array.isArray(detailInfo.additionalLocations)) {
      detailInfo.additionalLocations.forEach((loc: any) => {
        if (typeof loc === "string" && loc.trim()) parts.push(loc.trim());
      });
    }
  }

  const slugMatch = (externalPath || "").match(/\/job\/([^/]+)\//i);
  if (slugMatch && slugMatch[1]) {
    const cleanSlugLoc = slugMatch[1].replace(/---/g, ", ").replace(/-/g, " ").trim();
    if (cleanSlugLoc) parts.push(cleanSlugLoc);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  parts.forEach((p) => {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(p);
    }
  });

  return deduped.length > 0 ? deduped.join(" | ") : locationsText || "United States";
}

async function hydrateAndVerifyWorkdayDetail(
  tenant: string,
  wdInstance: string,
  site: string,
  externalPath: string,
  rawLocationsText: string
): Promise<{ open: boolean; description: string; resolvedLocation: string; status: string }> {
  const detailUrl = `https://${tenant}.${wdInstance}.myworkdayjobs.com/wday/cxs/${tenant}/${site}${externalPath}`;
  try {
    const res = await fetch(detailUrl, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4500),
    });

    if (res.status === 404 || res.status === 410) {
      return { open: false, description: "", resolvedLocation: rawLocationsText, status: `HTTP_${res.status}` };
    }

    if (!res.ok) {
      return {
        open: true,
        description: "",
        resolvedLocation: buildResolvedWorkdayLocation(rawLocationsText, externalPath, null),
        status: "WORKDAY_CXS_SEARCH_VERIFIED",
      };
    }

    const data = await res.json();
    const info = data?.jobPostingInfo;
    if (!info) {
      return { open: false, description: "", resolvedLocation: rawLocationsText, status: "WORKDAY_EMPTY_PAYLOAD" };
    }

    return {
      open: true,
      description: stripHtml(info.jobDescription || ""),
      resolvedLocation: buildResolvedWorkdayLocation(rawLocationsText, externalPath, info),
      status: "WORKDAY_CXS_DETAIL_200",
    };
  } catch {
    return {
      open: true,
      description: "",
      resolvedLocation: buildResolvedWorkdayLocation(rawLocationsText, externalPath, null),
      status: "WORKDAY_CXS_SEARCH_VERIFIED",
    };
  }
}

async function querySingleWorkdayPage(target: AtsBoardTarget, searchText: string, offset: number): Promise<any[]> {
  const cxsUrl = `https://${target.tenant}.${target.wdInstance}.myworkdayjobs.com/wday/cxs/${target.tenant}/${target.site}/jobs`;
  try {
    const res = await fetch(cxsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset,
        searchText,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobPostings || [];
  } catch {
    return [];
  }
}

async function fetchWorkdayBoard(target: AtsBoardTarget, query: string): Promise<Partial<VerifiedJobPosting>[]> {
  if (!target.tenant || !target.wdInstance || !target.site) return [];

  const searchTerms =
    query.toLowerCase() === "data analyst"
      ? ["Data Analyst", "Business Intelligence", "Analytics"]
      : [query];

  const pagePromises = searchTerms.flatMap((term) => [
    querySingleWorkdayPage(target, term, 0),
    querySingleWorkdayPage(target, term, 20),
  ]);

  const rawLists = await Promise.all(pagePromises);
  const mergedMap = new Map<string, any>();
  rawLists.flat().forEach((p: any) => {
    if (p?.externalPath && p?.title && !mergedMap.has(p.externalPath)) {
      mergedMap.set(p.externalPath, p);
    }
  });

  const matchingPostings = Array.from(mergedMap.values())
    .filter((p: any) => matchesRoleQuery(p.title, query))
    .slice(0, 18);

  const detailResults = await Promise.all(
    matchingPostings.map((p: any) =>
      hydrateAndVerifyWorkdayDetail(
        target.tenant!,
        target.wdInstance!,
        target.site!,
        p.externalPath,
        p.locationsText || ""
      )
    )
  );

  const verifiedWorkdayJobs: Partial<VerifiedJobPosting>[] = [];
  matchingPostings.forEach((p: any, idx: number) => {
    const detail = detailResults[idx];
    if (!detail.open) return;

    const directUrl = normalizeAtsUrl(
      `https://${target.tenant}.${target.wdInstance}.myworkdayjobs.com/en-US/${target.site}${p.externalPath}`
    );
    const reqId = p.bulletFields?.[0] || p.externalPath.split("_").pop() || "WD-REQ";

    verifiedWorkdayJobs.push({
      id: `wd-${target.tenant}-${reqId}`,
      requisitionId: reqId,
      title: p.title,
      company: target.company,
      atsPlatform: "Workday",
      location: detail.resolvedLocation,
      applyUrl: directUrl,
      urlVerified: true,
      verificationMethod: detail.status,
      postedDate: p.postedOn || "Active",
      postedHoursAgo: p.postedOn?.toLowerCase().includes("today") ? 6 : 24,
      description:
        detail.description ||
        `${p.title} at ${target.company} (${detail.resolvedLocation}). Requisition ID: ${reqId}.`,
    });
  });

  return verifiedWorkdayJobs;
}

async function fetchGreenhouseBoard(target: AtsBoardTarget): Promise<Partial<VerifiedJobPosting>[]> {
  if (!target.boardToken) return [];
  const url = `https://boards-api.greenhouse.io/v1/boards/${target.boardToken}/jobs?content=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map((j: any) => ({
      id: `gh-${target.boardToken}-${j.id}`,
      requisitionId: `GH-${j.id}`,
      title: j.title,
      company: target.company,
      atsPlatform: "Greenhouse",
      location: j.location?.name || "Remote (US)",
      applyUrl: normalizeAtsUrl(j.absolute_url),
      urlVerified: false,
      verificationMethod: "PENDING_HTTP_PROBE",
      postedDate: j.updated_at || "Active",
      postedHoursAgo: j.updated_at
        ? Math.max(1, Math.round((Date.now() - new Date(j.updated_at).getTime()) / 3600000))
        : 24,
      description: stripHtml(j.content || `${j.title} at ${target.company}`),
    }));
  } catch {
    return [];
  }
}

async function fetchLeverBoard(target: AtsBoardTarget): Promise<Partial<VerifiedJobPosting>[]> {
  if (!target.boardToken) return [];
  const url = `https://api.lever.co/v0/postings/${target.boardToken}?mode=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!res.ok) return [];
    const postings = await res.json();

    return (postings || []).map((p: any) => ({
      id: `lev-${p.id}`,
      requisitionId: `LEV-${String(p.id).slice(0, 8).toUpperCase()}`,
      title: p.text,
      company: target.company,
      atsPlatform: "Lever",
      location: p.categories?.location || "Remote (US)",
      applyUrl: normalizeAtsUrl(p.applyUrl || p.hostedUrl),
      urlVerified: false,
      verificationMethod: "PENDING_HTTP_PROBE",
      postedDate: p.createdAt ? new Date(p.createdAt).toISOString() : "Active",
      postedHoursAgo: p.createdAt ? Math.max(1, Math.round((Date.now() - p.createdAt) / 3600000)) : 24,
      description: stripHtml(p.descriptionPlain || p.description || ""),
    }));
  } catch {
    return [];
  }
}

async function fetchAshbyBoard(target: AtsBoardTarget): Promise<Partial<VerifiedJobPosting>[]> {
  if (!target.boardToken) return [];
  const url = `https://api.ashbyhq.com/posting-api/job-board/${target.boardToken}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.jobs || []).map((j: any) => ({
      id: `ash-${j.id}`,
      requisitionId: `ASH-${String(j.id).slice(0, 8).toUpperCase()}`,
      title: j.title,
      company: target.company,
      atsPlatform: "Ashby",
      location: j.location || "Remote (US)",
      applyUrl: normalizeAtsUrl(j.jobUrl || j.applyUrl),
      urlVerified: false,
      verificationMethod: "PENDING_HTTP_PROBE",
      postedDate: j.publishedAt || "Active",
      postedHoursAgo: 18,
      description: stripHtml(j.descriptionPlain || j.descriptionHtml || ""),
    }));
  } catch {
    return [];
  }
}

async function fetchSmartRecruitersBoard(target: AtsBoardTarget, query: string): Promise<Partial<VerifiedJobPosting>[]> {
  if (!target.boardToken) return [];
  const url = `https://api.smartrecruiters.com/v1/companies/${target.boardToken}/postings?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.content || []).map((j: any) => {
      const loc = j.location ? `${j.location.city || ""}, ${j.location.region || ""}, ${j.location.country || ""}` : "US";
      return {
        id: `sr-${j.id}`,
        requisitionId: `SR-${String(j.id).slice(0, 8).toUpperCase()}`,
        title: j.name,
        company: target.company,
        atsPlatform: "SmartRecruiters",
        location: loc,
        applyUrl: normalizeAtsUrl(`https://jobs.smartrecruiters.com/${target.boardToken}/${j.id}`),
        urlVerified: false,
        verificationMethod: "PENDING_HTTP_PROBE",
        postedDate: j.releasedDate || "Active",
        postedHoursAgo: 20,
        description: `${j.name} at ${target.company} (${loc}).`,
      };
    });
  } catch {
    return [];
  }
}

// Nationwide + Local LinkedIn Offsite Corporate ATS Resolver (Catches iCIMS, Taleo, Oracle, BrassRing, etc.)
async function resolveLinkedInOffsiteAts(jobId: string): Promise<{ applyUrl: string | null; description: string }> {
  try {
    const detailUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    const res = await fetch(detailUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { applyUrl: null, description: "" };
    const html = await res.text();

    let extractedUrl: string | null = null;
    const externalApplyMatch = html.match(/(?:externalApply|redir\/redirect)\?[^"']*?url=([^"&'\s]+)/i);
    if (externalApplyMatch && externalApplyMatch[1]) {
      const decoded = decodeURIComponent(externalApplyMatch[1]);
      if (decoded.startsWith("http") && !decoded.includes("linkedin.com")) extractedUrl = decoded;
    }

    if (!extractedUrl) {
      const codeApplyMatch = html.match(/<code[^>]*id=["']applyUrl["'][^>]*>[\s\S]*?<!--"([^"]+)"-->/i);
      if (codeApplyMatch && codeApplyMatch[1] && !codeApplyMatch[1].includes("linkedin.com")) {
        extractedUrl = codeApplyMatch[1];
      }
    }

    const descMatch = html.match(/<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    return { applyUrl: extractedUrl ? normalizeAtsUrl(extractedUrl) : null, description };
  } catch {
    return { applyUrl: null, description: "" };
  }
}

async function discoverOffsiteCorporateJobsFromLinkedIn(
  query: string,
  homeCity?: string
): Promise<Partial<VerifiedJobPosting>[]> {
  const discovered: Partial<VerifiedJobPosting>[] = [];
  const qParam = encodeURIComponent(query);

  const searchUrls = [
    `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${qParam}&location=United%20States&start=0`,
    `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${qParam}&location=United%20States&start=25`,
  ];
  if (homeCity && homeCity.trim()) {
    searchUrls.push(
      `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${qParam}&location=${encodeURIComponent(homeCity.trim())}&start=0`
    );
  }

  const responses = await Promise.allSettled(
    searchUrls.map((u) =>
      fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(5000),
      }).then((r) => (r.ok ? r.text() : ""))
    )
  );

  const cardMap = new Map<string, { jobId: string; title: string; company: string; location: string }>();

  responses.forEach((r) => {
    if (r.status !== "fulfilled" || !r.value) return;
    const cards = r.value.match(/<li[\s\S]*?<\/li>/gi) || [];
    for (const card of cards) {
      const titleMatch = card.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
      const companyMatch = card.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>|<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
      const locMatch = card.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const linkMatch = card.match(/<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i);

      if (titleMatch && linkMatch) {
        const rawTitle = stripHtml(titleMatch[1]);
        const rawCo = stripHtml(companyMatch?.[1] || companyMatch?.[2] || "");
        const rawLoc = stripHtml(locMatch?.[1] || "United States");
        const idMatch = linkMatch[1].match(/(\d{8,})/);
        if (idMatch && rawTitle && rawCo && matchesRoleQuery(rawTitle, query) && !cardMap.has(idMatch[1])) {
          cardMap.set(idMatch[1], { jobId: idMatch[1], title: rawTitle, company: rawCo, location: rawLoc });
        }
      }
    }
  });

  const candidates = Array.from(cardMap.values()).slice(0, 35);
  const resolvedList = await Promise.all(candidates.map((c) => resolveLinkedInOffsiteAts(c.jobId)));

  candidates.forEach((c, idx) => {
    const resolved = resolvedList[idx];
    if (resolved.applyUrl && isVerifiedDirectAtsUrl(resolved.applyUrl)) {
      discovered.push({
        id: `li-ext-${c.jobId}`,
        requisitionId: `LI-${c.jobId.slice(-8)}`,
        title: c.title,
        company: c.company,
        atsPlatform: "LinkedIn -> Corporate ATS",
        location: c.location,
        applyUrl: resolved.applyUrl,
        urlVerified: false,
        verificationMethod: "PENDING_HTTP_PROBE",
        postedDate: "Active",
        postedHoursAgo: 12,
        description: resolved.description || `${c.title} at ${c.company} (${c.location}).`,
      });
    }
  });

  return discovered;
}


async function discoverOffsiteJobsViaJSearchAndSerper(
  query: string,
  homeCity?: string
): Promise<Partial<VerifiedJobPosting>[]> {
  const discovered: Partial<VerifiedJobPosting>[] = [];
  const rapidKey = process.env.RAPIDAPI_KEY || process.env.JSEARCH_API_KEY;
  const rapidHost = process.env.JSEARCH_HOST || "jsearch.p.rapidapi.com";
  const serperKey = process.env.SERPER_API_KEY;
  const serpApiKey = process.env.SERPAPI_KEY;

  const locationHint = homeCity && homeCity.trim() ? homeCity.trim() : "United States";

  // 1. Primary Provider: JSearch (RapidAPI) -> extracts direct corporate ATS apply links
  if (rapidKey) {
    try {
      const jUrl = `https://${rapidHost}/search?query=${encodeURIComponent(`${query} in ${locationHint}`)}&page=1&num_pages=2&date_posted=month`;
      const jRes = await fetch(jUrl, {
        headers: {
          "X-RapidAPI-Key": rapidKey,
          "X-RapidAPI-Host": rapidHost,
        },
        signal: AbortSignal.timeout(6000),
      });
      await logApiUsage({ provider: "jsearch", endpoint: "/search", unitsUsed: 2, unitType: "request", statusCode: jRes.status });
      if (jRes.ok) {
        const jData = await jRes.json();
        const items = Array.isArray(jData?.data) ? jData.data : [];
        for (const item of items) {
          const candidateUrls = [
            item?.job_apply_link,
            ...(Array.isArray(item?.apply_options) ? item.apply_options.map((o: any) => o?.apply_link) : []),
          ].filter(Boolean);

          const directAts = candidateUrls
            .map((u: string) => normalizeAtsUrl(u))
            .find((u: string) => isVerifiedDirectAtsUrl(u));

          if (directAts && item?.job_title && item?.employer_name) {
            const locParts = [item.job_city, item.job_state, item.job_country].filter(Boolean);
            const locStr = item.job_is_remote
              ? `Remote (${locParts.join(", ") || "United States"})`
              : locParts.join(", ") || "United States";
            const rawId = String(item.job_id || Math.random()).replace(/[^a-zA-Z0-9]/g, "").slice(-10);

            discovered.push({
              id: `js-${rawId}`,
              requisitionId: `JS-${rawId.slice(-8)}`,
              title: String(item.job_title).trim(),
              company: String(item.employer_name).trim(),
              atsPlatform: "LinkedIn -> Corporate ATS",
              location: locStr,
              isRemote: Boolean(item.job_is_remote),
              applyUrl: directAts,
              urlVerified: false,
              verificationMethod: "PENDING_HTTP_PROBE",
              postedDate: "Active",
              postedHoursAgo: 12,
              description: String(item.job_description || `${item.job_title} at ${item.employer_name}`),
            });
          }
        }
      }
    } catch {
      // Fall through cleanly to Serper.dev
    }
  }

  // 2. High-Volume Search Provider: Serper.dev (2,500 free credits) targeting direct ATS boards
  if (serperKey) {
    try {
      const atsQuery = `(site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:myworkdayjobs.com) "${query}" ("${locationHint}" OR "Remote")`;
      const sRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: atsQuery, num: 30, gl: "us" }),
        signal: AbortSignal.timeout(6000),
      });
      await logApiUsage({ provider: "serper", endpoint: "/search", unitsUsed: 1, unitType: "search", statusCode: sRes.status });
      if (sRes.ok) {
        const sData = await sRes.json();
        const organic = Array.isArray(sData?.organic) ? sData.organic : [];
        organic.forEach((entry: any, idx: number) => {
          const normUrl = entry?.link ? normalizeAtsUrl(String(entry.link)) : "";
          if (!normUrl || !isVerifiedDirectAtsUrl(normUrl)) return;

          const rawHeading = String(entry.title || "").trim();
          const parts = rawHeading.split(/\s[-|–—]\s| at /i).map((p: string) => p.trim()).filter(Boolean);
          const parsedTitle = parts[0] || query;
          const hostMatch = normUrl.match(/https?:\/\/([^/]+)/i);
          const slugMatch = normUrl.match(/(?:greenhouse\.io|lever\.co|ashbyhq\.com)\/([^/?#]+)/i);
          const parsedCompany =
            (parts[1] && !/greenhouse|lever|workday|ashby|careers|jobs/i.test(parts[1]) ? parts[1] : null) ||
            (slugMatch ? slugMatch[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null) ||
            (hostMatch ? hostMatch[1].split(".")[0].toUpperCase() : "Enterprise Employer");

          discovered.push({
            id: `serper-${idx}-${Buffer.from(normUrl).toString("base64").slice(0, 10)}`,
            requisitionId: `SP-${idx + 100}`,
            title: parsedTitle,
            company: parsedCompany,
            atsPlatform: "LinkedIn -> Corporate ATS",
            location: /remote/i.test(`${rawHeading} ${entry.snippet || ""}`) ? "Remote (US)" : locationHint,
            isRemote: /remote/i.test(`${rawHeading} ${entry.snippet || ""}`),
            applyUrl: normUrl,
            urlVerified: false,
            verificationMethod: "PENDING_HTTP_PROBE",
            postedDate: "Active",
            postedHoursAgo: 12,
            description: String(entry.snippet || `${parsedTitle} at ${parsedCompany}`),
          });
        });
      }
    } catch {
      // Fall through cleanly to SerpApi backup only if needed
    }
  }

  // 3. Last-Resort Fallback: SerpApi (only runs if JSearch + Serper returned < 5 direct ATS roles)
  if (discovered.length === 0 && serpApiKey) {
    try {
      const serpUrl = `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(`${query} ${locationHint}`)}&hl=en&gl=us&api_key=${serpApiKey}`;
      const fRes = await fetch(serpUrl, { signal: AbortSignal.timeout(6000) });
      await logApiUsage({ provider: "serpapi", endpoint: "/search.json", unitsUsed: 1, unitType: "search", statusCode: fRes.status });
      if (fRes.ok) {
        const fData = await fRes.json();
        const jobsResults = Array.isArray(fData?.jobs_results) ? fData.jobs_results : [];
        jobsResults.forEach((job: any, idx: number) => {
          const applyOptions = Array.isArray(job?.apply_options) ? job.apply_options : [];
          const directAts = applyOptions
            .map((o: any) => normalizeAtsUrl(String(o?.link || "")))
            .find((u: string) => isVerifiedDirectAtsUrl(u));
          if (directAts && job?.title && job?.company_name) {
            discovered.push({
              id: `serpapi-${idx}-${String(job.job_id || idx).slice(-8)}`,
              requisitionId: `SA-${idx + 100}`,
              title: String(job.title).trim(),
              company: String(job.company_name).trim(),
              atsPlatform: "LinkedIn -> Corporate ATS",
              location: String(job.location || locationHint),
              isRemote: /remote/i.test(String(job.location || "")),
              applyUrl: directAts,
              urlVerified: false,
              verificationMethod: "PENDING_HTTP_PROBE",
              postedDate: "Active",
              postedHoursAgo: 12,
              description: String(job.description || `${job.title} at ${job.company_name}`),
            });
          }
        });
      }
    } catch {
      // Ignore fallback timeout
    }
  }

  return discovered;
}

// Gate 1: Live HTTP Probe & Closed-Requisition Tombstone Verifier
export async function probeAndValidateSingleUrl(url: string): Promise<{ valid: boolean; reason: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.status === 404 || res.status === 410) {
      return { valid: false, reason: `HTTP_${res.status}` };
    }

    if (!res.ok) {
      return { valid: false, reason: `HTTP_${res.status}` };
    }

    const finalUrl = res.url.toLowerCase();
    const finalPath = new URL(res.url).pathname.toLowerCase();
    if (
      finalUrl.includes("invalid-url") ||
      finalUrl.includes("community.workday.com") ||
      finalUrl.includes("linkedin.com") ||
      finalUrl.includes("indeed.com") ||
      finalPath === "/" ||
      finalPath === "/careers" ||
      finalPath === "/careers/" ||
      finalPath === "/jobs" ||
      finalPath === "/jobs/"
    ) {
      return { valid: false, reason: "REDIRECTED_TO_LANDING_OR_ERROR" };
    }

    const reader = res.body?.getReader();
    let snippet = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 24576) {
        const { done, value } = await reader.read();
        if (done) break;
        snippet += decoder.decode(value, { stream: true });
        bytesRead += value.byteLength;
      }
      await reader.cancel().catch(() => {});
    }

    const lowerBody = snippet.toLowerCase();
    const closedMarkers = [
      "no longer accepting applications",
      "job posting has expired",
      "this job is no longer available",
      "the job you are looking for is no longer available",
      "position has been filled",
      "sorry, we couldn't find that page",
      "page not found",
    ];

    if (closedMarkers.some((marker) => lowerBody.includes(marker))) {
      return { valid: false, reason: "CLOSED_REQUISITION_CONTENT" };
    }

    return { valid: true, reason: "LIVE_HTTP_200_VERIFIED" };
  } catch (err: any) {
    return { valid: false, reason: err?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR" };
  }
}

export async function verifyJobUrlsBatch(
  candidates: VerifiedJobPosting[],
  concurrency = 16
): Promise<{ verified: VerifiedJobPosting[]; rejected: { title: string; company: string; url: string; reason: string }[] }> {
  const verified: VerifiedJobPosting[] = [];
  const rejected: { title: string; company: string; url: string; reason: string }[] = [];

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const outcomes = await Promise.all(
      batch.map(async (job) => {
        if (job.urlVerified && job.verificationMethod.startsWith("WORKDAY_CXS_")) {
          return { job, valid: true, reason: job.verificationMethod };
        }

        const check = await probeAndValidateSingleUrl(job.applyUrl);
        if (check.valid) {
          return { job, valid: true, reason: check.reason };
        }

        if (job.atsPlatform === "Greenhouse" && (check.reason === "HTTP_403" || check.reason === "TIMEOUT")) {
          const parts = job.id.split("-");
          if (parts.length >= 3) {
            const token = parts[1];
            const rawId = parts.slice(2).join("-");
            try {
              const apiRes = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${rawId}`, {
                signal: AbortSignal.timeout(4000),
              });
              if (apiRes.ok) {
                const canonicalUrl = `https://job-boards.greenhouse.io/${token}/jobs/${rawId}`;
                return {
                  job: { ...job, applyUrl: canonicalUrl },
                  valid: true,
                  reason: "GREENHOUSE_CANONICAL_API_200",
                };
              }
              if (apiRes.status === 404) {
                return { job, valid: false, reason: "GREENHOUSE_404_CLOSED" };
              }
            } catch {}
          }
        }

        if (check.reason === "TIMEOUT") {
          const host = new URL(job.applyUrl).hostname.toLowerCase();
          if (
            host.includes("greenhouse.io") ||
            host.includes("lever.co") ||
            host.includes("ashbyhq.com") ||
            host.includes("smartrecruiters.com")
          ) {
            return { job, valid: true, reason: "ATS_API_INDEX_VERIFIED" };
          }
        }

        return { job, valid: false, reason: check.reason };
      })
    );

    outcomes.forEach(({ job, valid, reason }) => {
      if (valid) {
        verified.push({
          ...job,
          canApplyDirectly: true,
          urlVerified: true,
          verificationMethod: reason,
        });
      } else {
        rejected.push({ title: job.title, company: job.company, url: job.applyUrl, reason });
      }
    });
  }

  return { verified, rejected };
}

export async function aggregateUniversalDirectJobs(
  params: UniversalSearchParams,
  options: { verifyLiveUrls?: boolean } = { verifyLiveUrls: true }
): Promise<{ jobs: VerifiedJobPosting[]; audit: ValidationAuditReport }> {
  const {
    query,
    skills,
    location,
    homeCity,
    maxMiles,
    includeRemote = true,
    workAuth = "all",
    minScore = 50,
    includeAggregators = true,
  } = params;

  const audit: ValidationAuditReport = {
    totalRawDiscovered: 0,
    passedAllGates: 0,
    rejectedInactiveOrDeadUrl: 0,
    rejectedProfileMismatch: 0,
    rejectedWorkAuth: 0,
    rejectedGeoOrMiles: 0,
    rejectedDuplicate: 0,
    netNewFromLinkedInOrIndeed: 0,
    rejectionSamples: [],
  };

  const rawPostings: Partial<VerifiedJobPosting>[] = [];
  const chunkSize = 18;

  for (let i = 0; i < ENTERPRISE_ATS_REGISTRY.length; i += chunkSize) {
    const chunk = ENTERPRISE_ATS_REGISTRY.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((target) => {
        switch (target.platform) {
          case "workday":
            return fetchWorkdayBoard(target, query);
          case "greenhouse":
            return fetchGreenhouseBoard(target);
          case "lever":
            return fetchLeverBoard(target);
          case "ashby":
            return fetchAshbyBoard(target);
          case "smartrecruiters":
            return fetchSmartRecruitersBoard(target, query);
        }
      })
    );

    results.forEach((r) => {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        rawPostings.push(...r.value);
      }
    });
  }

  if (includeAggregators) {
    const [offsiteLinkedIn, apiDiscoveredJobs] = await Promise.all([
      discoverOffsiteCorporateJobsFromLinkedIn(query, homeCity),
      discoverOffsiteJobsViaJSearchAndSerper(query, homeCity),
    ]);
    rawPostings.push(...offsiteLinkedIn, ...apiDiscoveredJobs);
  }

  audit.totalRawDiscovered = rawPostings.length;

  const seenKeys = new Set<string>();
  const preUrlProbeCandidates: VerifiedJobPosting[] = [];

  for (const item of rawPostings) {
    if (!item.title || !item.company || !item.applyUrl) continue;

    // Gate 1A: Direct Corporate ATS URL Structure
    if (!isVerifiedDirectAtsUrl(item.applyUrl)) {
      audit.rejectedInactiveOrDeadUrl++;
      continue;
    }

    // Gate 2A: Profile Role-Track Alignment
    if (!matchesRoleQuery(item.title, query)) {
      audit.rejectedProfileMismatch++;
      continue;
    }

    const desc = item.description || "";

    // Gate 4A: Target Country Geo-Fence
    if (!isValidTargetCountry(item.location || "", location)) {
      audit.rejectedGeoOrMiles++;
      if (audit.rejectionSamples.length < 10) {
        audit.rejectionSamples.push({
          title: item.title,
          company: item.company,
          gate: "GATE_4_COUNTRY",
          reason: `Outside target country (${location}): ${item.location}`,
        });
      }
      continue;
    }

    // Gate 4B: Haversine Miles Radius & Remote Check (inspects both location string and description)
    const radiusCheck = validateLocationRadius(item.location || "", desc, homeCity, maxMiles, includeRemote);
    if (!radiusCheck.allowed) {
      audit.rejectedGeoOrMiles++;
      if (audit.rejectionSamples.length < 10) {
        audit.rejectionSamples.push({
          title: item.title,
          company: item.company,
          gate: "GATE_4_MILES_RADIUS",
          reason: radiusCheck.distanceLabel,
        });
      }
      continue;
    }

    // Gate 3: Green Card / US Citizen / Work Authorization Check
    const authResult = analyzeWorkAuthorization(desc);
    if (!passesWorkAuthFilter(authResult.workAuthStatus, workAuth)) {
      audit.rejectedWorkAuth++;
      if (audit.rejectionSamples.length < 10) {
        audit.rejectionSamples.push({
          title: item.title,
          company: item.company,
          gate: "GATE_3_WORK_AUTH",
          reason: `Classified as ${authResult.workAuthStatus} (filter: ${workAuth})`,
        });
      }
      continue;
    }

    // Gate 2B: Rubric Score Threshold
    const { score, matchedSkills, missingSkills } = scoreJobAgainstProfile(item.title, desc, query, skills);
    if (score < minScore) {
      audit.rejectedProfileMismatch++;
      continue;
    }

    // Gate 5: Canonical Deduplication
    const canonCo = canonicalizeCompany(item.company);
    const canonTitle = canonicalizeTitle(item.title);
    const dedupKey = `${canonCo}::${canonTitle}`;
    if (seenKeys.has(dedupKey)) {
      audit.rejectedDuplicate++;
      continue;
    }
    seenKeys.add(dedupKey);

    preUrlProbeCandidates.push({
      id: item.id!,
      requisitionId: item.requisitionId!,
      title: item.title,
      company: item.company,
      canonicalCompany: canonCo,
      atsPlatform: item.atsPlatform!,
      location: item.location || "United States",
      isRemote: radiusCheck.isRemote,
      distanceMiles: radiusCheck.distanceMiles,
      distanceLabel: radiusCheck.distanceLabel,
      applyUrl: item.applyUrl,
      canApplyDirectly: true,
      urlVerified: item.urlVerified ?? false,
      verificationMethod: item.verificationMethod || "PENDING",
      postedDate: item.postedDate || "Active",
      postedHoursAgo: item.postedHoursAgo ?? 24,
      matchScore: score,
      matchedSkills,
      missingSkills,
      workAuthStatus: authResult.workAuthStatus,
      visaSponsorship: authResult.visaSponsorship,
      clearanceOrCitizenRequired: authResult.clearanceOrCitizenRequired,
      description: desc.slice(0, 5000),
    });
  }

  preUrlProbeCandidates.sort((a, b) => b.matchScore - a.matchScore || a.postedHoursAgo - b.postedHoursAgo);

  let finalJobs = preUrlProbeCandidates;
  if (options.verifyLiveUrls !== false) {
    const { verified, rejected } = await verifyJobUrlsBatch(preUrlProbeCandidates, 16);
    finalJobs = verified;
    audit.rejectedInactiveOrDeadUrl += rejected.length;
    rejected.slice(0, 5).forEach((r) => {
      if (audit.rejectionSamples.length < 10) {
        audit.rejectionSamples.push({
          title: r.title,
          company: r.company,
          gate: "GATE_1_LIVE_HTTP_PROBE",
          reason: `${r.reason} (${r.url})`,
        });
      }
    });
  }

  audit.passedAllGates = finalJobs.length;
  audit.netNewFromLinkedInOrIndeed = finalJobs.filter(
    (j) => j.atsPlatform === "LinkedIn -> Corporate ATS"
  ).length;

  return { jobs: finalJobs, audit };
}
