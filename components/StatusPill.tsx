import { MatchStatus } from "@/lib/types";

const LABELS: Record<MatchStatus, string> = {
  GREEN: "Strong opportunity",
  AMBER: "Worth reviewing",
  RED: "Excluded",
};

export function StatusPill({ status }: { status: MatchStatus }) {
  const variant =
    status === "GREEN" ? "status-pill--green" : status === "AMBER" ? "status-pill--amber" : "status-pill--red";
  const dot = status === "GREEN" ? "🟢" : status === "AMBER" ? "🟠" : "🔴";

  return (
    <span className={`status-pill ${variant}`}>
      <span aria-hidden="true">{dot}</span>
      {LABELS[status]}
    </span>
  );
}
