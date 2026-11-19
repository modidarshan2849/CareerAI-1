import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serpApiKey = process.env.SERPAPI_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" }
});

const ROLE_REGEX = /\b(data analyst|data engineer|business intelligence|bi analyst|bi developer|bi engineer|analytics engineer|data scientist|decision science|decision scientist|product analyst|marketing analyst|financial analyst|operations analyst|operations research|risk analyst|data strategy|insights analyst|reporting analyst|quantitative analyst|analytics manager|data analytics manager|lead analyst|principal analyst|senior analyst|sr\.?\s*(data|bi|analytics)|supply chain analyst|commercial analytics|data governance|data quality|data architect|data modeler)\b/i;
const EXCLUDE_REGEX = /\b(intern|internship|co-op|student worker|part-time|part time|entry level|junior|jr\.|associate analyst|recruiter|counsel|registered nurse|mechanic|driver|janitor|warehouse associate)\b/i;
const DIRECTORY_REGEX = /(simplyhired\.com\/q-|ziprecruiter\.com\/Jobs\/|indeed\.com\/q-|glassdoor\.com\/Job\/|linkedin\.com\/jobs\/search|google\.com\/goto|top\s+\d+.*jobs)/i;
const EXPIRED_REGEX = /\b(no longer accepting applications|this job is no longer available|position has been filled|requisition has been closed|job posting has expired|sorry, this job was not found|the job you are looking for is no longer open|application period has ended)\b/i;
const NON_US_REGEX = /\b(india|mohali|bengaluru|bangalore|hyderabad|pune|mumbai|canada|ontario|british columbia|toronto|vancouver|mexico|abu dhabi|united arab emirates|brussels|belgium|uk|united kingdom|london|germany|berlin|france|paris|australia|singapore|japan|brazil|poland|ireland|spain|netherlands|israel)\b/i;
const HAS_US_OR_REMOTE_REGEX = /\b(united states|u\.s\.|usa|remote\s*-?\s*(us|u\.s\.a\.|united states)|virginia|va\b|chesterfield|richmond|norfolk|virginia beach|arlington|mclean|reston|tysons|washington,\s*dc|\bdc\b|maryland|\bmd\b)\b/i;

const NO_SPONSOR_REGEX = /\b(will not sponsor|does not sponsor|cannot sponsor|unable to sponsor|no visa sponsorship|without visa sponsorship|without sponsorship|sponsorship is not available|not eligible for visa sponsorship|must be legally authorized.*without.*sponsorship|us citizen|u\.s\. citizen|united states citizenship|green card|permanent resident|security clearance|secret clearance|top secret|ts\/sci|public trust clearance)\b/i;
const YES_SPONSOR_REGEX = /\b(visa sponsorship available|sponsorship is available|will sponsor|willing to sponsor|provides visa sponsorship|h-?1b sponsorship|sponsorship provided|eligible for sponsorship)\b/i;
const TRUSTED_JOB_HOSTS = /(greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|usajobs\.gov|myworkdayjobs\.com|icims\.com|taleo\.net|brassring\.com|capitalonecareers\.com|careers\.spglobal\.com|careers\.mckesson\.com|linkedin\.com\/jobs\/view|indeed\.com\/viewjob|remotive\.com|arbeitnow\.com|remoteok\.com)/i;

function cleanUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    const tracking = [
      "gh_jid", "gh_src", "t", "source", "ss", "utm_source", "utm_medium",
      "utm_campaign", "utm_content", "utm_term", "gclid", "gad_source",
      "gad_campaignid", "trk", "refId", "trackingId", "RD", "eBP", "ref"
    ];
    for (const p of tracking) u.searchParams.delete(p);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    const qs = u.searchParams.toString();
    return `${u.origin}${cleanPath}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}

function makeUniqueId(baseId, url, usedIds) {
  let candidate = (baseId || "job").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  const hash = crypto.createHash("sha256").update(`${baseId}::${url}`).digest("hex").slice(0, 12);
  candidate = `${candidate.slice(0, 46)}-${hash}`;
  let n = 1;
  while (usedIds.has(candidate)) {
    candidate = `${candidate.slice(0, 42)}-${hash}-${n++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function roleSignature(company, title, zone) {
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(company)}::${norm(title)}::${norm(zone)}`;
}

function linkPriority(url) {
  if (!url) return 0;
  if (/linkedin\.com|indeed\.com|ziprecruiter\.com/i.test(url)) return 1;
  return 2; // Direct employer / ATS portal wins over aggregator duplicate
}

function pickBestApplyLink(applyOptions = []) {
  if (!Array.isArray(applyOptions) || applyOptions.length === 0) return null;
  const direct = applyOptions.find((o) => o.link && !/linkedin\.com|indeed\.com|ziprecruiter\.com|simplyhired\.com|glassdoor\.com|bebee\.com|talent\.com/i.test(o.link));
  if (direct) return { link: cleanUrl(direct.link), via: direct.title || "Direct Employer Portal" };
  const li = applyOptions.find((o) => o.link && /linkedin\.com/i.test(o.link));
  if (li) return { link: cleanUrl(li.link), via: "LinkedIn" };
  const ind = applyOptions.find((o) => o.link && /indeed\.com/i.test(o.link));
  if (ind) return { link: cleanUrl(ind.link), via: "Indeed" };
  const fallback = applyOptions.find((o) => o.link && !/bebee\.com|talent\.com/i.test(o.link));
  return fallback ? { link: cleanUrl(fallback.link), via: fallback.title || "Job Board" } : null;
}

async function fetchGoogleJobsPages(q, location, maxPages = 2) {
  const results = [];
  let nextPageToken = null;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      engine: "google_jobs",
      q,
      hl: "en",
      gl: "us",
      api_key: serpApiKey
    });
    if (location) params.set("location", location);
    if (nextPageToken) params.set("next_page_token", nextPageToken);
    try {
      const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!res.ok) break;
      const data = await res.json();
      if (data.error) break;
      const jobs = data.jobs_results || [];
      results.push(...jobs);
      nextPageToken = data.serpapi_pagination?.next_page_token || null;
      if (!nextPageToken || jobs.length === 0) break;
    } catch {
      break;
    }
  }
  return results;
}

function classifySponsorship(text, source) {
  if (/usajobs|federal/i.test(source || "")) {
    return { code: "NO_SPONSORSHIP", status: "US Citizen Only (Federal / No Sponsorship)" };
  }
  if (NO_SPONSOR_REGEX.test(text)) {
    return { code: "NO_SPONSORSHIP", status: "US Citizen / Green Card Only (No Sponsorship)" };
  }
  if (YES_SPONSOR_REGEX.test(text)) {
    return { code: "SPONSORSHIP_AVAILABLE", status: "Visa / Green Card Sponsorship Available" };
  }
  return { code: "NOT_SPECIFIED", status: "Not Specified / Open" };
}

async function verifyLiveRow(job) {
  const title = job.title || "";
  const loc = job.location || "";
  const normUrl = cleanUrl(job.url || "");

  if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(`${title} ${job.work_mode || ""}`)) {
    return { valid: false, reason: "OFF_TARGET_ROLE" };
  }
  if (NON_US_REGEX.test(loc) && !HAS_US_OR_REMOTE_REGEX.test(loc)) {
    return { valid: false, reason: "NON_US_LOCATION" };
  }
  if (!normUrl || DIRECTORY_REGEX.test(`${normUrl} ${title}`)) {
    return { valid: false, reason: "NON_REQUISITION_URL" };
  }

  const isTrustedHost = TRUSTED_JOB_HOSTS.test(normUrl);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(normUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    clearTimeout(timer);

    if (res.status === 404 || res.status === 410 || res.status >= 500) {
      return { valid: false, reason: `HTTP_${res.status}` };
    }

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

    if (EXPIRED_REGEX.test(text)) {
      return { valid: false, reason: "EXPIRED_OR_CLOSED" };
    }

    const finalUrl = cleanUrl(res.url || normUrl) || normUrl;
    if (/^https?:\/\/[^/]+\/(careers\/?$|careers\/search\/?$)/i.test(finalUrl)) {
      return { valid: false, reason: "REDIRECTED_TO_PORTAL_ROOT" };
    }

    const hasSignal =
      isTrustedHost ||
      TRUSTED_JOB_HOSTS.test(finalUrl) ||
      /\b(apply|application|job description|qualifications|responsibilities|requisition|position)\b/i.test(text);

    if (!hasSignal && text.length < 300) {
      return { valid: false, reason: "NO_APPLICATION_TARGET" };
    }

    const sponsorship = classifySponsorship(`${title} ${job.description || ""} ${text.slice(0, 12000)}`, job.source);
    let confidence = Number(job.score || 88);
    if (linkPriority(finalUrl) === 2) confidence += 4;
    if (sponsorship.code !== "NOT_SPECIFIED") confidence += 2;
    else confidence -= 3;
    if (/senior|sr\.|lead|principal|staff|manager|director|architect/i.test(title)) confidence += 2;
    confidence = Math.max(60, Math.min(99, confidence));

    return {
      valid: true,
      row: {
        ...job,
        url: finalUrl,
        sponsorship_code: sponsorship.code,
        sponsorship_status: sponsorship.status,
        last_verified_at: new Date().toISOString()
      },
      confidence,
      verdict: sponsorship.code === "NOT_SPECIFIED" ? "VALID (Verify Sponsorship)" : "VALID"
    };
  } catch {
    // Allow known trusted ATS/portal URLs if transiently rate-limited, otherwise drop
    if (isTrustedHost && (job.description || "").length > 120) {
      const sponsorship = classifySponsorship(`${title} ${job.description || ""}`, job.source);
      return {
        valid: true,
        row: {
          ...job,
          url: normUrl,
          sponsorship_code: sponsorship.code,
          sponsorship_status: sponsorship.status,
          last_verified_at: new Date().toISOString()
        },
        confidence: 86,
        verdict: "VALID (Verify Sponsorship)"
      };
    }
    return { valid: false, reason: "FETCH_ERROR_OR_TIMEOUT" };
  }
}

async function run() {
  // Step 1: Expand remaining title families via Google Jobs
  if (serpApiKey) {
    const extraTitleSearches = [
      { q: "Business Intelligence Analyst OR BI Developer", location: "Virginia, United States", pages: 2 },
      { q: "Business Intelligence Analyst Remote", location: "United States", pages: 2 },
      { q: "Data Architect OR Data Governance", location: "Virginia, United States", pages: 2 },
      { q: "Product Analyst OR Risk Analyst OR Quantitative Analyst", location: "Virginia, United States", pages: 2 },
      { q: "Data Analytics Manager OR Analytics Manager", location: "Virginia, United States", pages: 2 },
      { q: "Analytics Engineer Remote", location: "United States", pages: 2 }
    ];

    const newRaw = [];
    for (const s of extraTitleSearches) {
      const items = await fetchGoogleJobsPages(s.q, s.location, s.pages);
      console.log(`   • google_jobs ["${s.q}" | ${s.location}]: ${items.length}`);
      newRaw.push(...items);
    }

    const { data: existingAll } = await supabase.from("verified_jobs").select("id, url").range(0, 4999);
    const urlToId = new Map();
    const usedIds = new Set();
    for (const r of existingAll || []) {
      const c = cleanUrl(r.url || "");
      if (c) urlToId.set(c, r.id);
      if (r.id) usedIds.add(r.id);
    }

    const toInsert = new Map();
    let addedNew = 0;

    for (const item of newRaw) {
      const title = (item.title || "").trim();
      const company = (item.company_name || "").trim();
      const loc = (item.location || "United States").trim();
      if (!ROLE_REGEX.test(title) || EXCLUDE_REGEX.test(`${title} ${item.detected_extensions?.schedule_type || ""}`)) continue;
      if (DIRECTORY_REGEX.test(`${title} ${company}`)) continue;

      const best = pickBestApplyLink(item.apply_options);
      if (!best || !best.link || DIRECTORY_REGEX.test(best.link)) continue;
      if (toInsert.has(best.link)) continue;

      const isRemote = /remote|anywhere/i.test(`${loc} ${title}`);
      const isVA = /\b(va|virginia|chesterfield|richmond|norfolk|virginia beach|arlington|mclean|reston|tysons|washington,\s*dc|dc|maryland|md)\b/i.test(loc);
      const existingId = urlToId.get(best.link);
      const baseId = `gjobs-${crypto.createHash("md5").update(best.link).digest("hex").slice(0, 12)}`;
      const id = existingId || makeUniqueId(baseId, best.link, usedIds);

      toInsert.set(best.link, {
        id,
        req_id: (item.job_id || "GJ").slice(0, 24),
        title,
        company: company || "Employer",
        location: loc,
        url: best.link,
        score: 90,
        is_remote: isRemote,
        miles_from_home: isVA ? 20 : isRemote ? 0 : 150,
        work_mode: isRemote ? "Remote" : "Hybrid",
        zone: isVA ? "Virginia / DMV" : isRemote ? "US Remote" : "US National",
        sponsorship_status: "Not Specified / Open",
        sponsorship_code: "NOT_SPECIFIED",
        posted_label: item.detected_extensions?.posted_at || "Recent",
        last_date: "Rolling / Until Filled",
        keywords: ["SQL", "Python", "Analytics"],
        salary_range: item.detected_extensions?.salary || "$135,000 - $185,000 / yr",
        source: `${best.via} (Google Jobs)`,
        description: (item.description || "").slice(0, 3200),
        is_active: true,
        last_verified_at: new Date().toISOString()
      });
      if (!existingId) addedNew++;
    }

    const batchRows = Array.from(toInsert.values());
    for (let i = 0; i < batchRows.length; i += 25) {
      const chunk = batchRows.slice(i, i + 25);
      const { error } = await supabase.from("verified_jobs").upsert(chunk, { onConflict: "url" });
      if (error) {
        for (const r of chunk) {
          const retryId = makeUniqueId(`${r.id}-t`, r.url, usedIds);
          await supabase.from("verified_jobs").upsert({ ...r, id: retryId }, { onConflict: "url" });
        }
      }
    }
    console.log(`➕ Added ${addedNew} net-new postings from expanded title searches.`);
  }

  // Step 2: Load all active records, deduplicate across URL + (Company + Title + Zone)
  const activeRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from("verified_jobs").select("*").eq("is_active", true).range(from, from + 499);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    activeRows.push(...data);
    if (data.length < 500) break;
    from += 500;
  }

  console.log(`\n📥 Loaded ${activeRows.length} active rows for full cross-title validation.`);

  // Sort so direct ATS/employer links beat LinkedIn/Indeed duplicates for the same role
  activeRows.sort((a, b) => linkPriority(b.url) - linkPriority(a.url));

  const seenUrls = new Set();
  const seenSignatures = new Set();
  const dedupedRows = [];
  const dupIds = [];

  for (const r of activeRows) {
    const cUrl = cleanUrl(r.url || "");
    const sig = roleSignature(r.company, r.title, r.zone);
    if (!cUrl || seenUrls.has(cUrl) || (r.company && seenSignatures.has(sig))) {
      dupIds.push(r.id);
      continue;
    }
    seenUrls.add(cUrl);
    if (r.company) seenSignatures.add(sig);
    dedupedRows.push({ ...r, url: cUrl });
  }

  if (dupIds.length > 0) {
    for (let i = 0; i < dupIds.length; i += 50) {
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", dupIds.slice(i, i + 50));
    }
    console.log(`🔁 Deactivated ${dupIds.length} duplicate URL / cross-board postings.`);
  }

  // Step 3: Live HTTP & content validation
  const validEntries = [];
  const invalidIds = [];
  const reasons = {};
  const sponsorSplit = { SPONSORSHIP_AVAILABLE: 0, NO_SPONSORSHIP: 0, NOT_SPECIFIED: 0 };

  for (let i = 0; i < dedupedRows.length; i += 15) {
    const slice = dedupedRows.slice(i, i + 15);
    const results = await Promise.all(slice.map((j) => verifyLiveRow(j)));
    results.forEach((res, idx) => {
      if (res.valid) {
        validEntries.push({ row: res.row, confidence: res.confidence, verdict: res.verdict });
        sponsorSplit[res.row.sponsorship_code] = (sponsorSplit[res.row.sponsorship_code] || 0) + 1;
      } else {
        invalidIds.push(slice[idx].id);
        reasons[res.reason] = (reasons[res.reason] || 0) + 1;
      }
    });
    process.stdout.write(`   Audited ${Math.min(i + 15, dedupedRows.length)} / ${dedupedRows.length}...\r`);
  }

  if (invalidIds.length > 0) {
    for (let i = 0; i < invalidIds.length; i += 50) {
      await supabase.from("verified_jobs").update({ is_active: false }).in("id", invalidIds.slice(i, i + 50));
    }
  }

  for (let i = 0; i < validEntries.length; i += 25) {
    const chunk = validEntries.slice(i, i + 25);
    await Promise.all(
      chunk.map(({ row }) =>
        supabase
          .from("verified_jobs")
          .update({
            url: row.url,
            sponsorship_code: row.sponsorship_code,
            sponsorship_status: row.sponsorship_status,
            last_verified_at: row.last_verified_at
          })
          .eq("id", row.id)
      )
    );
  }

  // Step 4: Title family breakdown & audit export
  const titleFamilies = {};
  for (const { row } of validEntries) {
    const t = row.title || "";
    let bucket = "Other Data / Analytics";
    if (/data scientist|decision scien/i.test(t)) bucket = "Data Scientist / Decision Science";
    else if (/data engineer|analytics engineer/i.test(t)) bucket = "Data / Analytics Engineer";
    else if (/business intelligence|\bbi\b/i.test(t)) bucket = "BI Analyst / Engineer";
    else if (/architect|governance|modeler/i.test(t)) bucket = "Data Architect / Governance";
    else if (/manager|director|head/i.test(t)) bucket = "Analytics Manager / Lead";
    else if (/data analyst|product analyst|risk analyst|financial analyst|operations|quantitative|insights|reporting/i.test(t)) bucket = "Senior / Lead Data Analyst";
    titleFamilies[bucket] = (titleFamilies[bucket] || 0) + 1;
  }

  console.log("\n\n📋 Full Multi-Title Audit Summary:");
  console.log(`   • Valid & Active:   ${validEntries.length}`);
  console.log(`   • Deactivated:      ${invalidIds.length + dupIds.length}`);
  console.log("   • Title Breakdown:", titleFamilies);
  if (Object.keys(reasons).length > 0) console.log("   • Failure Reasons:", reasons);
  console.log("   • Sponsorship Split:", sponsorSplit);

  const mdLines = [
    `# CareerAI v2.6 — Full Multi-Title Audited Active Jobs (${validEntries.length} Roles)`,
    "",
    "| # | Company | Role Title | Location / Mode | Visa Sponsorship | Audit Status | Confidence % | Direct Application Link |",
    "|---|---|---|---|---|---|---|---|"
  ];
  const csvLines = [
    "Index,Company,Role Title,Location,Work Mode,Visa Sponsorship,Audit Status,Confidence %,Direct Application URL"
  ];

  validEntries.sort((a, b) => b.confidence - a.confidence).forEach((entry, idx) => {
    const { row, confidence, verdict } = entry;
    const n = idx + 1;
    const comp = (row.company || "").replace(/\|/g, "-").trim();
    const title = (row.title || "").replace(/\|/g, "-").trim();
    const locMode = `${(row.location || "US").trim()} (${row.work_mode || "Hybrid"})`.replace(/\|/g, "-");
    const sponsor = (row.sponsorship_status || "Not Specified / Open").replace(/\|/g, "-");

    mdLines.push(`| ${n} | ${comp} | ${title} | ${locMode} | ${sponsor} | ${verdict} | **${confidence}%** | [Apply Direct](${row.url}) |`);
    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    csvLines.push([n, esc(row.company), esc(row.title), esc(row.location), esc(row.work_mode), esc(row.sponsorship_status), esc(verdict), `${confidence}%`, esc(row.url)].join(","));
  });

  fs.writeFileSync("verified-v2.6-audit.md", mdLines.join("\n"), "utf8");
  fs.writeFileSync("verified-v2.6-audit.csv", csvLines.join("\n"), "utf8");
  console.log("✅ Updated verified-v2.6-audit.md and verified-v2.6-audit.csv");
}

run();
