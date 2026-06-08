/**
 * Types and pure helpers for the plan-management admin. No I/O — safe to
 * unit-test and to import from both client and server modules. Mirrors the
 * shape of `lib/admin/exercises.ts`.
 */

import { parseList } from "./exercises";

export const EXPERIENCE_LEVELS = [
  "none",
  "beginner",
  "intermediate",
  "advanced",
] as const;
export const EQUIPMENT_TIERS = ["bodyweight", "minimal", "full_gym"] as const;
export const REVIEW_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "rejected",
] as const;
export const PLAN_KINDS = ["system", "custom"] as const;
export const DAY_KINDS = ["workout", "rest", "active_recovery"] as const;
export const BLOCK_KINDS = [
  "warmup",
  "main",
  "cooldown",
  "superset",
  "circuit",
] as const;

export type Experience = (typeof EXPERIENCE_LEVELS)[number];
export type EquipmentTier = (typeof EQUIPMENT_TIERS)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type PlanKind = (typeof PLAN_KINDS)[number];
export type DayKind = (typeof DAY_KINDS)[number];
export type BlockKind = (typeof BLOCK_KINDS)[number];

export type PlanInput = {
  title: string;
  summary: string | null;
  goal: string | null;
  level: Experience;
  weeks_count: number;
  est_minutes_per_session: number | null;
  price_cents: number;
  currency: string;
  equipment_tier: EquipmentTier;
  required_equipment: string[];
  target_muscles: string[];
  kind: PlanKind;
  cover_image_path: string | null;
};

export type Plan = PlanInput & {
  id: string;
  author_id: string | null;
  is_published: boolean;
  is_default: boolean;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

/** Plan tree nodes (Phase 2). */
export type PlanExerciseNode = {
  id: string;
  index: number;
  exercise_id: string;
  exercise_name: string | null;
  sets: number;
  reps: string;
  tempo: string | null;
  rest_seconds: number | null;
  weight_hint: string | null;
  notes: string | null;
};
export type PlanBlockNode = {
  id: string;
  index: number;
  kind: BlockKind;
  exercises: PlanExerciseNode[];
};
export type PlanDayNode = {
  id: string;
  index: number;
  title: string | null;
  day_kind: DayKind;
  blocks: PlanBlockNode[];
};
export type PlanWeekNode = {
  id: string;
  index: number;
  days: PlanDayNode[];
};

/** Form state returned by the create/update Server Actions to `useActionState`. */
export type PlanFormState = {
  errors?: Record<string, string>;
  message?: string;
};

const inEnum = (list: readonly string[], v: string) => list.includes(v);

/** Parse an int from a form value, falling back to `fallback` on garbage. */
function parseInt0(raw: FormDataEntryValue | null, fallback: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parsePlanForm(formData: FormData): PlanInput {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const orNull = (v: string) => (v ? v : null);
  const estRaw = str("est_minutes_per_session");

  return {
    title: str("title"),
    summary: orNull(str("summary")),
    goal: orNull(str("goal")),
    level: (str("level") || "beginner") as Experience,
    weeks_count: parseInt0(formData.get("weeks_count"), 1),
    est_minutes_per_session: estRaw ? parseInt0(estRaw, 0) : null,
    price_cents: parseInt0(formData.get("price_cents"), 0),
    currency: (str("currency") || "USD").toUpperCase(),
    equipment_tier: (str("equipment_tier") || "bodyweight") as EquipmentTier,
    required_equipment: parseList(formData.get("required_equipment") as string),
    target_muscles: parseList(formData.get("target_muscles") as string),
    kind: (str("kind") || "custom") as PlanKind,
    cover_image_path: orNull(str("cover_image_path")),
  };
}

export type ValidationResult =
  | { ok: true; value: PlanInput }
  | { ok: false; errors: Record<string, string> };

export function validatePlanInput(input: PlanInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = "Title is required.";
  if (
    !Number.isInteger(input.weeks_count) ||
    input.weeks_count < 1 ||
    input.weeks_count > 52
  )
    errors.weeks_count = "Weeks must be between 1 and 52.";
  if (input.price_cents < 0) errors.price_cents = "Price cannot be negative.";
  if (!inEnum(EXPERIENCE_LEVELS, input.level)) errors.level = "Invalid level.";
  if (!inEnum(EQUIPMENT_TIERS, input.equipment_tier))
    errors.equipment_tier = "Invalid equipment tier.";
  if (!inEnum(PLAN_KINDS, input.kind)) errors.kind = "Invalid kind.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input };
}

/**
 * Swap `id` with its neighbor in the given direction and return the new id
 * order. No-op at the edges or for an unknown id. Used to compute the new
 * `index` assignments for a sibling reorder.
 */
export function reorder(
  ids: string[],
  id: string,
  dir: "up" | "down",
): string[] {
  const i = ids.indexOf(id);
  if (i < 0) return ids;
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return ids;
  const next = ids.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
