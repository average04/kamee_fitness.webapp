import type { SupabaseClient } from "@supabase/supabase-js";

export type Units = "metric" | "imperial";

export type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  units: Units;
  target_weight_kg: number | null;
  target_date: string | null;
  weight_kg: number | null;
  is_premium: boolean | null;
};

export type WorkoutSessionRow = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  status: "completed" | "abandoned" | "active";
  avg_hr: number | null;
};

export type SessionSetRow = {
  session_id: string;
  plan_exercise_id: string | null;
  reps_done: number | null;
  weight: number | null;
};

export type TrackSessionRow = {
  id: string;
  mode: string;
  title: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  elevation_gain_meters: number | null;
  avg_hr: number | null;
  finished_at: string | null;
  created_at: string;
  route_points: unknown;
};

export type StreakRow = {
  current_streak: number;
  longest_streak: number;
  track_current_streak: number;
  track_longest_streak: number;
} | null;

export type WeightRow = { weight_kg: number; logged_at: string };

export type MeData = {
  profile: ProfileRow | null;
  workouts: WorkoutSessionRow[];
  sets: SessionSetRow[];
  exerciseNames: Record<string, string>;
  tracks: TrackSessionRow[];
  streaks: StreakRow;
  weights: WeightRow[];
};

export async function loadMeData(
  supabase: SupabaseClient,
  userId: string,
): Promise<MeData> {
  const [profileRes, workoutsRes, tracksRes, streaksRes, weightsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, avatar_url, units, target_weight_kg, target_date, weight_kg, is_premium",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds, status, avg_hr")
        .eq("user_id", userId)
        .order("started_at", { ascending: true }),
      supabase
        .from("track_sessions")
        .select(
          "id, mode, title, distance_meters, duration_seconds, elevation_gain_meters, avg_hr, finished_at, created_at, route_points",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("user_streaks")
        .select(
          "current_streak, longest_streak, track_current_streak, track_longest_streak",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("weight_log")
        .select("weight_kg, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true }),
    ]);

  const workouts = (workoutsRes.data ?? []) as WorkoutSessionRow[];

  // Sets for this user's sessions (RLS scopes by session ownership).
  const sessionIds = workouts.map((w) => w.id);
  let sets: SessionSetRow[] = [];
  if (sessionIds.length) {
    const setsRes = await supabase
      .from("session_sets")
      .select("session_id, plan_exercise_id, reps_done, weight")
      .in("session_id", sessionIds);
    sets = (setsRes.data ?? []) as SessionSetRow[];
  }

  // Resolve plan_exercise_id -> exercise name. Degrades to {} if RLS blocks.
  const exerciseNames: Record<string, string> = {};
  const planExIds = [
    ...new Set(sets.map((s) => s.plan_exercise_id).filter(Boolean) as string[]),
  ];
  if (planExIds.length) {
    const nameRes = await supabase
      .from("plan_exercises")
      .select("id, exercises(name)")
      .in("id", planExIds);
    for (const row of (nameRes.data ?? []) as Array<{
      id: string;
      exercises: { name: string | null } | { name: string | null }[] | null;
    }>) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      if (ex?.name) exerciseNames[row.id] = ex.name;
    }
  }

  return {
    profile: (profileRes.data ?? null) as ProfileRow | null,
    workouts,
    sets,
    exerciseNames,
    tracks: (tracksRes.data ?? []) as TrackSessionRow[],
    streaks: (streaksRes.data ?? null) as StreakRow,
    weights: (weightsRes.data ?? []) as WeightRow[],
  };
}
