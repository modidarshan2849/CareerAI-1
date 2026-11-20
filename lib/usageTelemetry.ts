import { createClient } from "@supabase/supabase-js";

export type ProviderKey = "serper" | "jsearch" | "serpapi" | "usajobs" | "gemini" | "bedrock" | "anthropic" | "stripe" | "supabase";

export interface ProviderQuotaConfig {
  label: string;
  unitLabel: string;
  monthlyFreeLimit: number;
  prodUnitCostUsd: number; // Cost per 1 unit once free tier is exceeded
  isSharedPool: boolean;   // true = shared across all users (cron), false = scales per user
}

export const PROVIDER_CONFIGS: Record<ProviderKey, ProviderQuotaConfig> = {
  serper: {
    label: "Serper.dev (Google Search)",
    unitLabel: "credits",
    monthlyFreeLimit: 2500,
    prodUnitCostUsd: 0.001, // ~$1.00 per 1,000 queries ($50/50k)
    isSharedPool: true,
  },
  jsearch: {
    label: "JSearch (RapidAPI)",
    unitLabel: "requests",
    monthlyFreeLimit: 500, // Basic tier monthly cap (adjust to your plan)
    prodUnitCostUsd: 0.0025, // ~$25 / 10,000 requests on Pro
    isSharedPool: true,
  },
  serpapi: {
    label: "SerpApi (Fallback)",
    unitLabel: "searches",
    monthlyFreeLimit: 172, // Remaining search credits
    prodUnitCostUsd: 0.015, // ~$75 / 5,000 searches
    isSharedPool: true,
  },
  gemini: {
    label: "Google Gemini (Tailoring & Embeddings)",
    unitLabel: "1K tokens",
    monthlyFreeLimit: 15000, // Free tier token allowance equivalent
    prodUnitCostUsd: 0.00015, // Gemini Flash blended rate per 1K tokens
    isSharedPool: false,
  },
  bedrock: {
    label: "AWS Bedrock (Claude/Titan Fallback)",
    unitLabel: "1K tokens",
    monthlyFreeLimit: 1000,
    prodUnitCostUsd: 0.0008,
    isSharedPool: false,
  },
  supabase: {
    label: "Supabase (DB & Edge Reads)",
    unitLabel: "API calls",
    monthlyFreeLimit: 500000,
    prodUnitCostUsd: 0.000002, // Pro base $25/mo + overages
    isSharedPool: false,
  },
  usajobs: {
    label: "USAJOBS Federal Jobs API",
    unitLabel: "requests",
    monthlyFreeLimit: 10000,
    prodUnitCostUsd: 0,
    isSharedPool: true,
  },
  anthropic: {
    label: "Anthropic Claude (Resume & Profile AI)",
    unitLabel: "1K tokens",
    monthlyFreeLimit: 1000,
    prodUnitCostUsd: 0.003,
    isSharedPool: false,
  },
  stripe: {
    label: "Stripe Billing & Subscriptions API",
    unitLabel: "requests",
    monthlyFreeLimit: 100000,
    prodUnitCostUsd: 0,
    isSharedPool: false,
  },
};

export async function logApiUsage(params: {
  provider: ProviderKey;
  endpoint: string;
  unitsUsed?: number;
  unitType?: "search" | "tokens" | "request";
  userId?: string;
  statusCode?: number;
}) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const units = params.unitsUsed ?? 1;
    const cfg = PROVIDER_CONFIGS[params.provider];
    const estimatedProdUsd = Number((units * cfg.prodUnitCostUsd).toFixed(6));

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabase.from("api_usage_logs").insert({
      provider: params.provider,
      endpoint: params.endpoint,
      units_used: units,
      unit_type: params.unitType ?? "request",
      estimated_prod_usd: estimatedProdUsd,
      user_id: params.userId ?? "system_cron",
      status_code: params.statusCode ?? 200,
    });
  } catch {
    // Non-blocking telemetry: never break core app flows
  }
}
