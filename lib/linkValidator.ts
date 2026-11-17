export interface ValidationResult {
  valid: boolean;
  status: number;
  finalUrl: string;
}

export async function validateJobUrl(url: string, timeoutMs: number = 2500): Promise<ValidationResult> {
  if (!url || !url.startsWith("http")) {
    return { valid: false, status: 400, finalUrl: url };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // 1. Fast probe with HEAD
    let res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    }).catch(() => null);

    // 2. If server disallows HEAD (405) or returns 400/403 bot guard, try lightweight GET
    if (!res || res.status === 405 || res.status === 403 || res.status === 400) {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Range: "bytes=0-1024",
        },
        signal: controller.signal,
        redirect: "follow",
      }).catch(() => null);
    }

    clearTimeout(timer);

    if (res) {
      // 200-399 are valid; 403/429 mean the site is active but rate-limiting/blocking programmatic scrapers
      const isValid = (res.status >= 200 && res.status < 400) || res.status === 403 || res.status === 429;
      return {
        valid: isValid,
        status: res.status,
        finalUrl: res.url || url,
      };
    }

    return { valid: false, status: 504, finalUrl: url };
  } catch (err: any) {
    return { valid: false, status: 500, finalUrl: url };
  }
}
