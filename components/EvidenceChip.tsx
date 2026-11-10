import { Confidence } from "@/lib/types";

interface EvidenceChipProps {
  confidence: Confidence | "Experience not established";
  label?: string;
}

/**
 * The visual embodiment of the product's core rule: nothing is shown as a
 * fact without a visible confidence level attached. "Experience not
 * established" renders identically in weight to "High" — it is not hidden
 * or de-emphasized into invisibility, because unknown is a real, honest
 * answer, not a failure state to bury.
 */
export function EvidenceChip({ confidence, label }: EvidenceChipProps) {
  const variant =
    confidence === "High"
      ? "evidence-chip--high"
      : confidence === "Medium"
      ? "evidence-chip--medium"
      : confidence === "Low"
      ? "evidence-chip--low"
      : "evidence-chip--none";

  return (
    <span className={`evidence-chip ${variant}`}>
      {confidence === "Experience not established" ? "Unverified" : confidence}
      {label ? ` · ${label}` : ""}
    </span>
  );
}
