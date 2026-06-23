import type { WorkoutSessionRow } from "./queries";

export type WeeklyGoal = {
  target: number;
  thisWeekCount: number;
  history: { weekStartIso: string; count: number; hit: boolean }[];
};

const DAY_MS = 86_400_000;

/** UTC Monday-00:00 ms for the week containing `ms`. */
function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

export function buildWeeklyGoal(
  workouts: WorkoutSessionRow[],
  now: Date,
  targetDays: number,
  weeks: number,
): WeeklyGoal {
  const thisStart = weekStart(now.getTime());
  const counts = new Map<number, number>();
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    const t = Date.parse(w.started_at);
    if (Number.isNaN(t)) continue;
    const ws = weekStart(t);
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  const history: WeeklyGoal["history"] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = thisStart - i * 7 * DAY_MS;
    const count = counts.get(ws) ?? 0;
    history.push({
      weekStartIso: new Date(ws).toISOString().slice(0, 10),
      count,
      hit: targetDays > 0 && count >= targetDays,
    });
  }
  return {
    target: targetDays,
    thisWeekCount: counts.get(thisStart) ?? 0,
    history,
  };
}
