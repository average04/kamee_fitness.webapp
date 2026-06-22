import type { TrackSessionRow, WorkoutSessionRow } from "./queries";

export type HeatmapDay = { date: string; count: number };

const DAY_MS = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const utcDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;

export function buildHeatmap(
  workouts: WorkoutSessionRow[],
  tracks: TrackSessionRow[],
  weeks: number,
  now: Date,
): { days: HeatmapDay[]; maxCount: number } {
  const total = weeks * 7;
  const endDay = utcDay(now.getTime());
  const counts = new Map<string, number>();
  const bump = (iso: string | null) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return;
    const k = dayKey(utcDay(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const w of workouts) bump(w.started_at);
  for (const t of tracks) bump(t.finished_at ?? t.created_at);

  const days: HeatmapDay[] = [];
  let maxCount = 0;
  for (let i = total - 1; i >= 0; i--) {
    const key = dayKey(endDay - i * DAY_MS);
    const count = counts.get(key) ?? 0;
    if (count > maxCount) maxCount = count;
    days.push({ date: key, count });
  }
  return { days, maxCount };
}
