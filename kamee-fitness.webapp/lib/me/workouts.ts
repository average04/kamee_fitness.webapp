import { isMeasuredLiftingSet } from "./oneRepMax";
import { workoutTrainingIso } from "./workoutDate";
import type { SessionSetRow, StreakRow, WorkoutSessionRow } from "./queries";
import { inWindow, type DateWindow } from "./range";

export type WorkoutSummary = {
  sessions: number;
  currentStreak: number;
  longestStreak: number;
  totalVolumeKg: number;
  timeTrainedSeconds: number;
  missingDurationCount: number;
  perWeek: { week: string; count: number }[];
  topExercises: { exerciseId?: string; name: string; sets: number }[];
  prs: { exerciseId?: string; name: string; weightKg: number }[];
};

export function workoutTimeDisplay(summary: Pick<WorkoutSummary, 'timeTrainedSeconds' | 'missingDurationCount'>, format: (seconds: number) => string) {
  const missing = summary.missingDurationCount;
  return {
    label: missing ? 'Time recorded' : 'Time trained',
    value: missing && !summary.timeTrainedSeconds ? 'Not recorded' : format(summary.timeTrainedSeconds),
    sub: missing ? `${missing} workout${missing === 1 ? '' : 's'} without duration` : undefined,
  };
}

/** ISO week-start (Monday) UTC date key for a timestamp. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  const monday =
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    day * 86_400_000;
  return new Date(monday).toISOString().slice(0, 10);
}

export function summarizeWorkouts(
  workouts: WorkoutSessionRow[],
  sets: SessionSetRow[],
  exerciseNames: Record<string, string>,
  streaks: StreakRow,
  window: DateWindow,
): WorkoutSummary {
  const completed = workouts.filter(
    (w) => w.status === "completed" && inWindow(workoutTrainingIso(w), window),
  );
  const ids = new Set(completed.map((w) => w.id));
  const inSets = sets.filter((s) => ids.has(s.session_id));

  const totalVolumeKg = inSets.reduce(
    (sum, s) => sum + (isMeasuredLiftingSet({ reps: s.reps_done, weightKg: s.weight, trackingType: s.tracking_type }) ? s.reps_done! * s.weight! : 0),
    0,
  );
  const timeTrainedSeconds = completed.reduce(
    (sum, w) => sum + (w.duration_seconds ?? 0),
    0,
  );

  const perWeekMap = new Map<string, number>();
  for (const w of completed) {
    const k = weekKey(workoutTrainingIso(w));
    perWeekMap.set(k, (perWeekMap.get(k) ?? 0) + 1);
  }
  const perWeek = [...perWeekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  const setCount = new Map<string, number>();
  const prByName = new Map<string, number>();
  const nameByKey = new Map<string, string>();
  const identityByKey = new Map<string, string>();
  for (const s of inSets) {
    const name = s.name_snapshot ?? (s.exercise_key ? exerciseNames[s.exercise_key] : s.plan_exercise_id ? exerciseNames[s.plan_exercise_id] : undefined);
    if (!name) continue;
    const key = s.exercise_key ?? name;
    nameByKey.set(key, name);
    if (s.exercise_key) identityByKey.set(key, s.exercise_key);
    setCount.set(key, (setCount.get(key) ?? 0) + 1);
    if (isMeasuredLiftingSet({ reps: s.reps_done, weightKg: s.weight, trackingType: s.tracking_type }) && s.weight! > 0) {
      prByName.set(key, Math.max(prByName.get(key) ?? 0, s.weight!));
    }
  }
  const topExercises = [...setCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, sets]) => ({ ...(identityByKey.has(key) ? { exerciseId: identityByKey.get(key) } : {}), name: nameByKey.get(key)!, sets }));
  const prs = [...prByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, weightKg]) => ({ ...(identityByKey.has(key) ? { exerciseId: identityByKey.get(key) } : {}), name: nameByKey.get(key)!, weightKg }));

  return {
    sessions: completed.length,
    currentStreak: streaks?.current_streak ?? 0,
    longestStreak: streaks?.longest_streak ?? 0,
    totalVolumeKg,
    timeTrainedSeconds,
    missingDurationCount: completed.filter((w) => w.duration_seconds == null).length,
    perWeek,
    topExercises,
    prs,
  };
}
