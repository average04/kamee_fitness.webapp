import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Magic-link landing. Exchanges the PKCE `code` for a session (writing the
 * auth cookies) then redirects into the admin panel.
 */
const DEFAULT_NEXT = "/admin/exercises";

/**
 * Resolve a safe, same-origin redirect target. Rejects absolute URLs and
 * tricks like `//evil.com`, `\\evil.com`, `@evil.com` that `${origin}${next}`
 * string concatenation would otherwise turn into an off-site redirect.
 */
function safeNextPath(next: string | null, origin: string): string {
  if (!next) return DEFAULT_NEXT;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return DEFAULT_NEXT;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_NEXT;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), origin);

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/admin/login?error=auth", origin));
}
