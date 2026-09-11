"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coaching/auth";
import { validateProfile, type FormState, type ProfileInput } from "@/lib/coaching/profile";
import { createServerSupabase } from "@/lib/supabase/server";

const EDITABLE = ["onboarding", "changes_requested", "approved", "suspended"] as const;

export async function saveProfile(input: ProfileInput): Promise<FormState> {
  const { user } = await requireCoach([...EDITABLE]);
  const v = validateProfile(input);
  if (!v.ok) return { errors: v.errors };
  const supabase = await createServerSupabase(); // anon + cookies: RLS owner-update policy applies
  const { data: current } = await supabase
    .from("coaching_profiles")
    .select("terms_accepted_at")
    .eq("user_id", user.id)
    .single();
  // Keep the original acceptance time; only change it when the box changes state.
  const termsAcceptedAt = v.value.termsAccepted
    ? (current?.terms_accepted_at ?? new Date().toISOString())
    : null;
  const { error } = await supabase
    .from("coaching_profiles")
    .update({
      headline: v.value.headline || null,
      about: v.value.about || null,
      specialties: v.value.specialties,
      years_experience: v.value.yearsExperience,
      languages: v.value.languages,
      location_label: v.value.locationLabel || null,
      socials: v.value.socials,
      is_accepting_clients: v.value.isAcceptingClients,
      response_days: v.value.responseDays,
      terms_accepted_at: termsAcceptedAt,
    })
    .eq("user_id", user.id);
  if (error) return { message: "Could not save. Please retry." };
  revalidatePath("/coaching/onboarding");
  return { savedAt: new Date().toISOString() };
}

export async function setCoverPath(path: string): Promise<FormState> {
  const { user } = await requireCoach([...EDITABLE]);
  if (!path.startsWith(`coaching/${user.id}/cover/`)) return { message: "Bad path" };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("coaching_profiles")
    .update({ cover_image_path: path })
    .eq("user_id", user.id);
  if (error) return { message: "Could not save the cover." };
  revalidatePath("/coaching/onboarding");
  return { savedAt: new Date().toISOString() };
}

/**
 * R18: the hub's own sign-out, distinct from app/admin/actions.ts (which
 * redirects to /admin/login). Signed-out coaches land on the public /login.
 */
export async function signOutCoach() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
