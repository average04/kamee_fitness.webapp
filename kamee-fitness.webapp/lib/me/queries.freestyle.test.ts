import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { loadExerciseHistory, loadMeData, loadWorkoutDetail } from "./queries";
import { summarizeWorkouts } from "./workouts";
import { buildFeed } from "./feed";
import { buildHeatmap } from "./heatmap";
import { buildMomentum } from "./momentum";
import { buildWeeklyGoal } from "./goal";

const routeContext = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("@/lib/user/auth", () => ({ requireUser: async () => ({ id: "owner", email: "fixture@example.invalid" }) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => routeContext.client }));
vi.mock("next/navigation", async (original) => ({
  ...await original<typeof import("next/navigation")>(),
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const ex = "11111111-1111-4111-8111-111111111111";
const p = `personal:${ex}`;
const c = `catalog:${ex}`;
const sessions = [
  { id: "planned", user_id: "owner", source: "planned", started_at: "2026-09-29T09:00:00Z", status: "completed", day_id: "day", duration_seconds: 600, avg_hr: null },
  { id: "past", user_id: "owner", source: "freestyle", entry_mode: "past", performed_date: "2026-09-29", started_at: "2026-09-28T22:00:00Z", submitted_at: "2026-10-03T00:00:00Z", timestamp_precision: "date", title: "Evening training", status: "completed", day_id: null, duration_seconds: null, avg_hr: null },
  { id: "other", user_id: "other", source: "freestyle", performed_date: "2026-09-29", started_at: "2026-09-29T22:00:00Z", status: "completed" },
];
const occurrences = [
  { id: "press-a", user_id: "owner", session_id: "past", source: "personal", source_exercise_id: ex, personal_exercise_id: null, catalog_exercise_id: null, name_snapshot: "Archived private press", muscle_snapshot: ["chest"], tracking_type: "weight_reps", position: 0 },
  { id: "press-b", user_id: "owner", session_id: "past", source: "personal", source_exercise_id: ex, personal_exercise_id: null, catalog_exercise_id: null, name_snapshot: "Archived private press", muscle_snapshot: ["chest"], tracking_type: "weight_reps", position: 1 },
  { id: "hold", user_id: "owner", session_id: "past", source: "catalog", source_exercise_id: ex, catalog_exercise_id: ex, personal_exercise_id: null, name_snapshot: "Hold snapshot", muscle_snapshot: ["core"], tracking_type: "duration", position: 2 },
  { id: "other-occ", user_id: "other", session_id: "other", source: "personal", source_exercise_id: ex, name_snapshot: "Other owner's secret", muscle_snapshot: [], tracking_type: "weight_reps", position: 0 },
];

/** Exercise the real Supabase query builder; only its HTTP transport is replaced. */
function fixture(large = false) {
  const requests: URL[] = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    workout_sessions: sessions,
    session_sets: [{ session_id: "planned", plan_exercise_id: "pe", reps_done: 5, weight: 40 }],
    plan_exercises: [{ id: "pe", exercise_id: ex, exercises: { id: ex, name: "Catalog press", primary_muscle: "chest", is_bodyweight: false } }],
    workout_occurrences: occurrences,
    workout_occurrence_sets: [
      { id: "s-a", user_id: "owner", session_id: "past", occurrence_id: "press-a", ordinal: 0, tracking_type: "weight_reps", reps: 8, weight_kg: null, duration_seconds: null },
      { id: "s-b", user_id: "owner", session_id: "past", occurrence_id: "press-b", ordinal: 0, tracking_type: "weight_reps", reps: 5, weight_kg: 60, duration_seconds: null },
      { id: "s-c", user_id: "owner", session_id: "past", occurrence_id: "hold", ordinal: 0, tracking_type: "duration", reps: null, weight_kg: null, duration_seconds: 45 },
      { id: "s-other", user_id: "other", session_id: "other", occurrence_id: "other-occ", ordinal: 0, tracking_type: "weight_reps", reps: 10, weight_kg: 999, duration_seconds: null },
    ],
    plan_days: [{ id: "day", title: "Plan day" }],
    exercises: [{ id: ex, name: "Catalog press", primary_muscle: "chest", demo_image_path: null }],
    personal_exercises: [],
  };
  if (large) {
    tables.workout_sessions = [...sessions, { ...sessions[1], id: "past-second" }];
    tables.workout_occurrences = [...occurrences, { ...occurrences[1], id: "press-c", session_id: "past-second" }];
    tables.workout_occurrence_sets = Array.from({ length: 1002 }, (_, i) => ({
      id: `large-${i}`, user_id: "owner", session_id: i < 501 ? "past" : "past-second",
      occurrence_id: i < 501 ? "press-b" : "press-c", ordinal: i % 501,
      tracking_type: "weight_reps", reps: 5, weight_kg: 20, duration_seconds: null,
    }));
  }
  const sb = createClient("http://fixture.invalid", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      let rows = tables[url.pathname.split("/").pop()!] ?? [];
      for (const [key, filter] of url.searchParams) {
        if (filter.startsWith("eq.")) rows = rows.filter((r) => String(r[key]) === filter.slice(3));
        if (filter.startsWith("in.(")) {
          const values = filter.slice(4, -1).split(",");
          rows = rows.filter((r) => values.includes(String(r[key])));
        }
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  return { sb, requests, tables };
}

describe("owner-bound mixed workout readers", () => {
  it("renders real dashboard, detail, exercise, records and day routes with live, past and archived private fixtures", async () => {
    const { sb, tables } = fixture();
    tables.workout_sessions = [...sessions, {
      ...sessions[1], id: "live", title: "Live freestyle", entry_mode: "live", timestamp_precision: "instant",
      performed_date: "2026-09-30", started_at: "2026-09-29T19:00:00Z", timezone: "Asia/Manila", duration_seconds: 300,
    }];
    tables.workout_occurrences = [...occurrences, {
      ...occurrences[2], id: "live-press", session_id: "live", tracking_type: "weight_reps", name_snapshot: "Catalog press",
    }];
    tables.workout_occurrence_sets.push({
      id: "live-set", user_id: "owner", session_id: "live", occurrence_id: "live-press", ordinal: 0,
      tracking_type: "weight_reps", reps: 5, weight_kg: 70, duration_seconds: null,
    });
    routeContext.client = sb;
    const [dashboard, detail, exercise, records, day] = await Promise.all([
      import("@/app/me/page"), import("@/app/me/workouts/[id]/page"), import("@/app/me/exercises/[id]/page"),
      import("@/app/me/records/page"), import("@/app/me/day/[date]/page"),
    ]);
    const detailHtml = renderToStaticMarkup(await detail.default({ params: Promise.resolve({ id: "past" }) }));
    expect(detailHtml).toContain("Evening training");
    expect(detailHtml).toContain("2026-09-29");
    expect(detailHtml).not.toContain("10:00 PM");
    expect(detailHtml).toContain("8 reps · load not recorded");
    expect(detailHtml).toContain("45 s");
    const liveHtml = renderToStaticMarkup(await detail.default({ params: Promise.resolve({ id: "live" }) }));
    expect(liveHtml).toContain("3:00 AM");
    const exerciseHtml = renderToStaticMarkup(await exercise.default({ params: Promise.resolve({ id: p }) }));
    expect(exerciseHtml).toContain("Archived private press");
    expect(exerciseHtml).toContain("trained 1×");
    const recordsHtml = renderToStaticMarkup(await records.default());
    expect(recordsHtml).toContain(`/me/exercises/personal%3A${ex}`);
    expect(recordsHtml).toContain(`/me/exercises/catalog%3A${ex}`);
    expect(recordsHtml).toContain("70 kg");
    const dayHtml = renderToStaticMarkup(await day.default({ params: Promise.resolve({ date: "2026-09-29" }) }));
    expect(dayHtml).toContain("Evening training");
    expect(dayHtml).toContain("Plan day");
    expect(dayHtml).not.toContain("Live freestyle");
    const dashboardHtml = renderToStaticMarkup(await dashboard.default({ searchParams: Promise.resolve({ range: "all" }) }));
    expect(dashboardHtml).toContain("Live freestyle");
    expect(dashboardHtml).toContain("Evening training");
    expect(dashboardHtml).toContain("850 kg");
    expect(dashboardHtml).not.toContain("Other owner&#x27;s secret");
  }, 30_000);
  it("does not invent same-day chronology from date-only noon anchors for prior PR comparisons", async () => {
    const { sb, tables } = fixture();
    tables.workout_sessions = [...sessions, { ...sessions[1], id: "same-day", started_at: "2026-09-28T12:00:00Z" }];
    tables.workout_occurrences = [...occurrences, { ...occurrences[0], id: "same-day-occ", session_id: "same-day" }];
    tables.workout_occurrence_sets.push({
      id: "same-day-set", user_id: "owner", session_id: "same-day", occurrence_id: "same-day-occ", ordinal: 0,
      tracking_type: "weight_reps", reps: 5, weight_kg: 500, duration_seconds: null,
    });
    const detail = await loadWorkoutDetail(sb, "owner", "past");
    expect(detail?.priorMax[p]).toBeUndefined();
  });
  it("retains all sets across multiple completed workouts beyond the response row cap", async () => {
    const { sb } = fixture(true);
    const data = await loadMeData(sb, "owner");
    expect(data.sets).toHaveLength(1003);
    expect(data.sets.filter((s) => s.session_id === "past-second")).toHaveLength(501);
  });
  it("combines sources with qualified maps, archived snapshots and nullable measurements", async () => {
    const { sb, requests } = fixture();
    const data = await loadMeData(sb, "owner");
    expect(data.workouts.map((w) => w.id)).toEqual(["planned", "past"]);
    expect(data.sets).toHaveLength(4);
    expect(data.nameByExercise[p]).toBe("Archived private press");
    expect(data.nameByExercise[c]).toBe("Catalog press");
    expect(data.sets.find((s) => s.occurrence_id === "press-a")?.weight).toBeNull();
    expect(data.sets.find((s) => s.occurrence_id === "hold")?.duration_seconds).toBe(45);
    for (const req of requests.filter((r) => /workout_occurrence/.test(r.pathname))) {
      expect(req.searchParams.get("user_id")).toBe("eq.owner");
      expect(req.searchParams.get("session_id")).toBe("in.(planned,past)");
    }
  });
  it("buckets past data by performed date across dashboard, day feed, heatmap, momentum and goal", async () => {
    const { sb } = fixture();
    const data = await loadMeData(sb, "owner");
    const now = new Date("2026-09-29T12:00:00Z");
    const summary = summarizeWorkouts(data.workouts, data.sets, data.exerciseNames, null, { startMs: Date.parse("2026-09-29"), endMs: Date.parse("2026-09-30") });
    expect(summary.sessions).toBe(2);
    expect(summary.totalVolumeKg).toBe(500);
    const feed = buildFeed(data.workouts, data.sets, [], data.dayTitleBySession, 50);
    expect(feed.find((w) => w.id === "past")).toMatchObject({ title: "Evening training", dateIso: "2026-09-29", setCount: 3, volumeKg: 300 });
    expect(buildHeatmap(data.workouts, [], 1, now).days.at(-1)?.count).toBe(2);
    expect(buildMomentum(data.workouts, [], now).workoutsThisWeek).toBe(2);
    expect(buildWeeklyGoal(data.workouts, now, 2, 1).thisWeekCount).toBe(2);
  });
  it("loads freestyle detail and preserves its occurrences without inventing a time for date precision", async () => {
    const { sb } = fixture();
    const detail = await loadWorkoutDetail(sb, "owner", "past");
    expect(detail?.dayTitle).toBe("Evening training");
    expect(detail?.current).toHaveLength(3);
    expect(detail?.session).toMatchObject({ performedDate: "2026-09-29", timestampPrecision: "date" });
    expect(detail?.names[p]).toBe("Archived private press");
    expect(await loadWorkoutDetail(sb, "owner", "other")).toBeNull();
  });
  it("reads private history from owned snapshots without querying a matching catalog UUID", async () => {
    const { sb, requests } = fixture();
    const history = await loadExerciseHistory(sb, "owner", p);
    expect(history).toMatchObject({ name: "Archived private press", primaryMuscle: "chest", demoImagePath: null });
    expect(history?.sets).toHaveLength(2);
    expect(requests.filter((r) => r.pathname.endsWith("/exercises"))).toHaveLength(0);
    const other = fixture();
    expect(await loadExerciseHistory(other.sb, "unrelated", p)).toBeNull();
  });
  it("legacy catalog bookmarks combine planned and compatible freestyle catalog history", async () => {
    const { sb } = fixture();
    const history = await loadExerciseHistory(sb, "owner", ex);
    expect(history?.name).toBe("Catalog press");
    expect(history?.sets).toHaveLength(2);
    expect(history?.sets.map((s) => s.sessionId)).toEqual(["planned", "past"]);
    expect(history?.sets[0]).toMatchObject({ source: "planned", timestampPrecision: "instant", startedAt: "2026-09-29T09:00:00Z", dateIso: "2026-09-29" });
    expect(history?.sets[1]).toMatchObject({ source: "freestyle", timestampPrecision: "date", startedAt: "2026-09-28T22:00:00Z", dateIso: "2026-09-29" });
  });
});
