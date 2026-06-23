import { describe, expect, it } from "vitest";
import { bestEffort, buildTrackRecords } from "./trackRecords";
import type { TrackSessionRow } from "./queries";

const T = (over: Partial<TrackSessionRow> & { id: string }): TrackSessionRow => ({
  id: over.id,
  mode: over.mode ?? "run",
  title: null,
  distance_meters: over.distance_meters ?? 0,
  duration_seconds: over.duration_seconds ?? 0,
  elevation_gain_meters: over.elevation_gain_meters ?? 0,
  elevation_loss_meters: 0,
  avg_hr: null,
  max_hr: null,
  finished_at: over.finished_at ?? "2026-06-20T07:00:00Z",
  created_at: over.created_at ?? "2026-06-20T07:00:00Z",
  route_points: over.route_points ?? [],
});

// ~55.6 m per 0.0005° lat near the equator; 60 s between points.
const line = (n: number) =>
  Array.from({ length: n + 1 }, (_, i) => ({
    latitude: i * 0.0005,
    longitude: 0,
    timestamp: i * 60_000,
  }));

describe("bestEffort", () => {
  it("returns null for too-few points or too-short routes", () => {
    expect(bestEffort([], 1000)).toBeNull();
    expect(bestEffort(line(5), 1000)).toBeNull();
  });
  it("finds the fastest 1 km window", () => {
    const e = bestEffort(line(20), 1000);
    expect(e).not.toBeNull();
    expect(e!).toBeGreaterThanOrEqual(1000);
    expect(e!).toBeLessThanOrEqual(1140);
  });
});

describe("buildTrackRecords", () => {
  const tracks = [
    T({ id: "a", mode: "run", distance_meters: 5000, duration_seconds: 1500, elevation_gain_meters: 40 }),
    T({ id: "b", mode: "walk", distance_meters: 8000, duration_seconds: 4800, elevation_gain_meters: 10 }),
    T({ id: "c", mode: "run", distance_meters: 500, duration_seconds: 60, elevation_gain_meters: 5 }),
  ];
  it("computes session bests, ignoring sub-1km for pace, and lifetime totals", () => {
    const r = buildTrackRecords(tracks);
    expect(r.bests.longestDistanceM!.trackId).toBe("b");
    expect(r.bests.longestDurationS!.trackId).toBe("b");
    expect(r.bests.mostElevationM!.trackId).toBe("a");
    expect(r.bests.fastestPaceSecPerKm!.trackId).toBe("a");
    expect(r.bests.fastestPaceSecPerKm!.value).toBeCloseTo(300, 0);
    expect(r.totals.distanceM).toBe(13500);
    expect(r.totals.sessions).toBe(3);
    expect(r.totals.elevationM).toBe(55);
  });
});
