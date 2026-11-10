export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { jobId, status } = body;

  if (!jobId || !["saved", "applied", "hidden", "none"].includes(status)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (status === "none") {
    const { error } = await supabase
      .from("job_interactions")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", jobId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: null });
  }

  const { data, error } = await supabase
    .from("job_interactions")
    .upsert(
      {
        user_id: user.id,
        job_id: jobId,
        status: status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, interaction: data });
}
