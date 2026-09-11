"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCoachSession, requireCoach } from "@/lib/coaching/auth";
import {
  coerceProfileInput,
  parseCredentialForm,
  validateCredential,
  validateProfile,
  type FormState,
} from "@/lib/coaching/profile";
import type { CoachStatus } from "@/lib/coaching/states";
import { isOwnCoverPath, isOwnCredentialDocPath, isOwnGalleryPath } from "@/lib/coaching/storage";
import { createServerSupabase } from "@/lib/supabase/server";

const EDITABLE: CoachStatus[] = ["onboarding", "changes_requested", "approved", "suspended"];

const PAUSED_MESSAGE = "Your profile is in review, so changes are paused.";

/**
 * M11 (fix round 1): `requireCoach([...EDITABLE])` redirects anyone outside
 * that allow-list to /coaching/not-a-coach -- correct for a signed-out
 * visitor or a non-coach role, but wrong for a legitimate coach who is
 * simply `in_review` (e.g. they submitted from another tab and this tab's
 * autosave fires afterwards). Check the session status first and hand back
 * a friendly paused message for that one case; every other disallowed
 * state still goes through requireCoach's redirects.
 *
 * R20(e): every new Server Action in this module (credentials, gallery,
 * submit) reuses this same gate rather than re-deriving the in_review
 * short-circuit. `allowed` lets a caller narrow the final `requireCoach`
 * allow-list (e.g. `submitProfile` only wants onboarding/changes_requested)
 * while still getting the friendly in_review message first.
 */
async function guardEditable(
  allowed: CoachStatus[] = EDITABLE,
): Promise<{ user: { id: string } } | { blocked: true; message: string }> {
  const session = await getCoachSession();
  if (session.user && session.role === "coach" && session.status === "in_review") {
    return { blocked: true, message: PAUSED_MESSAGE };
  }
  const { user } = await requireCoach(allowed);
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

// ---------------------------------------------------------------------------
// Task 11: credentials manager
// ---------------------------------------------------------------------------

/**
 * Hidden `id` present -> UPDATE (own row only); absent -> INSERT with a
 * server-generated uuid. Never upsert: PostgREST's ON CONFLICT DO UPDATE
 * writes id and coach_id, which have no UPDATE grant, so every upsert
 * would fail (partial-upsert trap). The document is attached afterward via
 * `setCredentialDocument` once the row (and its id) exists.
 */
export async function upsertCredential(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  const input = parseCredentialForm(formData);
  const v = validateCredential(input);
  if (!v.ok) return { errors: v.errors };

  const existingId = formData.get("id");
  const fields = {
    title: v.value.title,
    issuer: v.value.issuer,
    issued_year: v.value.issuedYear,
    expires_on: v.value.expiresOn,
  };
  const supabase = await createServerSupabase();

  const { data, error } =
    typeof existingId === "string" && existingId
      ? await supabase
          .from("coaching_credentials")
          .update(fields)
          .eq("id", existingId)
          .eq("coach_id", user.id)
          .select("id")
      : await supabase
          .from("coaching_credentials")
          .insert({ id: crypto.randomUUID(), coach_id: user.id, ...fields })
          .select("id");

  // I5-style rule (matches saveProfile/setCoverPath): "saved" is only true
  // once exactly one row comes back, not merely the absence of an error.
  if (error || !data || data.length !== 1) {
    return { message: "Could not save the credential." };
  }
  revalidatePath("/coaching/credentials");
  return { savedAt: new Date().toISOString() };
}

export async function deleteCredential(id: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  if (typeof id !== "string" || !id) return { message: "Could not delete." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_credentials")
    .delete()
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("id");
  if (error || !data || data.length !== 1) return { message: "Could not delete." };
  revalidatePath("/coaching/credentials");
  return { savedAt: new Date().toISOString() };
}

/**
 * Attaches a document already uploaded (browser-side, insert-only) to the
 * private `coaching-documents` bucket. `isOwnCredentialDocPath` requires
 * the exact `<uid>/<credentialId>/<uuid>.(pdf|jpg|png)` shape -- a crafted
 * path pointing at another coach's folder or another credential id is
 * rejected before it ever reaches the database.
 */
export async function setCredentialDocument(id: unknown, path: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  if (typeof id !== "string") return { message: "Could not attach the document." };
  if (!isOwnCredentialDocPath(path, user.id, id)) {
    return { message: "Could not attach the document." };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_credentials")
    .update({ document_path: path })
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    return { message: "Could not attach the document." };
  }
  revalidatePath("/coaching/credentials");
  return { savedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Task 12: gallery manager
// ---------------------------------------------------------------------------

export async function addGalleryPhoto(path: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  if (!isOwnGalleryPath(path, user.id)) {
    return { message: "Could not add the photo." };
  }

  const supabase = await createServerSupabase();
  const { count, error: countError } = await supabase
    .from("coaching_gallery")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", user.id);
  if (countError) return { message: "Could not add the photo." };

  const { data, error } = await supabase
    .from("coaching_gallery")
    .insert({ coach_id: user.id, image_path: path, position: count ?? 0 })
    .select("id");
  if (error) {
    // The `gallery_full` trigger fires at 12 rows (spec: at most 12 photos).
    if (error.message.includes("gallery_full")) {
      return { message: "You can add up to 12 photos." };
    }
    return { message: "Could not add the photo." };
  }
  if (!data || data.length !== 1) return { message: "Could not add the photo." };
  revalidatePath("/coaching/gallery");
  return { savedAt: new Date().toISOString() };
}

export async function updateGalleryCaption(id: unknown, caption: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  if (typeof id !== "string" || !id) return { message: "Could not save the caption." };
  if (typeof caption !== "string") return { message: "Could not save the caption." };
  const trimmed = caption.trim().slice(0, 120);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_gallery")
    .update({ caption: trimmed })
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    return { message: "Could not save the caption." };
  }
  revalidatePath("/coaching/gallery");
  return { savedAt: new Date().toISOString() };
}

/**
 * Deletes the row only -- the caller (browser) then removes the storage
 * object itself with `createBrowserSupabase().storage.from("social-photos").remove([path])`,
 * which the existing `social_photos_delete` policy permits through
 * `can_write_social_photo`. Returns the now-orphaned `image_path` so the
 * browser knows what to remove; `.select("image_path")` also doubles as
 * the "did this actually delete a row I own" check.
 */
export async function deleteGalleryPhoto(
  id: unknown,
): Promise<FormState & { imagePath?: string }> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };
  const { user } = gate;

  if (typeof id !== "string" || !id) return { message: "Could not delete the photo." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_gallery")
    .delete()
    .eq("id", id)
    .eq("coach_id", user.id)
    .select("image_path");
  if (error || !data || data.length !== 1) {
    return { message: "Could not delete the photo." };
  }
  revalidatePath("/coaching/gallery");
  return { savedAt: new Date().toISOString(), imagePath: data[0].image_path as string };
}

export async function reorderGallery(ids: unknown): Promise<FormState> {
  const gate = await guardEditable();
  if ("blocked" in gate) return { message: gate.message };

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string" && x)) {
    return { message: "Could not reorder the gallery." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("reorder_coaching_gallery", { p_ids: ids });
  if (error) {
    const FRIENDLY: Record<string, string> = {
      not_active: "Your account isn't active right now.",
      duplicate_ids: "Could not reorder the gallery.",
      not_owner: "Could not reorder the gallery.",
    };
    return { message: FRIENDLY[error.message] ?? "Could not reorder the gallery." };
  }
  revalidatePath("/coaching/gallery");
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
