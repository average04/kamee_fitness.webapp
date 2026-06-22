import type { SessionSetRow, StreakRow, WorkoutSessionRow } from "./queries";
import { inWindow, type DateWindow } from "./range";

export type WorkoutSummary = {
  sessions: number;
  currentStreak: number;
  longestStreak: number;
  totalVolumeKg: number;
  timeTrainedSeconds: number;
  perWeek: { week: string; count: number }[];
  topExercises: { name: string; sets: number }[];
  prs: { name: string; weightKg: number }[];
};

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
    (w) => w.status === "completed" && inWindow(w.started_at, window),
  );
  const ids = new Set(completed.map((w) => w.id));
  const inSets = sets.filter((s) => ids.has(s.session_id));

  const totalVolumeKg = inSets.reduce(
    (sum, s) => sum + (s.reps_done ?? 0) * (s.weight ?? 0),
    0,
  );
  const timeTrainedSeconds = completed.reduce(
    (sum, w) => sum + (w.duration_seconds ?? 0),
    0,
  );

  const perWeekMap = new Map<string, number>();
  for (const w of completed) {
    const k = weekKey(w.started_at);
    perWeekMap.set(k, (perWeekMap.get(k) ?? 0) + 1);
  }
  const perWeek = [...perWeekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  const setCount = new Map<string, number>();
  const prByName = new Map<string, number>();
  for (const s of inSets) {
    const name = s.plan_exercise_id
      ? exerciseNames[s.plan_exercise_id]
      : undefined;
    if (!name) continue;
    setCount.set(name, (setCount.get(name) ?? 0) + 1);
    if (s.weight != null) {
      prByName.set(name, Math.max(prByName.get(name) ?? 0, s.weight));
    }
  }
  const topExercises = [...setCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sets]) => ({ name, sets }));
  const prs = [...prByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, weightKg]) => ({ name, weightKg }));

  return {
    sessions: completed.length,
    currentStreak: streaks?.current_streak ?? 0,
    longestStreak: streaks?.longest_streak ?? 0,
    totalVolumeKg,
    timeTrainedSeconds,
    perWeek,
    topExercises,
    prs,
  };
}
