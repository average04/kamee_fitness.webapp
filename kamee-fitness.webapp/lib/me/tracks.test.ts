import { describe, expect, it } from "vitest";
import { summarizeTracks } from "./tracks";
import { resolveWindow } from "./range";
import type { TrackSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z");
const ALL = resolveWindow("all", now);
const WEEK = resolveWindow("week", now);
const tracks: TrackSessionRow[] = [
  { id: "t1", mode: "run", title: null, distance_meters: 5000, duration_seconds: 1500, elevation_gain_meters: 30, avg_hr: 150, finished_at: "2026-06-21T07:00:00Z", created_at: "2026-06-21T07:00:00Z", route_points: [] },
  { id: "t2", mode: "walk", title: null, distance_meters: 2000, duration_seconds: 1800, elevation_gain_meters: 5, avg_hr: null, finished_at: "2026-06-01T07:00:00Z", created_at: "2026-06-01T07:00:00Z", route_points: [] },
];
const streaks = { current_streak: 0, longest_streak: 0, track_current_streak: 10, track_longest_streak: 12 };

describe("summarizeTracks", () => {
  it("totals distance/duration/elevation and splits by mode", () => {
    const all = summarizeTracks(tracks, streaks, ALL);
    expect(all.count).toBe(2);
    expect(all.totalDistanceM).toBe(7000);
    expect(all.totalDurationS).toBe(3300);
    expect(all.totalElevationM).toBe(35);
    expect(all.byMode).toContainEqual({ mode: "run", count: 1, distanceM: 5000 });
    expect(all.currentStreak).toBe(10);
  });
  it("respects the range window", () => {
    const week = summarizeTracks(tracks, streaks, WEEK);
    expect(week.count).toBe(1);
  });
});
