/**
 * Shared constants and helpers for the public plan surfaces: the partner API
 * (app/api/plans) and the public plan page (app/plans/[id]). Route files can't
 * export arbitrary names, so anything both surfaces need lives here.
 */

export const SITE_URL = "https://kamee.fit";

export const DISCIPLINES = ["strength", "running"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  strength: "Workouts",
  running: "Outdoor",
};

// Fixed public projection — never SELECT *.
export const PLAN_COLUMNS =
  "id, title, summary, cover_image_path, level, discipline, weeks_count, days_per_week, est_minutes_per_session";

export type PlanRow = {
  id: string;
  title: string;
  summary: string | null;
  cover_image_path: string | null;
  // Nullable in the DB (author-created plans may omit it); public surfaces
  // coalesce null to "none" so the partner contract stays a closed enum.
  level: "none" | "beginner" | "intermediate" | "advanced" | null;
  discipline: Discipline;
  weeks_count: number;
  days_per_week: number | null;
  est_minutes_per_session: number | null;
};

/** Public storage URL for a plan cover; null when the plan has none. */
export function planCoverUrl(coverImagePath: string | null): string | null {
  if (!coverImagePath) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${coverImagePath}`;
}

export function planWebUrl(id: string): string {
  return `${SITE_URL}/plans/${id}`;
}

/** Deep link into the mobile app's plan screen (expo-router `plan/[id]`). */
export function planAppUrl(id: string): string {
  return `kamee://plan/${id}`;
}
