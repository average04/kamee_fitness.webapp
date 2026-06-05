"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  type ExerciseFormState,
  parseExerciseForm,
  validateExerciseInput,
} from "@/lib/admin/exercises";

const BUCKET = "exercise-demos";

/**
 * Upload a replacement demo image (if provided) or honor a removal request.
 * Returns the value to store in `demo_image_path`:
 *   - `exercise-demos/<slug>.<ext>` after a successful upload
 *   - null if "remove" was checked
 *   - the unchanged `currentPath` otherwise
 * Object key matches the mobile app convention (<slug>.<ext>, prefix added to DB).
 */
async function resolveImagePath(
  admin: ReturnType<typeof createAdminSupabase>,
  formData: FormData,
  slug: string,
  currentPath: string | null,
): Promise<string | null> {
  if (formData.get("remove_image") === "on") return null;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const objectKey = `${slug}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(objectKey, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    return `${BUCKET}/${objectKey}`;
  }
  return currentPath;
}

export async function createExercise(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const user = await requireAdmin();
  const input = parseExerciseForm(formData);
  const result = validateExerciseInput(input);
  if (!result.ok) return { errors: result.errors };

  const admin = createAdminSupabase();

  let imagePath: string | null;
  try {
    imagePath = await resolveImagePath(admin, formData, input.slug, null);
  } catch {
    return { message: "Image upload failed. Please try again." };
  }

  // `input` is the validated payload (validateExerciseInput returns the same
  // object as `value`), so read its fields directly. `is_bodyweight` is a
  // generated column and is deliberately never written.
  const { error } = await admin.from("exercises").insert({
    name: input.name,
    slug: input.slug,
    primary_muscle: input.primary_muscle,
    secondary_muscles: input.secondary_muscles,
    equipment: input.equipment,
    cues: input.cues,
    common_mistakes: input.common_mistakes,
    demo_image_path: imagePath,
    demo_video_path: input.demo_video_path,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505")
      return { errors: { slug: "That slug already exists." } };
    return { message: "Could not create exercise. Please try again." };
  }

  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}

export async function updateExercise(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  await requireAdmin();
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { message: "Missing exercise id." };

  const input = parseExerciseForm(formData);
  const result = validateExerciseInput(input);
  if (!result.ok) return { errors: result.errors };

  const admin = createAdminSupabase();

  let imagePath: string | null;
  try {
    imagePath = await resolveImagePath(
      admin,
      formData,
      input.slug,
      input.demo_image_path,
    );
  } catch {
    return { message: "Image upload failed. Please try again." };
  }

  const { error } = await admin
    .from("exercises")
    .update({
      name: input.name,
      slug: input.slug,
      primary_muscle: input.primary_muscle,
      secondary_muscles: input.secondary_muscles,
      equipment: input.equipment,
      cues: input.cues,
      common_mistakes: input.common_mistakes,
      demo_image_path: imagePath,
      demo_video_path: input.demo_video_path,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return { errors: { slug: "That slug already exists." } };
    return { message: "Could not save changes. Please try again." };
  }

  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}

export async function deleteExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const admin = createAdminSupabase();
  // Storage object is intentionally left in place (it may be a shared asset).
  await admin.from("exercises").delete().eq("id", id);

  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}

/**
 * Lightweight inline update of just the demo video (YouTube) URL from the list
 * table. Returns a result instead of redirecting so the cell can stay put.
 */
export async function setDemoVideo(
  id: string,
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const admin = createAdminSupabase();
  const value = url.trim() || null;
  const { error } = await admin
    .from("exercises")
    .update({ demo_video_path: value })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
