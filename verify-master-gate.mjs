function evaluateMasterGate(job) {
  const gates = [];

  const g1Passed = typeof job.score === "number" && job.score >= 80;
  gates.push({ gate: 1, name: "Score (80+)", passed: g1Passed });

  const kw = Array.isArray(job.keywords) ? job.keywords.map(k => k.toLowerCase()) : [];
  const g2Passed = kw.includes("snowflake") && kw.includes("python");
  gates.push({ gate: 2, name: "Keywords (Snowflake+Python)", passed: g2Passed });

  const g3Passed = typeof job.experience_years === "number" && job.experience_years >= 5;
  gates.push({ gate: 3, name: "Seniority (5+ yrs)", passed: g3Passed });

  const g4Passed = Boolean(job.id && job.title && job.company && (job.status ?? "active") === "active");
  gates.push({ gate: 4, name: "Schema Integrity", passed: g4Passed });

  const masterPassed = gates.length === 4 && gates.every(g => g.passed === true);
  gates.push({ gate: 5, name: "MASTER GATE", passed: masterPassed });

  return { id: job.id, title: job.title, masterPassed, gates };
}

const sampleJobs = [
  { id: "JOB-101", title: "Senior Data Analyst II", company: "Enterprise Corp", score: 92, experience_years: 7, keywords: ["Snowflake", "Python", "SQL"], status: "active" },
  { id: "JOB-102", title: "Data Analyst (Low Score)", company: "Acme Inc", score: 74, experience_years: 6, keywords: ["Snowflake", "Python"], status: "active" },
  { id: "JOB-103", title: "Lead BI Analyst (Missing Python)", company: "TechFlow", score: 88, experience_years: 8, keywords: ["Snowflake", "Tableau"], status: "active" },
  { id: "JOB-104", title: "Junior Data Analyst (<5 yrs)", company: "StartupXY", score: 85, experience_years: 2, keywords: ["Snowflake", "Python"], status: "active" }
];

console.log("\n=== MASTER GATE VALIDATION MATRIX ===");
for (const job of sampleJobs) {
  const res = evaluateMasterGate(job);
  const gateSummary = res.gates.map(g => `G${g.gate}:${g.passed ? "✅" : "❌"}`).join(" | ");
  console.log(`${res.masterPassed ? "🟢 APPROVED" : "🔴 BLOCKED "} [${res.id}] ${res.title}`);
  console.log(`   └─ ${gateSummary}\n`);
}
