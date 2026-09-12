import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowed, parseAllowlist } from "@/lib/admin/allowlist";
import { isPublicCoachingPath } from "@/lib/coaching/public-paths";

/**
 * Next 16 Proxy (formerly middleware). Refreshes the Supabase session on every
 * matched request and gates `/admin/*` (except `/admin/login`) behind an
 * authenticated, allowlisted user. Authorization is ALSO enforced server-side
 * in `requireAdmin()`; this proxy is the first, not the only, line of defense.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  if (pathname.startsWith("/admin") && !isLogin) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    if (!isAllowed(user.email, parseAllowlist(process.env.ADMIN_EMAILS))) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("error", "not-authorized");
      return NextResponse.redirect(url);
    }
  }

  // End-user stats area: any authenticated user; unauthenticated -> /login.
  if (pathname.startsWith("/me") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Coaching Hub: any authenticated user; unauthenticated -> /login?next=<path>.
  // Coach-status gating happens server-side in requireCoach(); this proxy is
  // the first, not the only, line of defense. Public exceptions: the Coach
  // Terms and invite links (which carry their own sign-in form).
  // Plan Server Actions return a structured session-expiry error and preserve
  // the editor. Every action independently checks the authenticated coach.
  const planAction =
    request.method === "POST" &&
    request.headers.has("next-action") &&
    (pathname === "/coaching/plans" || pathname.startsWith("/coaching/plans/"));
  if (
    pathname.startsWith("/coaching") &&
    !isPublicCoachingPath(pathname) &&
    !user &&
    !planAction
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/me/:path*", "/login", "/coaching/:path*"],
};
