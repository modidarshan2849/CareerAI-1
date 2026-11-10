import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Handles both:
 *  - OAuth (Google) callback
 *  - Password recovery callback
 *
 * Section 13: the recovery session must be detected and routed to
 * /reset-password BEFORE any generic "user is authenticated -> dashboard"
 * logic runs. We branch on `type=recovery` explicitly rather than assuming.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset links
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent("Your link has expired or was already used. Please try again.")}`
      );
    }

    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing authentication code.")}`);
}
