import React from "react";
import { createClient } from "@supabase/supabase-js";
import { PROVIDER_CONFIGS, ProviderKey } from "@/lib/usageTelemetry";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

  if (adminSecret && params?.key !== adminSecret) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-2">
          <h1 className="text-lg font-bold text-white">Restricted Admin Telemetry</h1>
      <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900">
        <span>USAJOBS API: Requires <code>USAJOBS_API_KEY</code> &amp; <code>USAJOBS_USER_AGENT</code> in env</span>
      </div>
          <p className="text-xs text-slate-400">
            Append <code className="text-indigo-400">?key=YOUR_ADMIN_SECRET</code> to view API quotas, forecasts, and production cost projections.
          </p>
        </div>
      </div>
    );
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
  const metrics = (Object.keys(PROVIDER_CONFIGS) as ProviderKey[]).map((key) => {
    const cfg = PROVIDER_CONFIGS[key];
    const providerRows = rows.filter((r) => r.provider === key);
    const mtdUsed = providerRows.reduce((acc, r) => acc + Number(r.units_used || 0), 0);
    const pctUsed = Number(((mtdUsed / cfg.monthlyFreeLimit) * 100).toFixed(1));
    const forecastMonthUnits = Math.round((mtdUsed / elapsedDays) * daysInMonth);
    const forecastPct = Number(((forecastMonthUnits / cfg.monthlyFreeLimit) * 100).toFixed(1));
    const mtdProdUsd = Number((mtdUsed * cfg.prodUnitCostUsd).toFixed(2));
    const forecastProdUsd = Number((forecastMonthUnits * cfg.prodUnitCostUsd).toFixed(2));

    const scaleFactor = cfg.isSharedPool ? 3 : 1000;
    const proj1kUnits = Math.round(forecastMonthUnits * scaleFactor);
    const proj1kUsd = Number((proj1kUnits * cfg.prodUnitCostUsd).toFixed(2));

    return { key, cfg, mtdUsed, pctUsed, forecastMonthUnits, forecastPct, mtdProdUsd, forecastProdUsd, proj1kUnits, proj1kUsd };
  });

  const fixedHostingUsd = 45; // Vercel Pro ($20) + Supabase Pro ($25)
  const totalMtdUsd = metrics.reduce((s, m) => s + m.mtdProdUsd, 0);
  const totalForecastUsd = metrics.reduce((s, m) => s + m.forecastProdUsd, 0) + fixedHostingUsd;
  const total1kUsersUsd = metrics.reduce((s, m) => s + m.proj1kUsd, 0) + fixedHostingUsd;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white">CareerAI-1 • Internal API Usage &amp; FinOps Telemetry</h1>
            <p className="text-xs text-slate-400">
              MTD Window: {monthStart.toISOString().slice(0, 10)} → Today (Day {elapsedDays.toFixed(1)} of {daysInMonth})
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Admin Only • Live Supabase Meter
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-semibold">MTD Prod-Equivalent Spend</div>
            <div className="text-2xl font-extrabold text-white mt-1">${totalMtdUsd.toFixed(2)}</div>
            <div className="text-[11px] text-slate-400 mt-1">Covered by free tiers / dev credits right now</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-semibold">Indicative Month-End Forecast (1 User)</div>
            <div className="text-2xl font-extrabold text-indigo-400 mt-1">${totalForecastUsd.toFixed(2)} / mo</div>
            <div className="text-[11px] text-slate-400 mt-1">Includes $45/mo Vercel Pro + Supabase Pro baseline</div>
          </div>
          <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4">
            <div className="text-xs text-indigo-300 font-semibold">Projected Prod Cost @ 1,000 Active Users</div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">${total1kUsersUsd.toFixed(2)} / mo</div>
            <div className="text-[11px] text-slate-400 mt-1">
              ~${(total1kUsersUsd / 1000).toFixed(2)} per user/month (shared job pool + per-user AI)
            </div>
          </div>
        </div>

        {/* Provider Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Provider / Service</th>
                <th className="py-3 px-4">MTD Used</th>
                <th className="py-3 px-4">% of Free Tier</th>
                <th className="py-3 px-4">EOM Forecast</th>
                <th className="py-3 px-4">MTD Prod $</th>
                <th className="py-3 px-4">EOM Prod $</th>
                <th className="py-3 px-4">1,000 Users Prod $/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {metrics.map((m) => (
                <tr key={m.key} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-semibold text-white">{m.cfg.label}</td>
                  <td className="py-3 px-4">
                    {m.mtdUsed.toLocaleString()} / {m.cfg.monthlyFreeLimit.toLocaleString()} {m.cfg.unitLabel}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        m.pctUsed >= 85
                          ? "bg-rose-500/20 text-rose-300"
                          : m.pctUsed >= 50
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {m.pctUsed}%
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {m.forecastMonthUnits.toLocaleString()} ({m.forecastPct}%)
                  </td>
                  <td className="py-3 px-4">${m.mtdProdUsd.toFixed(2)}</td>
                  <td className="py-3 px-4 text-indigo-300 font-semibold">${m.forecastProdUsd.toFixed(2)}</td>
                  <td className="py-3 px-4 text-emerald-400 font-bold">${m.proj1kUsd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
