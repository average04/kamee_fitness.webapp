import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Magic-link landing. Exchanges the PKCE `code` for a session (writing the
 * auth cookies) then redirects into the admin panel by default (or wherever
 * `next` pointed, e.g. `/me` or `/coaching` for the non-admin login page).
 */
const DEFAULT_NEXT = "/admin/exercises";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), origin, DEFAULT_NEXT);

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/admin/login?error=auth", origin));
}
