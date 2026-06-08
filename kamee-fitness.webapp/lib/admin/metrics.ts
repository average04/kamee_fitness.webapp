/**
 * Types and pure helpers for the admin dashboard. No I/O — safe to unit-test
 * and to import from both client (chart) and server (loader) modules.
 */

const DAY_MS = 86_400_000;

/** A single day's tally for a time-series chart. `date` is a UTC `YYYY-MM-DD`. */
export type DayBucket = { date: string; count: number };

export type ActivityType =
  | "user"
  | "waitlist"
  | "subscription"
  | "workout"
  | "exercise";

export type ActivityEvent = { type: ActivityType; label: string; at: string };

export type StoreSlice = { store: string; count: number };
export type MuscleBar = { muscle: string; count: number };

export type DashboardData = {
  totals: {
    users: number;
    newUsers30d: number;
    newUsers7d: number;
    waitlist: number;
    waitlist7d: number;
    activeSubs: number;
    premiumPct: number;
    workouts30d: number;
    cardio30d: number;
  };
  signups: { date: string; users: number; waitlist: number }[];
  sessions: { date: string; workout: number; cardio: number }[];
  subsByStore: StoreSlice[];
  willRenew: { renewing: number; churning: number };
  muscles: MuscleBar[];
  coverage: { total: number; withImage: number; withVideo: number };
  activity: ActivityEvent[];
};

const utcDayMs = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Tally ISO timestamps into `days` daily buckets ending on `end`'s UTC date
 * (inclusive), ascending. Timestamps outside the window or unparseable are
 * ignored.
 */
export function bucketByDay(
  timestamps: string[],
  days: number,
  end: Date,
): DayBucket[] {
  const endDay = utcDayMs(end.getTime());
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    buckets.push({ date: dayKey(endDay - i * DAY_MS), count: 0 });
  }
  for (const ts of timestamps) {
    const t = Date.parse(ts);
    if (Number.isNaN(t)) continue;
    const index = (endDay - utcDayMs(t)) / DAY_MS;
    if (index >= 0 && index < days) buckets[days - 1 - index].count++;
  }
  return buckets;
}

/** Whole-number percentage; 0 when `whole` is 0 (avoids divide-by-zero). */
export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

/** Coarse "5m ago" / "3h ago" / "2d ago" label; ISO date past ~4 weeks. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = Math.floor((now.getTime() - Date.parse(iso)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2419200) return `${Math.floor(diff / 604800)}w ago`;
  return iso.slice(0, 10);
}

/** Flatten activity lists, sort newest-first, and cap to `limit`. */
export function mergeActivity(
  lists: ActivityEvent[][],
  limit: number,
): ActivityEvent[] {
  return lists
    .flat()
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}
