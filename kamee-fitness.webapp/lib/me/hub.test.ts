import { describe, expect, it } from "vitest";
import { buildFeed } from "./feed";
import { buildMomentum } from "./momentum";
import { summarizePlan } from "./plan";
import type { SessionSetRow, TrackSessionRow, WorkoutSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z"); // a Tuesday
const workouts: WorkoutSessionRow[] = [
  { id: "w1", started_at: "2026-06-22T08:00:00Z", duration_seconds: 1800, status: "completed", avg_hr: null, day_id: null },
  { id: "w2", started_at: "2026-06-15T08:00:00Z", duration_seconds: 1800, status: "completed", avg_hr: null, day_id: null },
  { id: "w3", started_at: "2026-06-21T08:00:00Z", duration_seconds: 1, status: "abandoned", avg_hr: null, day_id: null },
];
const sets: SessionSetRow[] = [
  { session_id: "w1", plan_exercise_id: "p1", reps_done: 10, weight: 50 },
  { session_id: "w1", plan_exercise_id: "p1", reps_done: 10, weight: 50 },
];
const tracks: TrackSessionRow[] = [
  { id: "t1", mode: "run", title: null, distance_meters: 5000, duration_seconds: 1500, elevation_gain_meters: 0, avg_hr: null, finished_at: "2026-06-23T07:00:00Z", created_at: "2026-06-23T07:00:00Z", route_points: [] },
];

describe("buildFeed", () => {
  it("merges completed workouts + tracks, newest first, with title + metric", () => {
    const feed = buildFeed(workouts, sets, tracks, { w1: "Full Body B" }, 10);
    expect(feed.map((f) => f.id)).toEqual(["t1", "w1", "w2"]);
    const w1 = feed.find((f) => f.id === "w1")!;
    expect(w1).toMatchObject({ kind: "workout", title: "Full Body B", volumeKg: 1000, setCount: 2 });
    const t1 = feed.find((f) => f.id === "t1")!;
    expect(t1).toMatchObject({ kind: "track", title: "Run", distanceM: 5000 });
  });
  it("respects the limit", () => {
    expect(buildFeed(workouts, sets, tracks, {}, 1)).toHaveLength(1);
  });
});

describe("buildMomentum", () => {
  it("computes days-since + this/last week counts (completed only)", () => {
    const m = buildMomentum(workouts, tracks, now);
    expect(m.daysSinceLastWorkout).toBe(1);
    expect(m.workoutsThisWeek).toBe(1);
    expect(m.workoutsLastWeek).toBe(1);
    expect(m.distanceThisWeekM).toBe(5000);
  });
});

describe("summarizePlan", () => {
  it("computes percent and passes fields through", () => {
    expect(summarizePlan({ title: "X", currentWeek: 3, totalWeeks: 6 })).toEqual({
      title: "X", currentWeek: 3, totalWeeks: 6, pct: 50,
    });
  });
  it("is null when no active plan and clamps", () => {
    expect(summarizePlan(null)).toBeNull();
    expect(summarizePlan({ title: "X", currentWeek: 9, totalWeeks: 6 })!.pct).toBe(100);
  });
});
