import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROVIDER_CONFIGS, ProviderKey } from "@/lib/usageTelemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const adminKey = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedKey = req.headers.get("x-admin-key") || searchParams.get("key");

  if (adminKey && providedKey !== adminKey) {
    return NextResponse.json({ error: "Unauthorized admin telemetry access" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsedDays = Math.max(1, (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));

  const { data: logs } = await supabase
    .from("api_usage_logs")
    .select("provider, units_used, estimated_prod_usd, user_id, created_at")
    .gte("created_at", monthStart.toISOString());

  const rows = logs || [];

  const breakdown = (Object.keys(PROVIDER_CONFIGS) as ProviderKey[]).map((key) => {
    const cfg = PROVIDER_CONFIGS[key];
    const providerRows = rows.filter((r) => r.provider === key);
    const mtdUsed = providerRows.reduce((acc, r) => acc + Number(r.units_used || 0), 0);
    const pctUsed = Number(((mtdUsed / cfg.monthlyFreeLimit) * 100).toFixed(1));
    const dailyRunRate = mtdUsed / elapsedDays;
    const forecastMonthUnits = Math.round(dailyRunRate * daysInMonth);
    const forecastPct = Number(((forecastMonthUnits / cfg.monthlyFreeLimit) * 100).toFixed(1));

    // Production equivalent cost (if paying standard pay-as-you-go rates without dev credits)
    const mtdProdEquivUsd = Number((mtdUsed * cfg.prodUnitCostUsd).toFixed(2));
    const forecastProdEquivUsd = Number((forecastMonthUnits * cfg.prodUnitCostUsd).toFixed(2));

    // 1,000-user projection:
    // Shared ingestion pools scale ~3x (broader role tracks), whereas user-triggered AI/DB scales 1,000x per active user
    const activeUsersCount = Math.max(
      1,
      new Set(providerRows.filter((r) => r.user_id !== "system_cron").map((r) => r.user_id)).size
    );
    const scaleFactor = cfg.isSharedPool ? 3 : 1000 / activeUsersCount;
    const projected1kUsersUnits = Math.round(forecastMonthUnits * scaleFactor);
    const projected1kUsersUsd = Number((projected1kUsersUnits * cfg.prodUnitCostUsd).toFixed(2));

    return {
      provider: key,
      label: cfg.label,
      unitLabel: cfg.unitLabel,
      monthlyFreeLimit: cfg.monthlyFreeLimit,
      mtdUsed,
      pctUsed,
      forecastMonthUnits,
      forecastPct,
      mtdProdEquivUsd,
      forecastProdEquivUsd,
      projected1kUsersUnits,
      projected1kUsersUsd,
      scalingModel: cfg.isSharedPool ? "Shared Cron Pool (3x tracks)" : "Per-User Activity (1,000x)",
    };
  });

  // Base fixed infrastructure in prod (Vercel Pro $20 + Supabase Pro $25)
  const fixedInfraUsd = 45;
  const totalMtdProdEquivUsd = Number(
    breakdown.reduce((s, b) => s + b.mtdProdEquivUsd, 0).toFixed(2)
  );
  const totalForecastProdEquivUsd = Number(
    (breakdown.reduce((s, b) => s + b.forecastProdEquivUsd, 0) + fixedInfraUsd).toFixed(2)
  );
  const total1kUsersProdUsd = Number(
    (breakdown.reduce((s, b) => s + b.projected1kUsersUsd, 0) + fixedInfraUsd).toFixed(2)
  );

  return NextResponse.json({
    month: monthStart.toISOString().slice(0, 7),
    elapsedDays: Number(elapsedDays.toFixed(1)),
    daysInMonth,
    summary: {
      totalMtdProdEquivUsd,
      totalForecastProdEquivUsd,
      total1kUsersProdUsd,
      perUserMonthlyCostAt1k: Number((total1kUsersProdUsd / 1000).toFixed(3)),
    },
    breakdown,
  });
}
