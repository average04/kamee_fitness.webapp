import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safePortalNext } from "@/lib/auth/portal-access";

/**
 * Magic-link landing. Exchanges the PKCE `code` for a session (writing the
 * auth cookies) then resolves the continuation against the verified role in
 * a fresh request, using the newly written cookies, just like code sign-in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safePortalNext(searchParams.get("next"), origin);

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(`/auth/landing${next ? `?next=${encodeURIComponent(next)}` : ""}`, origin));
    }
  }

  const query = new URLSearchParams({ error: "auth" });
  if (next) query.set("next", next);
  return NextResponse.redirect(new URL(`/login?${query}`, origin));
}
