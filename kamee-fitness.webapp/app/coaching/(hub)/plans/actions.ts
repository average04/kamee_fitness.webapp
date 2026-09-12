"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult, PlanDocument } from "@/lib/coaching/plans";

export async function createPlan(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requireCoach(["approved"]);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("create_coaching_plan", {
    p_title: String(form.get("title") ?? ""),
    p_discipline: String(form.get("discipline") ?? "strength"),
  });
  if (error) return { error: error.message };
  revalidatePath("/coaching/plans");
  redirect(`/coaching/plans/${data}`);
}
export async function savePlan(plan: PlanDocument): Promise<ActionResult> {
  await requireCoach(["approved"]);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("save_coaching_plan", {
    p_plan_id: plan.id,
    p_revision: plan.draft_revision,
    p_document: plan,
  });
  if (error) return { error: error.message };
  revalidatePath("/coaching/plans");
  return { revision: Number(data) };
}
export async function submitPlan(
  id: string,
  revision: number,
): Promise<ActionResult> {
  await requireCoach(["approved"]);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("submit_coaching_plan", {
    p_plan_id: id,
    p_revision: revision,
  });
  if (error) return { error: error.message };
  revalidatePath("/coaching/plans");
  revalidatePath(`/coaching/plans/${id}`);
  return { issues: data ?? [] };
}
export async function clonePlan(id: string): Promise<ActionResult> {
  await requireCoach(["approved"]);
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("clone_coaching_plan", {
    p_plan_id: id,
  });
  if (error) return { error: error.message };
  redirect(`/coaching/plans/${data}`);
}
export async function changeListingStatus(
  id: string,
  status: string,
): Promise<ActionResult> {
  await requireCoach(["approved"]);
  const db = await createServerSupabase();
  const { error } = await db.rpc("set_coaching_listing_status", {
    p_listing_id: id,
    p_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath("/coaching/plans");
  return {};
}
export async function requestExercise(form: FormData): Promise<ActionResult> {
  await requireCoach(["approved"]);
  const db = await createServerSupabase();
  const { error } = await db.rpc("request_coaching_exercise", {
    p_name: String(form.get("name") ?? ""),
    p_description: String(form.get("description") ?? ""),
    p_primary_muscle: String(form.get("primary_muscle") ?? ""),
    p_equipment: String(form.get("equipment") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    p_video_id: String(form.get("video_id") ?? "") || null,
  });
  return error ? { error: error.message } : {};
}
