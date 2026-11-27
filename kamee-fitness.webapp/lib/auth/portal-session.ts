import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAllowed, parseAllowlist } from "@/lib/admin/allowlist";
import { COACH_STATUS_LABEL, isHubState, type CoachStatus } from "@/lib/coaching/states";
import { portalDefaultDestination, type PortalSession, type ProfileRole } from "./portal-access";

/** Verified with Auth, never getSession or user-editable metadata. */
export const getVerifiedPortalUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
});

/** One role/lifecycle read per server request, shared by layouts and gates. */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const user = await getVerifiedPortalUser();
  if (!user) return null;
  const supabase = await createServerSupabase();
  const { data: profile, error } = await supabase.from("profiles")
    .select("role, coach_status").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Could not load your account. Please retry.");
  const profileRole: ProfileRole | null = profile?.role === "user" || profile?.role === "coach" || profile?.role === "admin" ? profile.role : null;
  const coachStatus: CoachStatus = typeof profile?.coach_status === "string" && Object.hasOwn(COACH_STATUS_LABEL, profile.coach_status) ? profile.coach_status as CoachStatus : "none";
  const isAdmin = isAllowed(user.email, parseAllowlist(process.env.ADMIN_EMAILS));
  return {
    user,
    profileRole,
    coachStatus,
    isAdmin,
    canUseCoachHub: profileRole === "coach" && isHubState(coachStatus),
    defaultDestination: portalDefaultDestination(isAdmin, profileRole, coachStatus),
  };
});
