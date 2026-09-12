import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseOption } from "./plans";

/** PostgREST caps a response at 1,000 rows; page instead of trimming the catalog. */
export async function loadCoachingCatalog(
  db: SupabaseClient,
): Promise<ExerciseOption[]> {
  const result: ExerciseOption[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("exercises")
      .select("id,name,demo_image_path")
      .order("name")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Could not load the exercise catalog.");
    result.push(...(data ?? []));
    if (!data || data.length < 1000) return result;
  }
}
