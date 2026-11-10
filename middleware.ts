import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Section 13 requirement, implemented here:
 * "For password recovery, ensure the recovery session is detected BEFORE
 * routing an authenticated user to the profile. Do not strip OAuth/PKCE URL
 * parameters before Supabase has completed the exchange."
 *
 * Two things this middleware deliberately does NOT do:
 *  1. It never rewrites/strips the incoming URL's query string before the
 *     /auth/callback route has had a chance to call exchangeCodeForSession.
 *  2. It never redirects an authenticated session away from
 *     /reset-password. A recovery link produces a real (if short-lived)
 *     session — if we treated "has session" as "fully logged in, bounce to
 *     dashboard" on every route, the user would be redirected away from the
 *     one page where they're supposed to set a new password.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/preferences", "/matches"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedPath = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Recovery flow: never bounce away from /reset-password, even if a session exists.
  if (pathname.startsWith("/reset-password")) {
    return response;
  }

  // Auth callback must be allowed to run untouched so it can complete the PKCE exchange.
  if (pathname.startsWith("/auth/callback")) {
    return response;
  }

  if (!user && isProtectedPath) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
