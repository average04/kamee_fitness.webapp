import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the publishable (anon) key. The `waitlist`
 * table has an insert-only RLS policy for the anon role, so this client can add
 * signups but cannot read, update, or delete them.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
