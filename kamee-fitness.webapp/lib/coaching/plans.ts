import type { SessionSegments, SessionType } from "./outdoor/segments";

export type Video = {
  id: string;
  title: string;
  caption: string;
  status: "uploading" | "validating" | "ready" | "failed";
  failure_reason: string | null;
  duration_seconds: number | null;
  retired_at: string | null;
  provider_ref: string;
};
export type ExerciseOption = {
  id: string;
  name: string;
  demo_image_path?: string | null;
};
export type Exercise = {
  lineage_key: string;
  exercise_id: string;
  sets: number;
  reps: string;
  tempo: string | null;
  rest_seconds: number;
  weight_hint: string | null;
  notes: string | null;
  coaching_video_id: string | null;
};
export type Block = {
  lineage_key: string;
  kind: "warmup" | "main" | "cooldown" | "superset" | "circuit";
  exercises: Exercise[];
};
export type Cardio = {
  lineage_key: string;
  target_kind: "intervals" | "continuous";
  mode: "run" | "walk";
  target_seconds: number | null;
  guidance_config: {
    warmupWalkSec: number;
    runSec: number;
    walkSec: number;
  } | null;
  notes: string | null;
  segments: SessionSegments;
  session_type: SessionType | null;
};
export type Day = {
  lineage_key: string;
  title: string;
  day_kind: "workout" | "rest" | "active_recovery" | "run" | "hybrid";
  coaching_video_id: string | null;
  blocks: Block[];
  cardio: Cardio | null;
};
export type Week = {
  lineage_key: string;
  role: "build" | "cutback" | "taper" | "goal";
  days: Day[];
};
export type Nutrition = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
export type Ingredient = Nutrition & {
  name: string;
  quantity: number;
  unit: string;
};
export type Meal = Nutrition & {
  slot: string;
  title: string;
  portion_note: string;
  ingredients: Ingredient[];
  steps: string[];
  substitutions: { for: string; use: string; note: string }[];
  video_id: string | null;
};
export type MealDay = Nutrition & {
  lineage_key: string;
  day_key: string;
  shape: string;
  label: string;
  note: string;
  meals: Meal[];
};
export type Meals = {
  lineage_key: string;
  title: string;
  keyed_by: "weekday" | "day_kind";
  days: MealDay[];
};
export type PlanDocument = {
  id: string;
  listing_id: string;
  listing_status?: string;
  title: string;
  summary: string | null;
  goal: string | null;
  discipline: "strength" | "running";
  level: string;
  equipment_tier: string;
  required_equipment: string[];
  target_muscles: string[];
  weeks_count: number;
  est_minutes_per_session: number | null;
  cover_image_path: string | null;
  version_no: number;
  version_state: string;
  draft_revision: number;
  change_note: string | null;
  review_note: string | null;
  weeks: Week[];
  meals: Meals | null;
};
export type ActionResult = {
  error?: string;
  revision?: number;
  issues?: string[];
  id?: string;
};
export const stateLabel = (state: string) =>
  ({
    draft: "Draft",
    in_review: "In review",
    changes_requested: "Changes requested",
    approved: "Approved",
    superseded: "Previous version",
    retired: "Retired",
  })[state] ?? state;
export const editable = (plan: PlanDocument) =>
  ["draft", "changes_requested"].includes(plan.version_state);
export const newDay = (kind: Day["day_kind"] = "workout"): Day => ({
  lineage_key: crypto.randomUUID(),
  title: "",
  day_kind: kind,
  coaching_video_id: null,
  blocks: [],
  cardio: null,
});
export function move<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  if (index + delta < 0 || index + delta >= items.length) return next;
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}
/** Duplicated schedule nodes are new logical content; version clones preserve keys in SQL. */
export function duplicate<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, v) =>
    key === "lineage_key" ? crypto.randomUUID() : v,
  ) as T;
}
export function progressWeek(
  week: Week,
  sets: number,
  reps: number,
  rest: number,
): Week {
  const result = duplicate(week);
  for (const day of result.days)
    for (const block of day.blocks)
      for (const ex of block.exercises) {
        ex.sets = Math.max(1, Math.min(30, ex.sets + sets));
        if (/^\d+$/.test(ex.reps))
          ex.reps = String(Math.max(1, Number(ex.reps) + reps));
        ex.rest_seconds = Math.max(0, Math.min(3600, ex.rest_seconds + rest));
      }
  return result;
}
export const emptyNutrition = (): Nutrition => ({
  kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
});
export const dayKeys = (kind: Meals["keyed_by"]) =>
  kind === "weekday"
    ? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    : ["long_run", "long_run_eve", "run", "strength", "rest"];
export const newMeals = (): Meals => ({
  lineage_key: crypto.randomUUID(),
  title: "Meals",
  keyed_by: "weekday",
  days: dayKeys("weekday").map((day_key) => ({
    ...emptyNutrition(),
    kcal: 2000,
    lineage_key: crypto.randomUUID(),
    day_key,
    shape: "steady",
    label: day_key,
    note: "",
    meals: [],
  })),
});
