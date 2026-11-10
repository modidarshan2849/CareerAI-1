"use client";

import { ExperienceBreakdown } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Two states, one component:
 *
 * 1. needsUserConfirmation === true: the system genuinely can't tell which
 *    direction is current. We show the exact required prompt and let the
 *    person pick, highlighting recommendedDomain (if any signal exists)
 *    without ever auto-selecting it.
 *
 * 2. needsUserConfirmation === false: the system IS confident (currentDomain
 *    is set), but the person can still change it at any time — confirming a
 *    domain is never a one-way door.
 */
export function CareerDirectionControl({ breakdown }: { breakdown: ExperienceBreakdown }) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  async function confirmDomain(domain: string) {
    setSaving(domain);
    await fetch("/api/profile/confirm-domain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    setSaving(null);
    setChanging(false);
    router.refresh();
  }

  if (breakdown.needsUserConfirmation) {
    return (
      <section className="card border-verdigris/30 bg-verdigris-light/50">
        <p className="font-medium mb-1">
          Your career history spans multiple areas. Which direction should CareerAI use when
          calculating relevant experience and recommending roles?
        </p>
        <p className="text-sm text-slate mb-4">
          We won&apos;t guess — pick the direction that reflects where you&apos;re headed.
        </p>
        {breakdown.detectedDomains.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {breakdown.detectedDomains.map((domain) => {
              const isRecommended = domain === breakdown.recommendedDomain;
              return (
                <button
                  key={domain}
                  onClick={() => confirmDomain(domain)}
                  disabled={saving !== null}
                  className={isRecommended ? "btn-primary !py-2 !px-3 text-sm" : "btn-secondary !py-2 !px-3 text-sm"}
                >
                  {saving === domain ? "Saving…" : domain}
                  {isRecommended && !saving && " (recommended)"}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-light">
            We couldn&apos;t classify your most recent role at all — please confirm or correct it on the{" "}
            <a href="/profile/review" className="text-verdigris hover:underline">
              profile review
            </a>{" "}
            page.
          </p>
        )}
      </section>
    );
  }

  if (!breakdown.currentDomain) return null;

  return (
    <div className="flex items-center gap-2 text-sm mb-2">
      <span className="text-slate-light">Current direction:</span>
      <span className="font-medium">{breakdown.currentDomain}</span>
      {!changing && (
        <button onClick={() => setChanging(true)} className="text-verdigris hover:underline text-xs">
          Change
        </button>
      )}
      {changing && (
        <div className="flex items-center gap-2 flex-wrap">
          {(breakdown.detectedDomains.length > 0 ? breakdown.detectedDomains : [breakdown.currentDomain]).map(
            (domain) => (
              <button
                key={domain}
                onClick={() => confirmDomain(domain)}
                disabled={saving !== null}
                className="btn-secondary !py-1 !px-2 text-xs"
              >
                {saving === domain ? "Saving…" : domain}
              </button>
            )
          )}
          <button onClick={() => setChanging(false)} className="text-xs text-slate-light hover:underline">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
