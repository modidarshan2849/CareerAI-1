import fs from "fs";

let code = fs.readFileSync("add-top500-and-feeds.mjs", "utf8");

code = code.replace(
  'const { data: existingRows } = await supabase.from("verified_jobs").select("id, url");',
  'const { data: existingRows } = await supabase.from("verified_jobs").select("id, url").range(0, 4999);'
);

const oldUpsertBlock = `  const merged = [...gh, ...lever, ...ashby, ...arbeitnow, ...remoteok];
  const dedup = new Map();
  const usedIds = new Set();
  let netNew = 0;

  for (const item of merged) {
    const normUrl = item.url.replace(/\\/$/, "");
    if (dedup.has(normUrl)) continue;

    let safeId = urlToId.get(normUrl) || item.id;
    if (!urlToId.has(normUrl) && (existingIds.has(safeId) || usedIds.has(safeId))) {
      safeId = \`\${safeId}-\${Buffer.from(normUrl).toString("base64url").slice(-8)}\`;
    }
    usedIds.add(safeId);

    dedup.set(normUrl, { ...item, id: safeId, url: normUrl });
    if (!urlToId.has(normUrl)) netNew++;
  }

  const rows = Array.from(dedup.values());
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from("verified_jobs").upsert(rows.slice(i, i + 50), { onConflict: "url" });
    if (error) console.error("⚠️ Upsert error:", error.message);
  }`;

const newUpsertBlock = `  const idToUrl = new Map();
  for (const r of existingRows || []) {
    if (r.id) idToUrl.set(r.id, (r.url || "").replace(/\\/$/, ""));
  }

  const merged = [...gh, ...lever, ...ashby, ...arbeitnow, ...remoteok];
  const dedup = new Map();
  const usedIds = new Set();
  let netNew = 0;

  for (const item of merged) {
    const normUrl = item.url.replace(/\\/$/, "");
    if (dedup.has(normUrl)) continue;

    let safeId = urlToId.get(normUrl) || item.id;
    const ownerUrl = idToUrl.get(safeId);
    const idTakenByDifferentUrl = ownerUrl && ownerUrl !== normUrl;
    if (idTakenByDifferentUrl || usedIds.has(safeId)) {
      safeId = \`\${item.id}-\${Buffer.from(normUrl).toString("base64url").slice(-10)}\`;
    }
    usedIds.add(safeId);

    dedup.set(normUrl, { ...item, id: safeId, url: normUrl });
    if (!urlToId.has(normUrl)) netNew++;
  }

  const rows = Array.from(dedup.values());
  let savedRows = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("verified_jobs").upsert(batch, { onConflict: "url" });
    if (!error) {
      savedRows += batch.length;
    } else {
      for (const single of batch) {
        const { error: singleErr } = await supabase.from("verified_jobs").upsert(single, { onConflict: "url" });
        if (!singleErr) savedRows++;
        else console.error("⚠️ Skipped single row:", single.url, singleErr.message);
      }
    }
  }
  console.log(\`💾 Successfully upserted \${savedRows} / \${rows.length} deduplicated rows.\`);`;

if (!code.includes("const merged = [...gh,")) {
  console.error("❌ Could not find expected upsert block in add-top500-and-feeds.mjs");
  process.exit(1);
}

code = code.replace(oldUpsertBlock, newUpsertBlock);
fs.writeFileSync("add-top500-and-feeds.mjs", code, "utf8");
console.log("✅ Patched add-top500-and-feeds.mjs");
