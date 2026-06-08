import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  bucketByDay,
  mergeActivity,
  pct,
  type ActivityEvent,
  type ActivityType,
  type DashboardData,
  type MuscleBar,
  type StoreSlice,
} from "@/lib/admin/metrics";

const DAY_MS = 86_400_000;
const ACTIVE_STATUSES = ["active", "grace_period"];
const TREND_DAYS = 30;

type SB = ReturnType<typeof createAdminSupabase>;
type Row = Record<string, unknown>;

/** Exact row count via a `head` query (no rows transferred). 0 on error. */
async function countAll(sb: SB, table: string): Promise<number> {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error(`dashboard count(${table}):`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Pull one timestamp column for rows newer than `sinceIso`. [] on error. */
async function timestamps(
  sb: SB,
  table: string,
  col: string,
  sinceIso: string,
): Promise<string[]> {
  const { data, error } = await sb.from(table).select(col).gte(col, sinceIso);
  if (error) {
    console.error(`dashboard timestamps(${table}.${col}):`, error.message);
    return [];
  }
  return ((data ?? []) as unknown as Row[])
    .map((r) => r[col])
    .filter((v): v is string => typeof v === "string");
}

/** Newest N rows from `table` as activity events. [] on error. */
async function recent(
  sb: SB,
  table: string,
  select: string,
  atCol: string,
  type: ActivityType,
  label: (row: Row) => string,
): Promise<ActivityEvent[]> {
  const { data, error } = await sb
    .from(table)
    .select(select)
    .order(atCol, { ascending: false })
    .limit(8);
  if (error) {
    console.error(`dashboard recent(${table}):`, error.message);
    return [];
  }
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({ type, label: label(r), at: String(r[atCol] ?? "") }))
    .filter((e) => e.at);
}

async function loadSubscriptions(sb: SB) {
  const empty = {
    active: 0,
    byStore: [] as StoreSlice[],
    renewing: 0,
    churning: 0,
  };
  const { data, error } = await sb
    .from("subscriptions")
    .select("status, store, will_renew");
  if (error) {
    console.error("dashboard subscriptions:", error.message);
    return empty;
  }
  const active = (data ?? []).filter((r) =>
    ACTIVE_STATUSES.includes(String((r as Row).status)),
  );
  const storeCounts = new Map<string, number>();
  let renewing = 0;
  for (const r of active) {
    const store = String((r as Row).store ?? "unknown");
    storeCounts.set(store, (storeCounts.get(store) ?? 0) + 1);
    if ((r as Row).will_renew) renewing++;
  }
  return {
    active: active.length,
    byStore: [...storeCounts.entries()]
      .map(([store, count]) => ({ store, count }))
      .sort((a, b) => b.count - a.count),
    renewing,
    churning: active.length - renewing,
  };
}

async function loadCatalog(sb: SB) {
  const empty = { total: 0, muscles: [] as MuscleBar[], withImage: 0, withVideo: 0 };
  const { data, error } = await sb
    .from("exercises")
    .select("primary_muscle, demo_image_path, demo_video_path");
  if (error) {
    console.error("dashboard catalog:", error.message);
    return empty;
  }
  const rows = data ?? [];
  const muscleCounts = new Map<string, number>();
  let withImage = 0;
  let withVideo = 0;
  for (const r of rows) {
    const m = String((r as Row).primary_muscle ?? "unknown");
    muscleCounts.set(m, (muscleCounts.get(m) ?? 0) + 1);
    if ((r as Row).demo_image_path) withImage++;
    if ((r as Row).demo_video_path) withVideo++;
  }
  return {
    total: rows.length,
    muscles: [...muscleCounts.entries()]
      .map(([muscle, count]) => ({ muscle, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    withImage,
    withVideo,
  };
}

/**
 * Run every dashboard aggregate in parallel through the service-role client
 * (bypasses RLS — caller must already be an authorized admin). Each sub-query
 * degrades to a zero/empty value rather than failing the whole page.
 */
export async function loadDashboard(now: Date = new Date()): Promise<DashboardData> {
  const sb = createAdminSupabase();
  const sinceIso = new Date(now.getTime() - TREND_DAYS * DAY_MS).toISOString();
  const sevenIso = new Date(now.getTime() - 7 * DAY_MS).toISOString();

  const [
    usersTotal,
    waitlistTotal,
    userTs,
    waitlistTs,
    workoutTs,
    cardioTs,
    subs,
    catalog,
    recentUsers,
    recentWaitlist,
    recentSubs,
    recentWorkouts,
    recentExercises,
  ] = await Promise.all([
    countAll(sb, "profiles"),
    countAll(sb, "waitlist"),
    timestamps(sb, "profiles", "created_at", sinceIso),
    timestamps(sb, "waitlist", "created_at", sinceIso),
    timestamps(sb, "workout_sessions", "started_at", sinceIso),
    timestamps(sb, "track_sessions", "finished_at", sinceIso),
    loadSubscriptions(sb),
    loadCatalog(sb),
    recent(sb, "profiles", "display_name, created_at", "created_at", "user", (r) =>
      String(r.display_name || "New user"),
    ),
    recent(sb, "waitlist", "email, created_at", "created_at", "waitlist", (r) =>
      String(r.email ?? "Waitlist signup"),
    ),
    recent(
      sb,
      "subscriptions",
      "product_id, store, updated_at",
      "updated_at",
      "subscription",
      (r) => `${r.product_id ?? "subscription"} · ${r.store ?? ""}`.trim(),
    ),
    recent(sb, "workout_sessions", "started_at", "started_at", "workout", () => "Workout session"),
    recent(sb, "exercises", "name, created_at", "created_at", "exercise", (r) =>
      String(r.name ?? "Exercise"),
    ),
  ]);

  const userBuckets = bucketByDay(userTs, TREND_DAYS, now);
  const waitlistBuckets = bucketByDay(waitlistTs, TREND_DAYS, now);
  const workoutBuckets = bucketByDay(workoutTs, TREND_DAYS, now);
  const cardioBuckets = bucketByDay(cardioTs, TREND_DAYS, now);

  return {
    totals: {
      users: usersTotal,
      newUsers30d: userTs.length,
      newUsers7d: userTs.filter((t) => t >= sevenIso).length,
      waitlist: waitlistTotal,
      waitlist7d: waitlistTs.filter((t) => t >= sevenIso).length,
      activeSubs: subs.active,
      premiumPct: pct(subs.active, usersTotal),
      workouts30d: workoutTs.length,
      cardio30d: cardioTs.length,
    },
    signups: userBuckets.map((b, i) => ({
      date: b.date,
      users: b.count,
      waitlist: waitlistBuckets[i].count,
    })),
    sessions: workoutBuckets.map((b, i) => ({
      date: b.date,
      workout: b.count,
      cardio: cardioBuckets[i].count,
    })),
    subsByStore: subs.byStore,
    willRenew: { renewing: subs.renewing, churning: subs.churning },
    muscles: catalog.muscles,
    coverage: { total: catalog.total, withImage: catalog.withImage, withVideo: catalog.withVideo },
    activity: mergeActivity(
      [recentUsers, recentWaitlist, recentSubs, recentWorkouts, recentExercises],
      15,
    ),
  };
}
