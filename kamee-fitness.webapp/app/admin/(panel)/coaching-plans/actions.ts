"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function reviewPlan(
  _previous: { error?: string; message?: string },
  form: FormData,
): Promise<{ error?: string; message?: string }> {
  const user = await requireAdmin();
  const db = createAdminSupabase();
  const id = String(form.get("id") ?? "");
  const { error } = await db.rpc("review_coaching_plan", {
    p_plan_id: id,
    p_actor_id: user.id,
    p_decision: String(form.get("decision") ?? ""),
    p_note: String(form.get("note") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/coaching-plans");
  revalidatePath(`/admin/coaching-plans/${id}`);
  return { message: "Review saved." };
}
export async function reviewExercise(
  _previous: { error?: string; message?: string },
  form: FormData,
): Promise<{ error?: string; message?: string }> {
  await requireAdmin();
  const db = createAdminSupabase();
  const { error } = await db.rpc("review_coaching_exercise", {
    p_request_id: String(form.get("id") ?? ""),
    p_status: String(form.get("decision") ?? ""),
    p_exercise_id: String(form.get("exercise") ?? "") || null,
    p_note: String(form.get("note") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/coaching-plans");
  return { message: "Exercise request reviewed." };
}
