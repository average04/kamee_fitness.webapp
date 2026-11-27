import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowed, parseAllowlist } from "@/lib/admin/allowlist";
import { isPublicCoachingPath } from "@/lib/coaching/public-paths";
import { localLoginOriginRedirect } from "@/lib/auth/local-login-origin";

/**
 * Next 16 Proxy (formerly middleware). Refreshes the Supabase session on every
 * matched request and gates `/admin/*` (except `/admin/login`) behind an
 * authenticated, allowlisted user. Authorization is ALSO enforced server-side
 * in `requireAdmin()`; this proxy is the first, not the only, line of defense.
 */
export async function proxy(request: NextRequest) {
  // Next normalizes loopback request URLs to localhost; Host retains the URL
  // the visitor actually opened. Only the helper's explicit dev opt-in uses it.
  const localRequestUrl = new URL(request.url);
  const incomingHost = request.headers.get("host");
  if (incomingHost) localRequestUrl.host = incomingHost;
  const localLoginUrl = localLoginOriginRedirect(localRequestUrl.href, request.method, process.env.NODE_ENV, process.env.SITE_URL);
  if (localLoginUrl) return NextResponse.redirect(localLoginUrl, 307);

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
          const previousCookies = response.cookies.getAll();
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          previousCookies.forEach((cookie) => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const verifiedUser = error ? null : user;

  function redirectWithCookies(path: string, next?: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    if (next) url.searchParams.set("next", next);
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  if (pathname.startsWith("/admin") && !isLogin) {
    if (!verifiedUser) {
      return redirectWithCookies("/admin/login", pathname + request.nextUrl.search);
    }
    if (!isAllowed(verifiedUser.email, parseAllowlist(process.env.ADMIN_EMAILS))) {
      return redirectWithCookies("/auth/landing");
    }
  }

  // End-user stats area: any authenticated user; unauthenticated -> /login.
  if (pathname.startsWith("/me") && !verifiedUser) {
    return redirectWithCookies("/login", pathname + request.nextUrl.search);
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
    !verifiedUser &&
    !planAction
  ) {
    return redirectWithCookies("/login", pathname + request.nextUrl.search);
  }

  return response;
}

export const config = {
  // /delete-account: keeps the code sign-in's session refreshed while the
  // visitor confirms (the page itself is public; it re-checks getUser()).
  matcher: ["/admin/:path*", "/me/:path*", "/login", "/coaching/:path*", "/delete-account"],
};
