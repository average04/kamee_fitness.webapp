import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanProgressInput } from "./plan";
import type { SetWithExercise } from "./workoutDetail";
import type { SetWithDate } from "./exerciseHistory";

export type Units = "metric" | "imperial";

/** Just the user's unit preference — cheap query for detail pages. */
export async function loadUnits(
  supabase: SupabaseClient,
  userId: string,
): Promise<Units> {
  const { data } = await supabase
    .from("profiles")
    .select("units")
    .eq("id", userId)
    .maybeSingle();
  return ((data as { units?: Units } | null)?.units ?? "metric") as Units;
}

/** Public Storage URL for an exercise demo image path. */
export function exerciseDemoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/exercise-demos/${path}`;
}

export type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  units: Units;
  target_weight_kg: number | null;
  target_date: string | null;
  weight_kg: number | null;
  is_premium: boolean | null;
  days_per_week: number | null;
};

export type WorkoutSessionRow = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  status: "completed" | "abandoned" | "active";
  avg_hr: number | null;
  day_id: string | null;
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
  elevation_loss_meters: number | null;
  avg_hr: number | null;
  max_hr: number | null;
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
  dayTitleBySession: Record<string, string>;
  exerciseIdByPlanEx: Record<string, string>;
  nameByExercise: Record<string, string>;
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
          "display_name, avatar_url, units, target_weight_kg, target_date, weight_kg, is_premium, days_per_week",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds, status, avg_hr, day_id")
        .eq("user_id", userId)
        .order("started_at", { ascending: true }),
      supabase
        .from("track_sessions")
        .select(
          "id, mode, title, distance_meters, duration_seconds, elevation_gain_meters, elevation_loss_meters, avg_hr, max_hr, finished_at, created_at, route_points",
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
  const exerciseIdByPlanEx: Record<string, string> = {};
  const nameByExercise: Record<string, string> = {};
  const planExIds = [
    ...new Set(sets.map((s) => s.plan_exercise_id).filter(Boolean) as string[]),
  ];
  if (planExIds.length) {
    const nameRes = await supabase
      .from("plan_exercises")
      .select("id, exercise_id, exercises(name)")
      .in("id", planExIds);
    for (const row of (nameRes.data ?? []) as Array<{
      id: string;
      exercise_id: string | null;
      exercises: { name: string | null } | { name: string | null }[] | null;
    }>) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      const name = ex?.name ?? null;
      if (name) exerciseNames[row.id] = name;
      if (row.exercise_id) {
        exerciseIdByPlanEx[row.id] = row.exercise_id;
        if (name) nameByExercise[row.exercise_id] = name;
      }
    }
  }

  // Resolve each workout session's plan-day title for the feed.
  const dayTitleBySession: Record<string, string> = {};
  const dayIds = [
    ...new Set(workouts.map((w) => w.day_id).filter(Boolean) as string[]),
  ];
  if (dayIds.length) {
    const daysRes = await supabase
      .from("plan_days")
      .select("id, title")
      .in("id", dayIds);
    const titleByDay = new Map(
      ((daysRes.data ?? []) as { id: string; title: string | null }[]).map((d) => [
        d.id,
        d.title ?? "Workout",
      ]),
    );
    for (const w of workouts) {
      if (w.day_id && titleByDay.has(w.day_id)) {
        dayTitleBySession[w.id] = titleByDay.get(w.day_id)!;
      }
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
    dayTitleBySession,
    exerciseIdByPlanEx,
    nameByExercise,
  };
}

export async function loadPlanProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanProgressInput> {
  const { data: up } = await supabase
    .from("user_plans")
    .select("plan_id, current_week")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!up) return null;
  const { data: plan } = await supabase
    .from("plans")
    .select("title, weeks_count")
    .eq("id", (up as { plan_id: string }).plan_id)
    .maybeSingle();
  if (!plan) return null;
  const p = plan as { title: string | null; weeks_count: number | null };
  return {
    title: p.title ?? "Your plan",
    currentWeek: (up as { current_week: number | null }).current_week ?? 0,
    totalWeeks: p.weeks_count ?? 0,
  };
}

const RATING_LABEL: Record<string, string> = {
  too_easy: "Too easy",
  just_right: "Just right",
  too_hard: "Too hard",
};

export type WorkoutDetailData = {
  session: {
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    avgHr: number | null;
    maxHr: number | null;
  };
  dayTitle: string;
  ratingLabel: string | null;
  current: SetWithExercise[];
  previous: SetWithExercise[];
  names: Record<string, string>;
  muscleByExercise: Record<string, string>;
  priorMax: Record<string, number>;
};

type RawSetRow = {
  plan_exercise_id: string | null;
  reps_done: number | null;
  weight: number | null;
};

/** Map raw session_sets rows + a planEx→exercise map into SetWithExercise. */
function toSets(
  rows: RawSetRow[],
  exByPlanEx: Map<string, { id: string; name: string }>,
): SetWithExercise[] {
  const out: SetWithExercise[] = [];
  for (const r of rows) {
    const ex = r.plan_exercise_id ? exByPlanEx.get(r.plan_exercise_id) : undefined;
    if (!ex) continue;
    out.push({ exerciseId: ex.id, reps: r.reps_done ?? 0, weightKg: r.weight ?? 0 });
  }
  return out;
}

export async function loadWorkoutDetail(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<WorkoutDetailData | null> {
  const { data: s } = await supabase
    .from("workout_sessions")
    .select(
      "id, user_id, day_id, started_at, ended_at, duration_seconds, avg_hr, max_hr, status",
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!s) return null;
  const sess = s as {
    id: string;
    day_id: string | null;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    avg_hr: number | null;
    max_hr: number | null;
  };

  const [curRowsRes, fbRes, dayRes] = await Promise.all([
    supabase
      .from("session_sets")
      .select("plan_exercise_id, reps_done, weight")
      .eq("session_id", sessionId),
    supabase
      .from("workout_session_feedback")
      .select("overall_rating")
      .eq("session_id", sessionId)
      .maybeSingle(),
    sess.day_id
      ? supabase.from("plan_days").select("title").eq("id", sess.day_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const curRows = (curRowsRes.data ?? []) as RawSetRow[];

  // Previous completed session of the same workout day.
  let prevRows: RawSetRow[] = [];
  if (sess.day_id) {
    const { data: prevSession } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("day_id", sess.day_id)
      .eq("status", "completed")
      .lt("started_at", sess.started_at)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevSession) {
      const { data } = await supabase
        .from("session_sets")
        .select("plan_exercise_id, reps_done, weight")
        .eq("session_id", (prevSession as { id: string }).id);
      prevRows = (data ?? []) as RawSetRow[];
    }
  }

  // Resolve plan_exercise_id -> { exercise id, name } for all involved rows.
  const planExIds = [
    ...new Set(
      [...curRows, ...prevRows]
        .map((r) => r.plan_exercise_id)
        .filter(Boolean) as string[],
    ),
  ];
  const exByPlanEx = new Map<string, { id: string; name: string }>();
  const muscleByExercise: Record<string, string> = {};
  if (planExIds.length) {
    const { data: pe } = await supabase
      .from("plan_exercises")
      .select("id, exercise_id, exercises(id, name, primary_muscle)")
      .in("id", planExIds);
    for (const row of (pe ?? []) as Array<{
      id: string;
      exercise_id: string;
      exercises:
        | { id: string; name: string | null; primary_muscle: string | null }
        | { id: string; name: string | null; primary_muscle: string | null }[]
        | null;
    }>) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      if (ex) {
        exByPlanEx.set(row.id, { id: ex.id, name: ex.name ?? "Exercise" });
        if (ex.primary_muscle) muscleByExercise[ex.id] = ex.primary_muscle;
      }
    }
  }

  const current = toSets(curRows, exByPlanEx);
  const previous = toSets(prevRows, exByPlanEx);
  const names: Record<string, string> = {};
  for (const v of exByPlanEx.values()) names[v.id] = v.name;

  // Prior all-time max weight per exercise BEFORE this session (for PRs).
  const priorMax: Record<string, number> = {};
  const exIds = [...new Set(current.map((c) => c.exerciseId))];
  if (exIds.length) {
    const { data: peIds } = await supabase
      .from("plan_exercises")
      .select("id, exercise_id")
      .in("exercise_id", exIds);
    const exByPe = new Map(
      ((peIds ?? []) as { id: string; exercise_id: string }[]).map((r) => [
        r.id,
        r.exercise_id,
      ]),
    );
    if (exByPe.size) {
      const { data: priorSessions } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .lt("started_at", sess.started_at);
      const priorIds = ((priorSessions ?? []) as { id: string }[]).map((r) => r.id);
      if (priorIds.length) {
        const { data: priorSets } = await supabase
          .from("session_sets")
          .select("plan_exercise_id, weight")
          .in("session_id", priorIds)
          .in("plan_exercise_id", [...exByPe.keys()]);
        for (const r of (priorSets ?? []) as {
          plan_exercise_id: string | null;
          weight: number | null;
        }[]) {
          const ex = r.plan_exercise_id ? exByPe.get(r.plan_exercise_id) : undefined;
          if (!ex || r.weight == null) continue;
          priorMax[ex] = Math.max(priorMax[ex] ?? 0, r.weight);
        }
      }
    }
  }

  const dayTitle = (dayRes.data as { title?: string | null } | null)?.title ?? "Workout";
  const rating = fbRes.data as { overall_rating?: string } | null;
  const ratingLabel =
    rating && rating.overall_rating
      ? RATING_LABEL[rating.overall_rating] ?? null
      : null;

  return {
    session: {
      id: sess.id,
      startedAt: sess.started_at,
      endedAt: sess.ended_at,
      durationSeconds: sess.duration_seconds,
      avgHr: sess.avg_hr,
      maxHr: sess.max_hr,
    },
    dayTitle,
    ratingLabel,
    current,
    previous,
    names,
    muscleByExercise,
    priorMax,
  };
}

export async function loadExerciseHistory(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string,
): Promise<{
  name: string;
  primaryMuscle: string | null;
  demoImagePath: string | null;
  sets: SetWithDate[];
} | null> {
  const { data: ex } = await supabase
    .from("exercises")
    .select("name, primary_muscle, demo_image_path")
    .eq("id", exerciseId)
    .maybeSingle();
  if (!ex) return null;
  const meta = ex as {
    name: string | null;
    primary_muscle: string | null;
    demo_image_path: string | null;
  };
  const name = meta.name ?? "Exercise";
  const primaryMuscle = meta.primary_muscle;
  const demoImagePath = meta.demo_image_path;

  const { data: peRows } = await supabase
    .from("plan_exercises")
    .select("id")
    .eq("exercise_id", exerciseId);
  const peIds = ((peRows ?? []) as { id: string }[]).map((r) => r.id);
  if (!peIds.length) return { name, primaryMuscle, demoImagePath, sets: [] };

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("status", "completed");
  const dateById = new Map(
    ((sessions ?? []) as { id: string; started_at: string }[]).map((s) => [
      s.id,
      s.started_at.slice(0, 10),
    ]),
  );
  if (!dateById.size) return { name, primaryMuscle, demoImagePath, sets: [] };

  const { data: setRows } = await supabase
    .from("session_sets")
    .select("session_id, reps_done, weight")
    .in("plan_exercise_id", peIds)
    .in("session_id", [...dateById.keys()]);

  const sets: SetWithDate[] = [];
  for (const r of (setRows ?? []) as {
    session_id: string;
    reps_done: number | null;
    weight: number | null;
  }[]) {
    const dateIso = dateById.get(r.session_id);
    if (!dateIso || r.weight == null) continue;
    sets.push({ dateIso, reps: r.reps_done ?? 0, weightKg: r.weight });
  }
  return { name, primaryMuscle, demoImagePath, sets };
}

export async function loadTrackDetail(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
): Promise<{
  track: TrackSessionRow;
  previous: { distanceM: number; durationS: number } | null;
} | null> {
  const { data: t } = await supabase
    .from("track_sessions")
    .select(
      "id, user_id, mode, title, distance_meters, duration_seconds, elevation_gain_meters, elevation_loss_meters, avg_hr, max_hr, finished_at, created_at, route_points",
    )
    .eq("id", trackId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!t) return null;
  const track = t as TrackSessionRow;
  const when = track.finished_at ?? track.created_at;

  const { data: prev } = await supabase
    .from("track_sessions")
    .select("distance_meters, duration_seconds, finished_at, created_at")
    .eq("user_id", userId)
    .eq("mode", track.mode)
    .neq("id", trackId)
    .or(`finished_at.lt.${when},and(finished_at.is.null,created_at.lt.${when})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previous = prev
    ? {
        distanceM: (prev as { distance_meters: number | null }).distance_meters ?? 0,
        durationS: (prev as { duration_seconds: number | null }).duration_seconds ?? 0,
      }
    : null;
  return { track, previous };
}
