import { describe, expect, it } from "vitest";
import { buildHeatmap } from "./heatmap";
import type { TrackSessionRow, WorkoutSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z");
const workouts = [
  { id: "s1", started_at: "2026-06-23T08:00:00Z", duration_seconds: 0, status: "completed", avg_hr: null },
  { id: "s2", started_at: "2026-06-22T08:00:00Z", duration_seconds: 0, status: "abandoned", avg_hr: null },
] as WorkoutSessionRow[];
const tracks = [
  { id: "t1", mode: "run", title: null, distance_meters: 0, duration_seconds: 0, elevation_gain_meters: 0, avg_hr: null, finished_at: "2026-06-23T09:00:00Z", created_at: "2026-06-23T09:00:00Z", route_points: [] },
] as TrackSessionRow[];

describe("buildHeatmap", () => {
  it("counts workouts (any status) + tracks per day", () => {
    const { days, maxCount } = buildHeatmap(workouts, tracks, 8, now);
    expect(days.length).toBe(8 * 7);
    const today = days[days.length - 1];
    expect(today.date).toBe("2026-06-23");
    expect(today.count).toBe(2);
    expect(maxCount).toBe(2);
  });
});
