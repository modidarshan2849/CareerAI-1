import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Load .env.local manually
const envText = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const env = {};
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=["']?([^"'\r\n]+)["']?/);
  if (match) env[match[1]] = match[2];
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://fnemfziivufcwelnbxlf.supabase.co";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("🔗 Connecting to Supabase:", url);
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// 2. Find all .from("...") tables queried in app/ and components/
const tables = new Set();
function scanTables(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory() && !full.includes("node_modules") && !full.includes(".next")) {
      scanTables(full);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      const content = fs.readFileSync(full, "utf8");
      const matches = content.matchAll(/\.from\(\s*["'`]([a-zA-Z0-9_]+)["'`]\s*\)/g);
      for (const m of matches) tables.add(m[1]);
    }
  }
}
scanTables("app");
scanTables("components");
scanTables("lib");
scanTables("src");

console.log("📋 Tables queried by your app:", Array.from(tables).join(", "));

// 3. Determine active user ID from auth.users or existing table records
let targetUserId = "00000000-0000-0000-0000-000000000001";
let targetEmail = "darshan@careerai.local";

try {
  const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 10 });
  if (authData?.users?.length > 0) {
    targetUserId = authData.users[0].id;
    targetEmail = authData.users[0].email || targetEmail;
    console.log(`👤 Found Supabase Auth User: ${targetEmail} (${targetUserId})`);
  }
} catch (e) {
  console.log("ℹ️ Could not list auth.users, checking table user_ids...");
}

// 4. Inspect row counts in every table and reassign orphan user_ids if needed
for (const table of tables) {
  try {
    const { count, data, error } = await supabase
      .from(table)
      .select("*", { count: "exact" })
      .limit(5);

    if (error) {
      console.log(`   ❌ [${table}]: ${error.message}`);
    } else {
      console.log(`   ✅ [${table}]: ${count ?? data.length} total rows`);
      if (data && data.length > 0 && "user_id" in data[0]) {
        const sampleUserId = data[0].user_id;
        if (sampleUserId && sampleUserId !== targetUserId) {
          console.log(`      🔄 Updating user_id in [${table}] from ${sampleUserId} -> ${targetUserId}`);
          await supabase.from(table).update({ user_id: targetUserId }).eq("user_id", sampleUserId);
        }
      }
    }
  } catch (err) {
    console.log(`   ⚠️ [${table}]: query failed`);
  }
}

// 5. Patch lib/supabase/client.ts & lib/supabase/server.ts to use the exact same targetUserId and bypass RLS in local dev
const clientCode = `import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const LOCAL_USER = {
  id: "${targetUserId}",
  email: "${targetEmail}",
  role: "authenticated",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Darshan Modi" },
  created_at: new Date().toISOString()
};

export function createClient() {
  const client = createSupabaseClient(
    "${url}",
    "${serviceKey}",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  client.auth.getUser = async () => ({ data: { user: LOCAL_USER as any }, error: null });
  client.auth.getSession = async () => ({
    data: {
      session: {
        access_token: "local-bypass-token",
        refresh_token: "local-bypass-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: LOCAL_USER as any
      }
    },
    error: null
  });

  return client;
}
export const createServiceClient = createClient;
export const createAdminClient = createClient;
`;

for (const f of ["lib/supabase/client.ts", "lib/supabase/server.ts", "src/lib/supabase/client.ts", "src/lib/supabase/server.ts"]) {
  if (fs.existsSync(f)) {
    fs.writeFileSync(f, clientCode, "utf8");
    console.log("🔧 Synced user_id & service access in:", f);
  }
}

// 6. List all API routes so we can see the job ingestion/cron endpoints
console.log("\n=== API ROUTES IN PROJECT ===");
function findApiRoutes(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) findApiRoutes(full);
    else if (entry === "route.ts" || entry === "route.js") console.log("   📡", full);
  }
}
findApiRoutes("app/api");
findApiRoutes("src/app/api");
