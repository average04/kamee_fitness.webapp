import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type {
  BlockKind,
  DayKind,
  Plan,
  PlanKind,
  PlanWeekNode,
  ReviewStatus,
} from "@/lib/admin/plans";

export const PAGE_SIZE = 25;

export type PlanFilters = {
  q: string;
  kind: "all" | PlanKind;
  status: "all" | ReviewStatus;
  published: "all" | "yes" | "no";
};

export type PlanListResult = {
  rows: Plan[];
  count: number;
  page: number;
  pageCount: number;
};

export async function listPlans(
  filters: PlanFilters,
  page: number,
): Promise<PlanListResult> {
  const admin = createAdminSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = admin
    .from("plans")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.q) query = query.ilike("title", `%${filters.q}%`);
  if (filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.status !== "all") query = query.eq("review_status", filters.status);
  if (filters.published === "yes") query = query.eq("is_published", true);
  if (filters.published === "no") query = query.eq("is_published", false);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as Plan[],
    count: total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getPlan(id: string): Promise<Plan | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Plan) ?? null;
}

type RawExercise = {
  id: string;
  index: number;
  exercise_id: string;
  sets: number;
  reps: string;
  tempo: string | null;
  rest_seconds: number | null;
  weight_hint: string | null;
  notes: string | null;
  exercises: { name: string } | { name: string }[] | null;
};
type RawBlock = {
  id: string;
  index: number;
  kind: BlockKind;
  plan_exercises: RawExercise[] | null;
};
type RawDay = {
  id: string;
  index: number;
  title: string | null;
  day_kind: DayKind;
  plan_blocks: RawBlock[] | null;
};
type RawWeek = {
  id: string;
  index: number;
  plan_days: RawDay[] | null;
};

const byIndex = <T extends { index: number }>(a: T, b: T) => a.index - b.index;
const exName = (e: RawExercise) =>
  (Array.isArray(e.exercises) ? e.exercises[0]?.name : e.exercises?.name) ??
  null;

/** Fetch the full plan tree, assembled and ordered by `index` at each level. */
export async function getPlanTree(id: string): Promise<PlanWeekNode[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("plan_weeks")
    .select(
      `id, index,
       plan_days ( id, index, title, day_kind,
         plan_blocks ( id, index, kind,
           plan_exercises ( id, index, exercise_id, sets, reps, tempo, rest_seconds, weight_hint, notes,
             exercises ( name ) ) ) )`,
    )
    .eq("plan_id", id);
  if (error) throw new Error(error.message);

  const weeks = (data ?? []) as unknown as RawWeek[];
  return weeks
    .map((w) => ({
      id: w.id,
      index: w.index,
      days: (w.plan_days ?? [])
        .map((d) => ({
          id: d.id,
          index: d.index,
          title: d.title,
          day_kind: d.day_kind,
          blocks: (d.plan_blocks ?? [])
            .map((b) => ({
              id: b.id,
              index: b.index,
              kind: b.kind,
              exercises: (b.plan_exercises ?? [])
                .map((e) => ({
                  id: e.id,
                  index: e.index,
                  exercise_id: e.exercise_id,
                  exercise_name: exName(e),
                  sets: e.sets,
                  reps: e.reps,
                  tempo: e.tempo,
                  rest_seconds: e.rest_seconds,
                  weight_hint: e.weight_hint,
                  notes: e.notes,
                }))
                .sort(byIndex),
            }))
            .sort(byIndex),
        }))
        .sort(byIndex),
    }))
    .sort(byIndex);
}
