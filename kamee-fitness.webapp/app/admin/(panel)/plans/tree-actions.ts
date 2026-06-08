"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  BLOCK_KINDS,
  DAY_KINDS,
  reorder,
  type BlockKind,
  type DayKind,
} from "@/lib/admin/plans";

type Admin = ReturnType<typeof createAdminSupabase>;
type Result = { ok: boolean; error?: string };

const OK: Result = { ok: true };
const fail = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});

/** Ordered sibling ids under a parent, by current `index`. */
async function siblingIds(
  admin: Admin,
  table: string,
  parentCol: string,
  parentId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq(parentCol, parentId)
    .order("index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/**
 * Rewrite `index` for the given ordered ids to 0..n-1. Two passes (offset to a
 * high range, then assign finals) so the `unique(parent, index)` constraint is
 * never transiently violated.
 */
async function applyOrder(admin: Admin, table: string, ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin
      .from(table)
      .update({ index: 100000 + i })
      .eq("id", ids[i]);
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin.from(table).update({ index: i }).eq("id", ids[i]);
    if (error) throw new Error(error.message);
  }
}

/** Next append index = max(index)+1 (0 when empty). */
async function nextIndex(
  admin: Admin,
  table: string,
  parentCol: string,
  parentId: string,
): Promise<number> {
  const { data, error } = await admin
    .from(table)
    .select("index")
    .eq(parentCol, parentId)
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as { index: number } | null)?.index ?? -1) + 1;
}

async function moveSibling(
  admin: Admin,
  table: string,
  parentCol: string,
  parentId: string,
  id: string,
  dir: "up" | "down",
) {
  const ids = await siblingIds(admin, table, parentCol, parentId);
  const next = reorder(ids, id, dir);
  if (next !== ids) await applyOrder(admin, table, next);
}

async function syncWeeksCount(admin: Admin, planId: string) {
  const { count } = await admin
    .from("plan_weeks")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId);
  // plans.weeks_count is constrained to 1..52, so clamp (a plan with zero
  // weeks still has to report at least 1).
  const clamped = Math.min(52, Math.max(1, count ?? 0));
  await admin.from("plans").update({ weeks_count: clamped }).eq("id", planId);
}

const touch = (planId: string) => revalidatePath(`/admin/plans/${planId}`);

// ── Weeks ────────────────────────────────────────────────────────────────
export async function addWeek(planId: string): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    const index = await nextIndex(admin, "plan_weeks", "plan_id", planId);
    const { error } = await admin
      .from("plan_weeks")
      .insert({ plan_id: planId, index });
    if (error) throw new Error(error.message);
    await syncWeeksCount(admin, planId);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWeek(planId: string, weekId: string): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    const { error } = await admin.from("plan_weeks").delete().eq("id", weekId);
    if (error) throw new Error(error.message);
    await applyOrder(
      admin,
      "plan_weeks",
      await siblingIds(admin, "plan_weeks", "plan_id", planId),
    );
    await syncWeeksCount(admin, planId);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function moveWeek(
  planId: string,
  weekId: string,
  dir: "up" | "down",
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    await moveSibling(admin, "plan_weeks", "plan_id", planId, weekId, dir);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

// ── Days ─────────────────────────────────────────────────────────────────
export async function addDay(planId: string, weekId: string): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    const index = await nextIndex(admin, "plan_days", "week_id", weekId);
    const { error } = await admin
      .from("plan_days")
      .insert({ week_id: weekId, index, day_kind: "workout" });
    if (error) throw new Error(error.message);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDay(
  planId: string,
  weekId: string,
  dayId: string,
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    const { error } = await admin.from("plan_days").delete().eq("id", dayId);
    if (error) throw new Error(error.message);
    await applyOrder(
      admin,
      "plan_days",
      await siblingIds(admin, "plan_days", "week_id", weekId),
    );
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function moveDay(
  planId: string,
  weekId: string,
  dayId: string,
  dir: "up" | "down",
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    await moveSibling(admin, "plan_days", "week_id", weekId, dayId, dir);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function updateDay(
  planId: string,
  dayId: string,
  title: string,
  dayKind: DayKind,
): Promise<Result> {
  await requireAdmin();
  if (!DAY_KINDS.includes(dayKind)) return fail("Invalid day kind.");
  const admin = createAdminSupabase();
  try {
    const { error } = await admin
      .from("plan_days")
      .update({ title: title.trim() || null, day_kind: dayKind })
      .eq("id", dayId);
    if (error) throw new Error(error.message);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

// ── Blocks ───────────────────────────────────────────────────────────────
export async function addBlock(
  planId: string,
  dayId: string,
  kind: BlockKind,
): Promise<Result> {
  await requireAdmin();
  if (!BLOCK_KINDS.includes(kind)) return fail("Invalid block kind.");
  const admin = createAdminSupabase();
  try {
    const index = await nextIndex(admin, "plan_blocks", "day_id", dayId);
    const { error } = await admin
      .from("plan_blocks")
      .insert({ day_id: dayId, index, kind });
    if (error) throw new Error(error.message);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBlock(
  planId: string,
  dayId: string,
  blockId: string,
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    const { error } = await admin.from("plan_blocks").delete().eq("id", blockId);
    if (error) throw new Error(error.message);
    await applyOrder(
      admin,
      "plan_blocks",
      await siblingIds(admin, "plan_blocks", "day_id", dayId),
    );
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function moveBlock(
  planId: string,
  dayId: string,
  blockId: string,
  dir: "up" | "down",
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    await moveSibling(admin, "plan_blocks", "day_id", dayId, blockId, dir);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function updateBlock(
  planId: string,
  blockId: string,
  kind: BlockKind,
): Promise<Result> {
  await requireAdmin();
  if (!BLOCK_KINDS.includes(kind)) return fail("Invalid block kind.");
  const admin = createAdminSupabase();
  try {
    const { error } = await admin
      .from("plan_blocks")
      .update({ kind })
      .eq("id", blockId);
    if (error) throw new Error(error.message);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

// ── Exercises ──────────────────────────────────────────────────────────────
export type ExerciseFields = {
  exercise_id: string;
  sets: number;
  reps: string;
  tempo: string | null;
  rest_seconds: number | null;
  weight_hint: string | null;
  notes: string | null;
};

function cleanFields(f: ExerciseFields) {
  return {
    exercise_id: f.exercise_id,
    sets: Number.isFinite(f.sets) && f.sets > 0 ? Math.trunc(f.sets) : 1,
    reps: (f.reps || "").trim() || "1",
    tempo: f.tempo?.trim() || null,
    rest_seconds:
      f.rest_seconds != null && Number.isFinite(f.rest_seconds)
        ? Math.max(0, Math.trunc(f.rest_seconds))
        : null,
    weight_hint: f.weight_hint?.trim() || null,
    notes: f.notes?.trim() || null,
  };
}

export async function addExercise(
  planId: string,
  blockId: string,
  fields: ExerciseFields,
): Promise<Result> {
  await requireAdmin();
  if (!fields.exercise_id) return fail("Pick an exercise.");
  const admin = createAdminSupabase();
  try {
    const index = await nextIndex(admin, "plan_exercises", "block_id", blockId);
    const { error } = await admin
      .from("plan_exercises")
      .insert({ block_id: blockId, index, ...cleanFields(fields) });
    if (error) throw new Error(error.message);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function updateExercise(
  planId: string,
  exerciseRowId: string,
  fields: ExerciseFields,
): Promise<Result> {
  await requireAdmin();
  if (!fields.exercise_id) return fail("Pick an exercise.");
  const admin = createAdminSupabase();
  try {
    const { error } = await admin
      .from("plan_exercises")
      .update(cleanFields(fields))
      .eq("id", exerciseRowId);
    if (error) throw new Error(error.message);
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExercise(
  planId: string,
  blockId: string,
  exerciseRowId: string,
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    const { error } = await admin
      .from("plan_exercises")
      .delete()
      .eq("id", exerciseRowId);
    if (error) throw new Error(error.message);
    await applyOrder(
      admin,
      "plan_exercises",
      await siblingIds(admin, "plan_exercises", "block_id", blockId),
    );
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}

export async function moveExercise(
  planId: string,
  blockId: string,
  exerciseRowId: string,
  dir: "up" | "down",
): Promise<Result> {
  await requireAdmin();
  const admin = createAdminSupabase();
  try {
    await moveSibling(
      admin,
      "plan_exercises",
      "block_id",
      blockId,
      exerciseRowId,
      dir,
    );
    touch(planId);
    return OK;
  } catch (e) {
    return fail(e);
  }
}
