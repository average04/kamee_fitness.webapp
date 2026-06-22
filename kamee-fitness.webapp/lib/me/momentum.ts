import type { TrackSessionRow, WorkoutSessionRow } from "./queries";

export type Momentum = {
  daysSinceLastWorkout: number | null;
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  distanceThisWeekM: number;
  distanceLastWeekM: number;
};

const DAY_MS = 86_400_000;

/** UTC Monday-00:00 ms for the week containing `ms`. */
function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

export function buildMomentum(
  workouts: WorkoutSessionRow[],
  tracks: TrackSessionRow[],
  now: Date,
): Momentum {
  const completed = workouts.filter((w) => w.status === "completed");
  const thisStart = weekStart(now.getTime());
  const lastStart = thisStart - 7 * DAY_MS;

  let last: number | null = null;
  let workoutsThisWeek = 0;
  let workoutsLastWeek = 0;
  for (const w of completed) {
    const t = Date.parse(w.started_at);
    if (Number.isNaN(t)) continue;
    if (last == null || t > last) last = t;
    if (t >= thisStart) workoutsThisWeek++;
    else if (t >= lastStart) workoutsLastWeek++;
  }

  let distanceThisWeekM = 0;
  let distanceLastWeekM = 0;
  for (const tr of tracks) {
    const t = Date.parse(tr.finished_at ?? tr.created_at);
    if (Number.isNaN(t)) continue;
    const d = tr.distance_meters ?? 0;
    if (t >= thisStart) distanceThisWeekM += d;
    else if (t >= lastStart) distanceLastWeekM += d;
  }

  return {
    daysSinceLastWorkout:
      last == null ? null : Math.floor((now.getTime() - last) / DAY_MS),
    workoutsThisWeek,
    workoutsLastWeek,
    distanceThisWeekM,
    distanceLastWeekM,
  };
}
