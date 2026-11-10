import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In free pilot mode, route back to dashboard without requiring a live Stripe customer session
    return NextResponse.json({
      url: "/dashboard?portal_status=pilot_mode",
    });
  } catch (err: any) {
    console.error("Portal error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate portal session" },
      { status: 500 }
    );
  }
}
