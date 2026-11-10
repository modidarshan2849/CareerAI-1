import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Free pilot mode: acknowledge webhook events safely without requiring live Stripe keys
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process webhook" },
      { status: 400 }
    );
  }
}
