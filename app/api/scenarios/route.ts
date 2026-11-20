import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_scenarios")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scenarios: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // If activating an existing scenario
  if (body.activate_id) {
    await supabase
      .from("user_scenarios")
      .update({ is_active: false })
      .eq("user_id", user.id);

    const { data, error } = await supabase
      .from("user_scenarios")
      .update({ is_active: true })
      .eq("id", body.activate_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ scenario: data });
  }

  // Creating a new scenario persona
  await supabase
    .from("user_scenarios")
    .update({ is_active: false })
    .eq("user_id", user.id);

  const { data, error } = await supabase
    .from("user_scenarios")
    .insert({
      user_id: user.id,
      scenario_name: String(body.scenario_name ?? "New Scenario").trim(),
      is_active: true,
      highest_degree: body.highest_degree ?? "bachelors",
      requires_sponsorship: Boolean(body.requires_sponsorship),
      target_titles: Array.isArray(body.target_titles) ? body.target_titles : [],
      target_locations: Array.isArray(body.target_locations)
        ? body.target_locations
        : [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scenario: data }, { status: 201 });
}
