import React from "react";
import { createClient } from "@supabase/supabase-js";
import EnterpriseJobsDashboard, { JobRecord } from "@/components/EnterpriseJobsDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" }
  });

  const { data } = await supabase
    .from("verified_jobs")
    .select("*")
    .eq("is_active", true)
    .order("score", { ascending: false })
    .range(0, 1999);

  return <EnterpriseJobsDashboard initialJobs={(data || []) as JobRecord[]} />;
}
