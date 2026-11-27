import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { HUB_STATES, type CoachStatus } from "./states";
import { getPortalSession } from "@/lib/auth/portal-session";
import type { ProfileRole } from "@/lib/auth/portal-access";

export type { ProfileRole } from "@/lib/auth/portal-access";

export const getCoachSession = cache(
  async (): Promise<{
    user: User | null;
    status: CoachStatus;
    role: ProfileRole | null;
  }> => {
    const session = await getPortalSession();
    if (!session) return { user: null, status: "none", role: null };
    return {
      user: session.user,
      status: session.coachStatus,
      role: session.profileRole,
    };
  },
);

/**
 * Data Access Layer gate for the Coaching Hub. Returns the authenticated
 * coach user + status or redirects. Memoized per-request via React `cache`.
 * Re-check in every Server Action; never trust the proxy alone.
 */
export async function requireCoach(
  allowed: CoachStatus[] = HUB_STATES,
): Promise<{ user: User; status: CoachStatus }> {
  const { user, status, role } = await getCoachSession();
  if (!user) redirect("/login?next=/coaching");
  if (status === "invited") {
    if (allowed.includes("invited")) return { user, status };
    redirect("/coaching/invite");
  }
  if (role !== "coach" || !HUB_STATES.includes(status)) redirect("/auth/landing");
  if (!allowed.includes(status)) redirect("/auth/landing");
  return { user, status };
}
