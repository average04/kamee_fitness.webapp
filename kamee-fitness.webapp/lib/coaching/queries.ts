import { createServerSupabase } from "@/lib/supabase/server";

export type CoachingProfileRow = {
  user_id: string;
  headline: string | null;
  about: string | null;
  specialties: string[];
  years_experience: number | null;
  languages: string[];
  location_label: string | null;
  cover_image_path: string | null;
  socials: Record<string, string>;
  is_accepting_clients: boolean;
  response_days: number;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewRow = {
  decision: "approved" | "changes_requested" | "suspended" | "reinstated" | "revoked";
  note: string | null;
  created_at: string;
};

/**
 * Everything the hub's onboarding/profile pages need in one round trip:
 * the coach's own profile row, the missing-requirements checklist (from the
 * approval RPC), and the most recent review decision (only shown as
 * onboarding feedback when it is `changes_requested` -- see the page).
 */
export async function loadHub(userId: string) {
  const supabase = await createServerSupabase();
  const [profileRes, missingRes, reviewsRes] = await Promise.all([
    supabase.from("coaching_profiles").select("*").eq("user_id", userId).single(),
    supabase.rpc("get_coaching_profile_missing"),
    supabase
      .from("coaching_reviews")
      .select("decision, note, created_at")
      .eq("subject_kind", "profile")
      .eq("subject_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  // M8 (fix round 1): a swallowed error here would otherwise render the hub
  // with a phantom empty profile. Throw and let app/coaching/error.tsx show
  // a friendly retry instead of silently lying about the coach's data.
  if (profileRes.error) {
    throw new Error(
      `loadHub: failed to load coaching_profiles for ${userId}: ${profileRes.error.message}`,
    );
  }
  if (missingRes.error) {
    throw new Error(`loadHub: get_coaching_profile_missing failed: ${missingRes.error.message}`);
  }
  if (reviewsRes.error) {
    throw new Error(
      `loadHub: failed to load coaching_reviews for ${userId}: ${reviewsRes.error.message}`,
    );
  }
  return {
    profile: profileRes.data as CoachingProfileRow,
    missing: (missingRes.data as string[]) ?? [],
    latestReview: (reviewsRes.data?.[0] as ReviewRow) ?? null,
  };
}
