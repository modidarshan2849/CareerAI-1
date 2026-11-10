export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("last_interaction_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, companyName, jobTitle, stage = "applied", notes, sourceUrl } = body;

  if (!jobId || !companyName || !jobTitle) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Upsert into job_applications and set is_active_search = false
  const { data, error } = await supabase
    .from("job_applications")
    .upsert(
      {
        user_id: user.id,
        job_id: jobId,
        company_name: companyName,
        job_title: jobTitle,
        stage,
        notes: notes || null,
        source_url: sourceUrl || null,
        is_active_search: false,
        last_interaction_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Synchronize interactions table to ensure feed consistency
  await supabase.from("job_interactions").upsert({
    user_id: user.id,
    job_id: jobId,
    status: "applied",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,job_id" });

  return NextResponse.json({ success: true, application: data });
}
