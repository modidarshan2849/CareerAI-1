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

    return NextResponse.json({
      url: "/dashboard?checkout_status=pilot_free_access",
    });
  } catch (err: any) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process checkout" },
      { status: 500 }
    );
  }
}
