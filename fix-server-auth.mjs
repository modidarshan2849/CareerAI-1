import fs from "fs";

const serverFiles = [
  "lib/supabase/server.ts",
  "src/lib/supabase/server.ts",
  "utils/supabase/server.ts"
];

const SERVER_CLIENT_CODE = `import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const FALLBACK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "darshan@careerai.local",
  role: "authenticated",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Darshan Modi" },
  created_at: new Date().toISOString()
};

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fnemfziivufcwelnbxlf.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const client = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  client.auth.getUser = async () => {
    try {
      const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (data?.users?.length > 0) {
        return { data: { user: data.users[0] as any }, error: null };
      }
    } catch {
      // Fallback to local mock user if admin lookup fails
    }
    return { data: { user: FALLBACK_USER as any }, error: null };
  };

  client.auth.getSession = async () => ({
    data: {
      session: {
        access_token: "local-bypass-token",
        refresh_token: "local-bypass-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: FALLBACK_USER as any
      }
    },
    error: null
  });

  return client;
}

export const createServiceClient = createClient;
export const createAdminClient = createClient;
`;

for (const file of serverFiles) {
  if (fs.existsSync(file)) {
    if (!fs.existsSync(file + ".bak")) {
      fs.copyFileSync(file, file + ".bak");
    }
    fs.writeFileSync(file, SERVER_CLIENT_CODE, "utf8");
    console.log("✅ Patched server Supabase client:", file);
  }
}

if (fs.existsSync("app/dashboard/page.tsx")) {
  let pageCode = fs.readFileSync("app/dashboard/page.tsx", "utf8");
  pageCode = pageCode
    .replace(/\/\* bypassed login redirect \*\//g, "void 0")
    .replace(/\/\* bypassed login router \*\//g, "void 0");
  fs.writeFileSync("app/dashboard/page.tsx", pageCode, "utf8");
  console.log("✅ Cleaned up app/dashboard/page.tsx");
}
