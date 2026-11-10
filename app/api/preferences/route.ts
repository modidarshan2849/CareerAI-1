export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("target_titles, work_modes, min_salary, target_locations")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { target_titles, work_modes, min_salary, target_locations } = body;

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      target_titles: Array.isArray(target_titles) ? target_titles : [],
      work_modes: Array.isArray(work_modes) ? work_modes : ["remote", "hybrid"],
      min_salary: Number(min_salary) || 100000,
      target_locations: Array.isArray(target_locations) ? target_locations : [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
