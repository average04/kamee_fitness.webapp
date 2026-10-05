import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanProgressInput } from "./plan";
import type { SetWithExercise } from "./workoutDetail";
import type { SetWithDate } from "./exerciseHistory";
import { parseExerciseKey, type ExerciseKey } from "./exerciseIdentity";
import { isMeasuredLiftingSet, type TrackingType } from "./oneRepMax";
import { workoutDate, workoutTrainingIso } from "./workoutDate";

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
  source?: "planned" | "freestyle";
  entry_mode?: "live" | "past" | null;
  performed_date?: string | null;
  timestamp_precision?: "instant" | "date" | null;
  submitted_at?: string | null;
  title?: string | null;
  ended_at?: string | null;
  max_hr?: number | null;
  timezone?: string | null;
};

export type SessionSetRow = {
  session_id: string;
  plan_exercise_id: string | null;
  reps_done: number | null;
  weight: number | null;
  exercise_key?: ExerciseKey;
  occurrence_id?: string;
  tracking_type?: TrackingType;
  duration_seconds?: number | null;
  name_snapshot?: string;
  muscle_snapshot?: string[];
  position?: number;
  ordinal?: number;
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
  muscleByExercise: Record<string, string>;
};

/** Page deterministic owner reads and keep ID filters within a modest request size. */
async function readRows<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data } = await query(from, from + pageSize - 1);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function readRelatedRows<T>(ids: string[], query: (ids: string[], from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    rows.push(...await readRows<T>((from, to) => query(chunk, from, to)));
  }
  return rows;
}

type WorkoutData = Pick<MeData, "workouts" | "sets" | "exerciseNames" | "dayTitleBySession" | "exerciseIdByPlanEx" | "nameByExercise" | "muscleByExercise">;
async function loadWorkoutData(supabase: SupabaseClient, userId: string): Promise<WorkoutData> {
  const workouts = await readRows<WorkoutSessionRow>((from, to) => supabase.from("workout_sessions")
    .select("id, started_at, ended_at, duration_seconds, status, avg_hr, max_hr, day_id, source, entry_mode, performed_date, timestamp_precision, submitted_at, title, timezone")
    .eq("user_id", userId).order("id").range(from, to).throwOnError());

  // Sets for this user's sessions (RLS scopes by session ownership).
  const sessionIds = workouts.map((w) => w.id);
  let sets: SessionSetRow[] = [];
  if (sessionIds.length) {
    sets = await readRelatedRows<SessionSetRow>(sessionIds, (ids, from, to) => supabase
      .from("session_sets").select("session_id, plan_exercise_id, reps_done, weight")
      .in("session_id", ids).order("id").range(from, to).throwOnError());
  }

  // Resolve owner-referenced plan exercises into qualified catalog identities.
  const exerciseNames: Record<string, string> = {};
  const exerciseIdByPlanEx: Record<string, ExerciseKey> = {};
  const nameByExercise: Record<string, string> = {};
  const muscleByExercise: Record<string, string> = {};
  const planExIds = [
    ...new Set(sets.map((s) => s.plan_exercise_id).filter(Boolean) as string[]),
  ];
  if (planExIds.length) {
    type PlanExercise = {
      id: string;
      exercise_id: string | null;
      exercises: { name: string | null; primary_muscle?: string | null } | { name: string | null; primary_muscle?: string | null }[] | null;
    };
    const planExercises = await readRelatedRows<PlanExercise>(planExIds, (ids, from, to) => supabase
      .from("plan_exercises").select("id, exercise_id, exercises(name, primary_muscle)")
      .in("id", ids).order("id").range(from, to).throwOnError());
    for (const row of planExercises) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      const name = ex?.name ?? null;
      if (row.exercise_id) {
        const key = parseExerciseKey(row.exercise_id).key;
        exerciseIdByPlanEx[`planned:${row.id}`] = key;
        if (name) exerciseNames[key] = nameByExercise[key] = name;
        if (ex?.primary_muscle) muscleByExercise[key] = ex.primary_muscle;
      }
    }
  }

  sets = sets.map((row) => {
    const key = row.plan_exercise_id ? exerciseIdByPlanEx[`planned:${row.plan_exercise_id}`] : undefined;
    return { ...row, exercise_key: key, occurrence_id: row.plan_exercise_id ?? undefined, tracking_type: "weight_reps" };
  });

  // New children are bound to BOTH the authenticated owner and these owned parents.
  if (sessionIds.length) {
    type Occurrence = { id: string; session_id: string; source: "catalog" | "personal"; source_exercise_id: string; name_snapshot: string; tracking_type: TrackingType; muscle_snapshot: string[]; position: number };
    type OccurrenceSet = { session_id: string; occurrence_id: string; ordinal: number; tracking_type: TrackingType; reps: number | null; weight_kg: number | null; duration_seconds: number | null };
    const [occRows, setRows] = await Promise.all([
      readRelatedRows<Occurrence>(sessionIds, (ids, from, to) => supabase.from("workout_occurrences")
        .select("id, session_id, source, source_exercise_id, name_snapshot, tracking_type, muscle_snapshot, position")
        .eq("user_id", userId).in("session_id", ids).order("id").range(from, to).throwOnError()),
      readRelatedRows<OccurrenceSet>(sessionIds, (ids, from, to) => supabase.from("workout_occurrence_sets")
        .select("session_id, occurrence_id, ordinal, tracking_type, reps, weight_kg, duration_seconds")
        .eq("user_id", userId).in("session_id", ids).order("id").range(from, to).throwOnError()),
    ]);
    const occurrences = new Map(occRows.map((o) => [o.id, o]));
    for (const row of setRows) {
      const occ = occurrences.get(row.occurrence_id);
      if (!occ || occ.session_id !== row.session_id || occ.tracking_type !== row.tracking_type) continue;
      const key = parseExerciseKey(`${occ.source}:${occ.source_exercise_id}`).key;
      // History uses immutable snapshots even if the definition was renamed, archived or removed.
      exerciseNames[key] ??= occ.name_snapshot;
      nameByExercise[key] ??= occ.name_snapshot;
      if (occ.muscle_snapshot[0]) muscleByExercise[key] ??= occ.muscle_snapshot[0];
      sets.push({ session_id: row.session_id, plan_exercise_id: null, exercise_key: key,
        occurrence_id: occ.id, tracking_type: occ.tracking_type, reps_done: row.reps,
        weight: row.weight_kg, duration_seconds: row.duration_seconds,
        name_snapshot: occ.name_snapshot, muscle_snapshot: occ.muscle_snapshot,
        position: occ.position, ordinal: row.ordinal });
    }
  }

  // Resolve each workout session's plan-day title for the feed.
  const dayTitleBySession: Record<string, string> = {};
  const dayIds = [
    ...new Set(workouts.map((w) => w.day_id).filter(Boolean) as string[]),
  ];
  if (dayIds.length) {
    const days = await readRelatedRows<{ id: string; title: string | null }>(dayIds, (ids, from, to) => supabase
      .from("plan_days").select("id, title").in("id", ids).order("id").range(from, to).throwOnError());
    const titleByDay = new Map(
      days.map((d) => [
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

  for (const w of workouts) {
    if (w.source === "freestyle") dayTitleBySession[w.id] = w.title?.trim() || "Freestyle workout";
  }

  return { workouts, sets, exerciseNames, dayTitleBySession, exerciseIdByPlanEx, nameByExercise, muscleByExercise };
}

export async function loadMeData(supabase: SupabaseClient, userId: string): Promise<MeData> {
  const [profileRes, workoutData, tracksRes, streaksRes, weightsRes] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url, units, target_weight_kg, target_date, weight_kg, is_premium, days_per_week").eq("id", userId).maybeSingle(),
    loadWorkoutData(supabase, userId),
    supabase.from("track_sessions").select("id, mode, title, distance_meters, duration_seconds, elevation_gain_meters, elevation_loss_meters, avg_hr, max_hr, finished_at, created_at, route_points").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("user_streaks").select("current_streak, longest_streak, track_current_streak, track_longest_streak").eq("user_id", userId).maybeSingle(),
    supabase.from("weight_log").select("weight_kg, logged_at").eq("user_id", userId).order("logged_at", { ascending: true }),
  ]);
  return {
    ...workoutData, profile: (profileRes.data ?? null) as ProfileRow | null,
    tracks: (tracksRes.data ?? []) as TrackSessionRow[], streaks: (streaksRes.data ?? null) as StreakRow,
    weights: (weightsRes.data ?? []) as WeightRow[],
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
    performedDate: string;
    timestampPrecision: "instant" | "date";
    timezone: string | null;
  };
  dayTitle: string;
  ratingLabel: string | null;
  current: SetWithExercise[];
  previous: SetWithExercise[];
  names: Record<string, string>;
  muscleByExercise: Record<string, string>;
  priorMax: Record<string, number>;
};

/** Keep nullable measurements intact at every consumer boundary. */
export function toSets(rows: SessionSetRow[]): SetWithExercise[] {
  return rows.filter((r) => r.exercise_key).map((r) => ({
    exerciseId: r.exercise_key!, sessionId: r.session_id, occurrenceId: r.occurrence_id,
    trackingType: r.tracking_type ?? "weight_reps", reps: r.reps_done, weightKg: r.weight,
    durationSeconds: r.duration_seconds ?? null, position: r.position, ordinal: r.ordinal,
    name: r.name_snapshot, primaryMuscle: r.muscle_snapshot?.[0],
  }));
}

export async function loadWorkoutDetail(
  supabase: SupabaseClient, userId: string, sessionId: string,
): Promise<WorkoutDetailData | null> {
  // Resolve the owner boundary before reading any child or feedback data.
  const { data: session } = await supabase.from("workout_sessions")
    .select("id, started_at, ended_at, duration_seconds, avg_hr, max_hr, day_id, source, entry_mode, performed_date, timestamp_precision, submitted_at, title, status, timezone")
    .eq("id", sessionId).eq("user_id", userId).maybeSingle().throwOnError();
  if (!session) return null;
  const sess = session as WorkoutSessionRow;
  const data = await loadWorkoutData(supabase, userId);
  const current = toSets(data.sets.filter((r) => r.session_id === sessionId));
  const priorSessions = data.workouts.filter((w) => w.status === "completed" && w.id !== sessionId &&
    (workoutDate(w) < workoutDate(sess) || (workoutDate(w) === workoutDate(sess) &&
      w.timestamp_precision !== "date" && sess.timestamp_precision !== "date" && w.started_at < sess.started_at)));
  const priorIds = new Set(priorSessions.map((w) => w.id));
  const priorSets = toSets(data.sets.filter((r) => priorIds.has(r.session_id)));
  const priorMax: Record<string, number> = {};
  for (const row of priorSets) {
    if (isMeasuredLiftingSet(row)) priorMax[row.exerciseId] = Math.max(priorMax[row.exerciseId] ?? 0, row.weightKg);
  }
  const previousSession = sess.day_id ? priorSessions.filter((w) => w.day_id === sess.day_id)
    .sort((a, b) => workoutTrainingIso(b).localeCompare(workoutTrainingIso(a)))[0] : undefined;
  const { data: feedback } = await supabase.from("workout_session_feedback").select("overall_rating")
    .eq("session_id", sessionId).maybeSingle();
  const rating = (feedback as { overall_rating?: string } | null)?.overall_rating;
  return {
    session: { id: sess.id, startedAt: sess.started_at, endedAt: sess.ended_at ?? null,
      durationSeconds: sess.duration_seconds, avgHr: sess.avg_hr, maxHr: sess.max_hr ?? null,
      performedDate: workoutDate(sess), timestampPrecision: sess.timestamp_precision ?? "instant", timezone: sess.timezone ?? null },
    dayTitle: data.dayTitleBySession[sess.id] ?? "Workout",
    ratingLabel: rating ? RATING_LABEL[rating] ?? null : null,
    current, previous: previousSession ? toSets(data.sets.filter((r) => r.session_id === previousSession.id)) : [],
    names: data.nameByExercise, muscleByExercise: data.muscleByExercise, priorMax,
  };
}

export async function loadExerciseHistory(
  supabase: SupabaseClient, userId: string, exerciseId: string,
): Promise<{ name: string; primaryMuscle: string | null; demoImagePath: string | null; sets: SetWithDate[] } | null> {
  let identity: ReturnType<typeof parseExerciseKey>;
  try { identity = parseExerciseKey(exerciseId); } catch { return null; }
  const data = await loadWorkoutData(supabase, userId);
  const completed = new Map(data.workouts.filter((w) => w.status === "completed").map((w) => [w.id, w]));
  const rows = data.sets.filter((r) => r.exercise_key === identity.key && completed.has(r.session_id));
  const snapshot = rows.find((r) => r.name_snapshot);
  let meta: { name: string; primary_muscle?: string | null; demo_image_path?: string | null; muscles?: string[] } | null = null;
  if (identity.source === "catalog") {
    const { data: ex } = await supabase.from("exercises").select("name, primary_muscle, demo_image_path")
      .eq("id", identity.id).maybeSingle().throwOnError();
    meta = ex;
  } else if (!snapshot) {
    // A private UUID is NEVER retried against the public catalog.
    const { data: ex } = await supabase.from("personal_exercises").select("name, muscles")
      .eq("id", identity.id).eq("user_id", userId).maybeSingle().throwOnError();
    meta = ex;
  }
  if (!meta && !snapshot) return null;
  return {
    name: identity.source === "personal" && snapshot ? snapshot.name_snapshot! : meta?.name ?? snapshot?.name_snapshot ?? "Exercise",
    primaryMuscle: meta?.primary_muscle ?? meta?.muscles?.[0] ?? snapshot?.muscle_snapshot?.[0] ?? null,
    demoImagePath: identity.source === "catalog" ? meta?.demo_image_path ?? null : null,
    sets: toSets(rows).map((r) => {
      const session = completed.get(r.sessionId!)!;
      return {
        ...r, dateIso: workoutDate(session), source: session.source ?? "planned",
        startedAt: session.started_at,
        timestampPrecision: session.timestamp_precision ?? (session.source === "freestyle" ? "date" : "instant"),
      };
    }),
  };
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
