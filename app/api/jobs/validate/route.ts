import { NextResponse } from "next/server";
import { validateJobUrl } from "@/lib/linkValidator";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = await req.json().catch(() => ({}));
    if (!url) {
      return NextResponse.json({ error: "URL is required for validation" }, { status: 400 });
    }

    const result = await validateJobUrl(url, 3500);

    return NextResponse.json({
      success: true,
      valid: result.valid,
      statusCode: result.status,
      testedUrl: url,
      finalUrl: result.finalUrl,
      message: result.valid
        ? `Requisition link verified active (HTTP ${result.status}).`
        : `Requisition link returned status ${result.status}. Fallback activated.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, valid: false, error: err.message },
      { status: 500 }
    );
  }
}
