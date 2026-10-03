import { describe, expect, it } from "vitest";
import { epley1Rm } from "./oneRepMax";
import { buildExerciseHistory, type SetWithDate } from "./exerciseHistory";

describe("epley1Rm", () => {
  it("does not estimate unmeasured load, invalid reps or incompatible tracking", () => {
    expect(epley1Rm(null, 8)).toBeNull();
    expect(epley1Rm(50, null)).toBeNull();
    expect(epley1Rm(50, 0)).toBeNull();
    expect(epley1Rm(50, 8, "duration")).toBeNull();
  });
  it("returns weight for a single rep and applies Epley otherwise", () => {
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe("buildExerciseHistory", () => {
  it("counts two same-date sessions independently and excludes unmeasured/nonlifting values", () => {
    const h = buildExerciseHistory([
      { sessionId: "a", dateIso: "2026-06-01", reps: 10, weightKg: null, trackingType: "weight_reps" },
      { sessionId: "b", dateIso: "2026-06-01", reps: 5, weightKg: 60, trackingType: "weight_reps" },
      { sessionId: "b", dateIso: "2026-06-01", reps: null, weightKg: null, durationSeconds: 45, trackingType: "duration" },
    ]);
    expect(h.timesTrained).toBe(2);
    expect(h.series).toHaveLength(2);
    expect(h.series[0].topSetKg).toBeNull();
    expect(h.series[1].durationSeconds).toBe(45);
    expect(h.prKg).toBe(60);
    expect(h.totalReps).toBe(15);
    expect(h.series[1].bestEst1RmKg).toBe(70);
  });
  const sets: SetWithDate[] = [
    { dateIso: "2026-06-01", reps: 10, weightKg: 50 },
    { dateIso: "2026-06-01", reps: 8, weightKg: 55 },
    { dateIso: "2026-06-10", reps: 5, weightKg: 60 },
  ];
  it("builds per-session series, PR, and times trained", () => {
    const h = buildExerciseHistory(sets);
    expect(h.timesTrained).toBe(2);
    expect(h.series).toHaveLength(2);
    expect(h.series[0]).toMatchObject({ dateIso: "2026-06-01", topSetKg: 55 });
    expect(h.prKg).toBe(60);
    expect(h.prDateIso).toBe("2026-06-10");
    expect(h.series[1].bestEst1RmKg).toBeCloseTo(70, 0);
    expect(h.lastWeightKg).toBe(60);
    expect(h.totalReps).toBe(10 + 8 + 5);
    expect(h.bestVolumeKg).toBe(10 * 50 + 8 * 55);
  });
});
