import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { HUB_STATES, type CoachStatus } from "./states";

export type ProfileRole = "user" | "coach" | "admin";

export const getCoachSession = cache(
  async (): Promise<{
    user: User | null;
    status: CoachStatus;
    role: ProfileRole | null;
  }> => {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, status: "none", role: null };
    const { data } = await supabase
      .from("profiles")
      .select("role, coach_status")
      .eq("id", user.id)
      .maybeSingle();
    return {
      user,
      status: (data?.coach_status as CoachStatus) ?? "none",
      role: (data?.role as ProfileRole) ?? null,
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
  if (role !== "coach" || !allowed.includes(status)) {
    redirect("/coaching/not-a-coach");
  }
  return { user, status };
}
