import { createServerSupabase } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/admin/exercises";

export const PAGE_SIZE = 25;

export type ExerciseListResult = {
  rows: Exercise[];
  count: number;
  page: number;
  pageCount: number;
};

export async function listExercises(
  q: string,
  page: number,
): Promise<ExerciseListResult> {
  const supabase = await createServerSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("exercises")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,slug.ilike.%${q}%,primary_muscle.ilike.%${q}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as Exercise[],
    count: total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Exercise) ?? null;
}

export async function getDistinctMuscles(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .select("primary_muscle");
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.primary_muscle) set.add(row.primary_muscle as string);
  }
  return [...set].sort();
}
