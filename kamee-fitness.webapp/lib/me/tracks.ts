import type { StreakRow, TrackSessionRow } from "./queries";
import { inWindow, type DateWindow } from "./range";

export type TrackSummary = {
  count: number;
  totalDistanceM: number;
  totalDurationS: number;
  totalElevationM: number;
  currentStreak: number;
  longestStreak: number;
  byMode: { mode: string; count: number; distanceM: number }[];
  perWeek: { week: string; distanceM: number }[];
  recent: {
    id: string;
    mode: string;
    distanceM: number;
    durationS: number;
    routePoints: unknown;
  }[];
};

function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  const monday =
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    day * 86_400_000;
  return new Date(monday).toISOString().slice(0, 10);
}

function when(t: TrackSessionRow): string {
  return t.finished_at ?? t.created_at;
}

export function summarizeTracks(
  tracks: TrackSessionRow[],
  streaks: StreakRow,
  window: DateWindow,
): TrackSummary {
  const inRange = tracks.filter((t) => inWindow(when(t), window));

  let totalDistanceM = 0;
  let totalDurationS = 0;
  let totalElevationM = 0;
  const modeMap = new Map<string, { count: number; distanceM: number }>();
  const weekMap = new Map<string, number>();

  for (const t of inRange) {
    const dist = t.distance_meters ?? 0;
    totalDistanceM += dist;
    totalDurationS += t.duration_seconds ?? 0;
    totalElevationM += t.elevation_gain_meters ?? 0;
    const m = modeMap.get(t.mode) ?? { count: 0, distanceM: 0 };
    m.count += 1;
    m.distanceM += dist;
    modeMap.set(t.mode, m);
    const wk = weekKey(when(t));
    weekMap.set(wk, (weekMap.get(wk) ?? 0) + dist);
  }

  const byMode = [...modeMap.entries()]
    .map(([mode, v]) => ({ mode, ...v }))
    .sort((a, b) => b.distanceM - a.distanceM);
  const perWeek = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, distanceM]) => ({ week, distanceM }));
  const recent = [...inRange]
    .sort((a, b) => Date.parse(when(b)) - Date.parse(when(a)))
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      mode: t.mode,
      distanceM: t.distance_meters ?? 0,
      durationS: t.duration_seconds ?? 0,
      routePoints: t.route_points,
    }));

  return {
    count: inRange.length,
    totalDistanceM,
    totalDurationS,
    totalElevationM,
    currentStreak: streaks?.track_current_streak ?? 0,
    longestStreak: streaks?.track_longest_streak ?? 0,
    byMode,
    perWeek,
    recent,
  };
}
