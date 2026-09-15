import { createServerSupabase } from "@/lib/supabase/server";
import { isAllowed, parseAllowlist } from "../admin/allowlist";
import { isHubState } from "../coaching/states";

/** Resolve only the default landing page; explicit next destinations bypass this. */
export async function getSignInDestination(): Promise<string> {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return "/login";
  if (isAllowed(user.email, parseAllowlist(process.env.ADMIN_EMAILS))) return "/admin";
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, coach_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("Could not load your account. Please retry.");
  if (profile?.role === "coach") {
    if (profile.coach_status === "invited") return "/coaching/invite";
    if (isHubState(profile.coach_status)) return "/coaching/profile";
  }
  return "/me";
}
