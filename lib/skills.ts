import { SkillEvidence, WorkExperience, Confidence } from "./types";

export interface RawSkillMention {
  skillName: string;
  sourceRoleId?: string;
  sourceRoleTitle?: string;
  contextText?: string;
}

export interface ExplicitSkillStatement {
  skillName: string;
  statement: string;
}

export function escapeRegExp(s: string): string {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeSkill(skill: any): string {
  if (!skill) return "";
  if (typeof skill === "object") {
    const candidate = skill.name || skill.skill || skill.skillName || skill.title || "";
    return String(candidate).trim().toLowerCase();
  }
  return String(skill).trim().toLowerCase();
}

export const normalize = normalizeSkill;

export function skillMentionedIn(skill: string, texts: any[]): boolean {
  const normSkill = normalizeSkill(skill);
  if (!normSkill) return false;

  const flattenedText = texts
    .flatMap((t) => (Array.isArray(t) ? t : [t]))
    .map((t) => (typeof t === "string" ? t : String(t || "")))
    .join(" ")
    .toLowerCase();

  if (!flattenedText.trim()) return false;

  try {
    const escaped = escapeRegExp(normSkill);
    const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, "i");
    return regex.test(flattenedText);
  } catch {
    return flattenedText.includes(normSkill);
  }
}

function calculateConfidence(roleCount: number, hasExplicitStatement: boolean): Confidence {
  if (roleCount >= 2 || (roleCount >= 1 && hasExplicitStatement)) return "High";
  if (roleCount === 1 || hasExplicitStatement) return "Medium";
  return "Low";
}

export function buildSkillEvidence(
  rawMentions: RawSkillMention[],
  explicitStatements: ExplicitSkillStatement[],
  workExperience: WorkExperience[]
): SkillEvidence[] {
  const evidenceMap = new Map<
    string,
    {
      displayName: string;
      sourceRoleIds: Set<string>;
      evidence: Set<string>;
      hasExplicitStatement: boolean;
    }
  >();

  const safeMentions = Array.isArray(rawMentions) ? rawMentions : [];
  const safeWork = Array.isArray(workExperience) ? workExperience : [];
  const safeStatements = Array.isArray(explicitStatements) ? explicitStatements : [];

  for (const raw of safeMentions) {
    const cleanName = normalizeSkill(raw.skillName);
    if (!cleanName || cleanName.length < 2) continue;

    const displayName =
      typeof raw.skillName === "string" && raw.skillName.trim().length > 0
        ? raw.skillName.trim()
        : cleanName;

    const supportingRoleIds: string[] = [];

    for (const exp of safeWork) {
      const resp = Array.isArray(exp.responsibilities) ? exp.responsibilities : [exp.responsibilities];
      const ach = Array.isArray(exp.achievements) ? exp.achievements : [exp.achievements];
      const tech = Array.isArray(exp.technologies) ? exp.technologies : [exp.technologies];

      if (skillMentionedIn(cleanName, [...resp, ...ach, ...tech, exp.jobTitle])) {
        if (exp.id) supportingRoleIds.push(exp.id);
      }
    }

    if (raw.sourceRoleId && !supportingRoleIds.includes(raw.sourceRoleId)) {
      supportingRoleIds.push(raw.sourceRoleId);
    }

    let entry = evidenceMap.get(cleanName);
    if (!entry) {
      entry = {
        displayName,
        sourceRoleIds: new Set<string>(),
        evidence: new Set<string>(),
        hasExplicitStatement: false,
      };
      evidenceMap.set(cleanName, entry);
    }

    supportingRoleIds.forEach((id) => entry!.sourceRoleIds.add(id));
    if (raw.contextText) {
      entry.evidence.add(raw.contextText);
    }
  }

  for (const stmt of safeStatements) {
    const cleanName = normalizeSkill(stmt.skillName);
    if (!cleanName) continue;

    let entry = evidenceMap.get(cleanName);
    if (!entry) {
      entry = {
        displayName: stmt.skillName.trim() || cleanName,
        sourceRoleIds: new Set<string>(),
        evidence: new Set<string>(),
        hasExplicitStatement: true,
      };
      evidenceMap.set(cleanName, entry);
    } else {
      entry.hasExplicitStatement = true;
    }

    if (stmt.statement) {
      entry.evidence.add(stmt.statement);
    }
  }

  const result: SkillEvidence[] = [];
  for (const [, val] of evidenceMap.entries()) {
    const roleIds = Array.from(val.sourceRoleIds);
    result.push({
      skillName: val.displayName,
      yearsOfExperience: null,
      monthsOfExperience: null,
      confidence: calculateConfidence(roleIds.length, val.hasExplicitStatement),
      evidence: Array.from(val.evidence),
      sourceRoleIds: roleIds,
    });
  }

  return result;
}
