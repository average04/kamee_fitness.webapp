import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAllowed, parseAllowlist } from "@/lib/admin/allowlist";

/**
 * Data Access Layer gate. Returns the authenticated admin user or redirects.
 * Memoized per-request via React `cache` so layout + actions don't re-query.
 * Re-checked in every Server Action — never trust the proxy alone.
 */
export const requireAdmin = cache(async (): Promise<User> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!isAllowed(user.email, parseAllowlist(process.env.ADMIN_EMAILS))) {
    redirect("/admin/login?error=not-authorized");
  }
  return user;
});
