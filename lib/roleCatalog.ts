import { RoleDefinition } from "./roles";

/**
 * V0.1 starter catalog. Intentionally small and manually curated rather
 * than generated — every entry needs real coreSkills for the career-
 * direction guard and evidence gating in lib/roles.ts to mean anything.
 * Expanding this list is safe: it never needs its own logic, since
 * suggestRoles() in lib/roles.ts is the single source of truth for how
 * these get filtered, tiered, and guarded against downgrades.
 */
export const ROLE_CATALOG: RoleDefinition[] = [
  // Data & Analytics track
  { role: "Data Analyst", coreSkills: ["SQL", "Excel", "Data Visualization"], niceToHaveSkills: ["Python", "Tableau"], minYearsForBestFit: 1 },
  { role: "Senior Data Analyst", coreSkills: ["SQL", "Excel", "Data Visualization"], niceToHaveSkills: ["Python", "Tableau"], minYearsForBestFit: 3 },
  { role: "Analytics Manager", coreSkills: ["SQL", "Data Visualization", "Stakeholder Management"], niceToHaveSkills: ["Python"], minYearsForBestFit: 4 },
  { role: "Data Scientist", coreSkills: ["Python", "SQL", "Machine Learning"], niceToHaveSkills: ["R", "Statistics"], minYearsForBestFit: 2 },

  // Software Engineering track
  { role: "Software Engineer", coreSkills: ["JavaScript", "Git"], niceToHaveSkills: ["React", "Node.js"], minYearsForBestFit: 1 },
  { role: "Senior Software Engineer", coreSkills: ["JavaScript", "Git", "System Design"], niceToHaveSkills: ["React", "Node.js"], minYearsForBestFit: 3 },
  { role: "Engineering Manager", coreSkills: ["System Design", "Stakeholder Management"], niceToHaveSkills: ["JavaScript"], minYearsForBestFit: 4 },
  { role: "Staff Software Engineer", coreSkills: ["System Design", "JavaScript"], niceToHaveSkills: ["Node.js"], minYearsForBestFit: 5 },

  // Product & Project Management track
  { role: "Project Manager", coreSkills: ["Stakeholder Management", "Scheduling"], niceToHaveSkills: ["Agile"], minYearsForBestFit: 1 },
  { role: "Senior Project Manager", coreSkills: ["Stakeholder Management", "Scheduling"], niceToHaveSkills: ["Agile"], minYearsForBestFit: 3 },
  { role: "Program Manager", coreSkills: ["Stakeholder Management", "Scheduling", "Cross-functional Leadership"], niceToHaveSkills: ["Agile"], minYearsForBestFit: 4 },

  // Marketing track
  { role: "Marketing Specialist", coreSkills: ["SEO", "Content Strategy"], niceToHaveSkills: ["Analytics"], minYearsForBestFit: 1 },
  { role: "Senior Marketing Manager", coreSkills: ["SEO", "Content Strategy", "Stakeholder Management"], niceToHaveSkills: ["Analytics"], minYearsForBestFit: 3 },
];
