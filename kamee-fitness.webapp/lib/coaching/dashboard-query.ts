import "server-only";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { DashboardPlan } from "./dashboard";

/** Read the authenticated coach's own account; never derive commerce from user_plans. */
export async function loadCoachDashboard(): Promise<{
  displayName: string | null;
  plans: DashboardPlan[];
  plansError: boolean;
  canManagePlans: boolean;
}> {
  const { user, status } = await requireCoach();
  const db = await createServerSupabase();
  const canManagePlans = status === "approved";
  const [profile, plans] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    canManagePlans
      ? db.from("plans")
          .select("id,listing_id,title,version_no,version_state,weeks_count,discipline")
          .eq("author_id", user.id)
          .eq("kind", "coach")
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profile.error) throw new Error("Could not load your coach account. Please retry.");
  return {
    displayName: profile.data?.display_name ?? null,
    canManagePlans,
    plansError: Boolean(plans.error),
    plans: plans.error ? [] : (plans.data ?? []).map((plan) => ({
      id: plan.id,
      listingId: plan.listing_id,
      title: plan.title,
      versionNo: plan.version_no,
      state: plan.version_state,
      weeksCount: plan.weeks_count,
      discipline: plan.discipline,
    })),
  };
}
