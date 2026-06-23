import { describe, expect, it } from "vitest";
import { summarizeWorkoutDetail, type SetWithExercise } from "./workoutDetail";

const cur: SetWithExercise[] = [
  { exerciseId: "e1", reps: 10, weightKg: 50 },
  { exerciseId: "e1", reps: 8, weightKg: 60 },
  { exerciseId: "e2", reps: 12, weightKg: 20 },
];
const prev: SetWithExercise[] = [
  { exerciseId: "e1", reps: 10, weightKg: 55 },
  { exerciseId: "e2", reps: 12, weightKg: 20 },
];
const names = { e1: "Bench", e2: "Squat" };

describe("summarizeWorkoutDetail", () => {
  it("groups by exercise with volume, top set, deltas, muscle, and totals", () => {
    const s = summarizeWorkoutDetail(cur, prev, names, { e1: 55 }, { e1: "chest" });
    const bench = s.exercises.find((e) => e.exerciseId === "e1")!;
    expect(bench.name).toBe("Bench");
    expect(bench.primaryMuscle).toBe("chest");
    expect(bench.topSetKg).toBe(60);
    expect(bench.volumeKg).toBe(10 * 50 + 8 * 60);
    expect(bench.topDeltaKg).toBe(5);
    expect(bench.isPr).toBe(true);
    expect(s.totalSets).toBe(3);
    expect(s.totalReps).toBe(10 + 8 + 12);
  });
  it("totals volume with delta; null deltas/muscle when no previous", () => {
    const s = summarizeWorkoutDetail(cur, [], names, {}, {});
    expect(s.totalVolumeKg).toBe(10 * 50 + 8 * 60 + 12 * 20);
    expect(s.totalVolumeDeltaKg).toBeNull();
    expect(s.exercises[0].topDeltaKg).toBeNull();
    expect(s.exercises[0].isPr).toBe(false);
    expect(s.exercises[0].primaryMuscle).toBeNull();
  });
});
