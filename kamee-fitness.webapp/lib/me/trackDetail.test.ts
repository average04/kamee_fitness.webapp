import { describe, expect, it } from "vitest";
import { haversineMeters } from "./geo";
import { computeSplits, summarizeTrackDetail } from "./trackDetail";

describe("haversineMeters", () => {
  it("approximates a short distance", () => {
    const d = haversineMeters(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });
});

describe("computeSplits", () => {
  it("emits one split per unit of distance using point timestamps", () => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      pts.push({ latitude: i * 0.0005, longitude: 0, timestamp: i * 60_000 });
    }
    const splits = computeSplits(pts, 1000);
    expect(splits.length).toBeGreaterThanOrEqual(1);
    expect(splits[0].distanceM).toBeCloseTo(1000, -2);
    expect(splits[0].durationS).toBeGreaterThan(0);
  });
  it("returns [] for too few points", () => {
    expect(computeSplits([], 1000)).toEqual([]);
  });
});

describe("summarizeTrackDetail", () => {
  it("computes pace and deltas vs previous", () => {
    const s = summarizeTrackDetail(
      { distanceM: 5000, durationS: 1500 },
      { distanceM: 5000, durationS: 1600 },
    );
    expect(s.paceSecPerKm).toBeCloseTo(300, 0);
    expect(s.paceDeltaSecPerKm).toBeCloseTo(-20, 0);
  });
});
