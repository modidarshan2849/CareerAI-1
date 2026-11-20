import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function detectAtsProvider(careerUrl: string): {
  provider: string;
  config: Record<string, string>;
} {
  const lower = careerUrl.toLowerCase();

  if (lower.includes("myworkdayjobs.com")) {
    try {
      const parsed = new URL(careerUrl);
      const tenant = parsed.hostname.split(".")[0] ?? "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      const site = parts[parts.length - 1] ?? "";
      return {
        provider: "workday",
        config: { origin: parsed.origin, tenant, site },
      };
    } catch {
      return { provider: "workday", config: {} };
    }
  }

  if (lower.includes("greenhouse.io")) {
    const token = lower.split("greenhouse.io/")[1]?.split("/")[0] ?? "";
    return { provider: "greenhouse", config: { boardToken: token } };
  }

  if (lower.includes("lever.co")) {
    const parts = lower.split("lever.co/")[1]?.split("/") ?? [];
    const companySlug = parts[0] === "v0" ? "" : parts[0] ?? "";
    return { provider: "lever", config: { companySlug } };
  }

  if (lower.includes("eightfold.ai")) {
    return { provider: "eightfold", config: { careerUrl } };
  }

  return { provider: "google_jobs", config: { careerUrl } };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const companyName = String(body.company_name ?? "").trim();
    const careerUrl = String(body.career_url ?? "").trim();
    const cohort = String(body.cohort ?? "Custom").trim() || "Custom";

    if (!companyName || !careerUrl) {
      return NextResponse.json(
        { error: "company_name and career_url are required" },
        { status: 400 }
      );
    }

    const parsedUrl = new URL(careerUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "career_url must use http or https" },
        { status: 400 }
      );
    }

    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const detected = detectAtsProvider(parsedUrl.toString());

    const { data, error } = await supabase
      .from("tracked_companies")
      .upsert(
        {
          company_name: companyName,
          slug,
          cohort,
          career_url: parsedUrl.toString(),
          ats_provider: body.ats_provider || detected.provider,
          ats_endpoint_config: detected.config,
          added_by: user.id,
          is_global: false,
          sync_status: "pending",
        },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ company: data }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
