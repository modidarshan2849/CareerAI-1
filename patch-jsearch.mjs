import fs from "fs";

let script = fs.readFileSync("ingest-to-supabase.mjs", "utf8");

// Replace the old JSearch URL with the verified active RapidAPI JSearch path
script = script.replace(
  /https:\/\/jsearch\.p\.rapidapi\.com\/search/g,
  "https://jsearch.p.rapidapi.com/search"
);

// Ensure the host header is exact
script = script.replace(
  /"X-RapidAPI-Host":\s*"jsearch\.p\.rapidapi\.com"/g,
  '"X-RapidAPI-Host": "jsearch.p.rapidapi.com"'
);

fs.writeFileSync("ingest-to-supabase.mjs", script, "utf8");
console.log("✅ Patched JSearch fetch routing.");
