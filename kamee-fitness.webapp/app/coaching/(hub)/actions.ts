"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCoachSession, requireCoach } from "@/lib/coaching/auth";
import { coerceProfileInput, validateProfile, type FormState } from "@/lib/coaching/profile";
import { isOwnCoverPath } from "@/lib/coaching/storage";
import { createServerSupabase } from "@/lib/supabase/server";

const EDITABLE = ["onboarding", "changes_requested", "approved", "suspended"] as const;

const PAUSED_MESSAGE = "Your profile is in review, so changes are paused.";

/**
 * M11 (fix round 1): `requireCoach([...EDITABLE])` redirects anyone outside
 * that allow-list to /coaching/not-a-coach -- correct for a signed-out
 * visitor or a non-coach role, but wrong for a legitimate coach who is
 * simply `in_review` (e.g. they submitted from another tab and this tab's
 * autosave fires afterwards). Check the session status first and hand back
 * a friendly paused message for that one case; every other disallowed
 * state still goes through requireCoach's redirects.
 */
async function guardEditable(): Promise<
  { user: { id: string } } | { blocked: true; message: string }
> {
  const session = await getCoachSession();
  if (session.user && session.role === "coach" && session.status === "in_review") {
    return { blocked: true, message: PAUSED_MESSAGE };
  }
  const { user } = await requireCoach([...EDITABLE]);
  return { user };
}

export async function saveProfile(raw: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  // I4 (fix round 1): Server Actions are public POST endpoints -- the
  // caller can send any JSON shape, not just what our own ProfileForm
  // sends. Type-check and rebuild the whole thing before it ever reaches
  // validateProfile or the database.
  const input = coerceProfileInput(raw);
  if (!input) return { message: "Could not save. Please retry." };
  const v = validateProfile(input);
  if (!v.ok) return { errors: v.errors };

  const supabase = await createServerSupabase(); // anon + cookies: RLS owner-update policy applies
  const { data: current, error: currentError } = await supabase
    .from("coaching_profiles")
    .select("terms_accepted_at")
    .eq("user_id", user.id)
    .single();
  // I5 (fix round 1): never derive termsAcceptedAt from a failed read --
  // that could silently reset an already-accepted timestamp to "now".
  if (currentError) return { message: "Could not save. Please retry." };

  // Keep the original acceptance time; only change it when the box changes state.
  const termsAcceptedAt = v.value.termsAccepted
    ? (current?.terms_accepted_at ?? new Date().toISOString())
    : null;
  const { data, error } = await supabase
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
    .eq("user_id", user.id)
    .select("user_id");
  // I5: "saved" is only true once we can see exactly one row came back --
  // an RLS mismatch or a since-deleted row would otherwise return no error
  // and zero rows, which previously read as success.
  if (error || !data || data.length !== 1) {
    return { message: "Could not save. Please retry." };
  }
  revalidatePath("/coaching/onboarding");
  return { savedAt: new Date().toISOString() };
}

export async function setCoverPath(path: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  // I3 (fix round 1): require the exact own-cover-path shape
  // (coaching/<own uid>/cover/<digits>.(jpg|png|webp)) instead of a loose
  // startsWith check, which a crafted path could defeat with `../`.
  if (!isOwnCoverPath(path, user.id)) {
    return { message: "Could not save the cover. Please try again." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_profiles")
    .update({ cover_image_path: path })
    .eq("user_id", user.id)
    .select("user_id");
  if (error || !data || data.length !== 1) {
    return { message: "Could not save the cover. Please try again." };
  }
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
