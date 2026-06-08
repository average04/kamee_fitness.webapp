"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  parsePlanForm,
  REVIEW_STATUSES,
  validatePlanInput,
  type PlanFormState,
  type ReviewStatus,
} from "@/lib/admin/plans";

const BUCKET = "plan-covers";

type Admin = ReturnType<typeof createAdminSupabase>;

/** Upload a replacement cover (if provided) or honor removal. Returns the path. */
async function resolveCoverPath(
  admin: Admin,
  formData: FormData,
  planId: string,
  currentPath: string | null,
): Promise<string | null> {
  if (formData.get("remove_image") === "on") return null;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const objectKey = `${planId}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(objectKey, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    return `${BUCKET}/${objectKey}`;
  }
  return currentPath;
}

export async function createPlan(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireAdmin();
  const input = parsePlanForm(formData);
  const result = validatePlanInput(input);
  if (!result.ok) return { errors: result.errors };

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("plans")
    .insert({
      title: input.title,
      summary: input.summary,
      goal: input.goal,
      level: input.level,
      weeks_count: input.weeks_count,
      est_minutes_per_session: input.est_minutes_per_session,
      price_cents: input.price_cents,
      currency: input.currency,
      equipment_tier: input.equipment_tier,
      required_equipment: input.required_equipment,
      target_muscles: input.target_muscles,
      kind: input.kind,
      author_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { message: "Could not create plan. Try again." };

  // Cover upload needs the new id as its object key.
  try {
    const cover = await resolveCoverPath(admin, formData, data.id, null);
    if (cover) {
      await admin.from("plans").update({ cover_image_path: cover }).eq("id", data.id);
    }
  } catch {
    // Plan exists; surface the upload failure on the edit screen later.
  }

  revalidatePath("/admin/plans");
  redirect(`/admin/plans/${data.id}`);
}

export async function updatePlan(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { message: "Missing plan id." };

  const input = parsePlanForm(formData);
  const result = validatePlanInput(input);
  if (!result.ok) return { errors: result.errors };

  const admin = createAdminSupabase();
  let cover: string | null;
  try {
    cover = await resolveCoverPath(admin, formData, id, input.cover_image_path);
  } catch {
    return { message: "Cover upload failed. Please try again." };
  }

  const { error } = await admin
    .from("plans")
    .update({
      title: input.title,
      summary: input.summary,
      goal: input.goal,
      level: input.level,
      weeks_count: input.weeks_count,
      est_minutes_per_session: input.est_minutes_per_session,
      price_cents: input.price_cents,
      currency: input.currency,
      equipment_tier: input.equipment_tier,
      required_equipment: input.required_equipment,
      target_muscles: input.target_muscles,
      kind: input.kind,
      cover_image_path: cover,
    })
    .eq("id", id);

  if (error) return { message: "Could not save changes. Please try again." };

  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${id}`);
  redirect(`/admin/plans/${id}`);
}

export async function deletePlan(id: string): Promise<void> {
  await requireAdmin();
  if (!id) return;
  const admin = createAdminSupabase();
  await admin.from("plans").delete().eq("id", id);
  revalidatePath("/admin/plans");
  redirect("/admin/plans");
}

export async function setPlanPublished(
  id: string,
  value: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("plans")
    .update({ is_published: value })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${id}`);
  return { ok: true };
}

export async function setPlanReviewStatus(
  id: string,
  status: ReviewStatus,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!REVIEW_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("plans")
    .update({ review_status: status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${id}`);
  return { ok: true };
}

/**
 * Toggle the `is_default` flag on a single plan. `is_default` marks a
 * hand-picked starter/catalog plan (used by the app's recommendation scoring
 * and ordering); many plans carry it, so this is a per-plan toggle — it does
 * NOT clear the flag on other plans.
 */
export async function setPlanDefault(
  id: string,
  value: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("plans")
    .update({ is_default: value })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${id}`);
  return { ok: true };
}
