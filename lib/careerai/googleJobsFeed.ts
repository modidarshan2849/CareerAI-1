export interface GoogleJobRaw {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  apply_options?: Array<{ link?: string; title?: string }>;
  share_link?: string;
}

export interface NormalizedEnterpriseJob {
  job_id: string;
  source_company: string;
  canonical_job_id: string;
  title: string;
  apply_url: string | null;
}

export function resolveDirectApplyUrl(raw: GoogleJobRaw): string | null {
  const options = raw.apply_options ?? [];
  const nonAggregator = options.find((opt) => {
    const link = opt.link?.toLowerCase() ?? "";
    return (
      link.startsWith("http") &&
      !link.includes("linkedin.com") &&
      !link.includes("indeed.com") &&
      !link.includes("ziprecruiter.com") &&
      !link.includes("glassdoor.com")
    );
  });

  return nonAggregator?.link ?? options[0]?.link ?? raw.share_link ?? null;
}

export function normalizeGoogleJob(
  raw: GoogleJobRaw,
  fallbackCompany: string
): NormalizedEnterpriseJob | null {
  const title = raw.title?.trim();
  if (!title) return null;

  const company = (raw.company_name || fallbackCompany).trim();
  const slugCompany = company.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const baseId = (raw.job_id || `${slugCompany}-${title}-${raw.location ?? ""}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 120);

  return {
    job_id: `gjobs:${slugCompany}:${baseId}`,
    source_company: company,
    canonical_job_id: raw.job_id ?? baseId,
    title,
    apply_url: resolveDirectApplyUrl(raw),
  };
}
