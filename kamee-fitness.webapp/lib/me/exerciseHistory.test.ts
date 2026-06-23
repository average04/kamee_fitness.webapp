import { describe, expect, it } from "vitest";
import { epley1Rm } from "./oneRepMax";
import { buildExerciseHistory, type SetWithDate } from "./exerciseHistory";

describe("epley1Rm", () => {
  it("returns weight for a single rep and applies Epley otherwise", () => {
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe("buildExerciseHistory", () => {
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
