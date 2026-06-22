import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Data Access Layer gate for the end-user `/me` area. Returns the authenticated
 * user or redirects to /login. Memoized per-request via React `cache`. No
 * allowlist — any signed-in Kamee user. Re-checked in server actions; never
 * trust the proxy alone.
 */
export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});
