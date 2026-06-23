import { describe, expect, it } from "vitest";
import { buildRecords, type RecordSet } from "./records";
import { buildWeeklyGoal } from "./goal";
import type { WorkoutSessionRow } from "./queries";

describe("buildRecords", () => {
  const sets: RecordSet[] = [
    { exerciseId: "e1", name: "Bench", dateIso: "2026-06-01", reps: 8, weightKg: 60 },
    { exerciseId: "e1", name: "Bench", dateIso: "2026-06-10", reps: 5, weightKg: 70 },
    { exerciseId: "e2", name: "Squat", dateIso: "2026-06-05", reps: 5, weightKg: 100 },
  ];
  it("computes PR, est-1RM, times trained per exercise, sorted heaviest first", () => {
    const recs = buildRecords(sets);
    expect(recs.map((r) => r.name)).toEqual(["Squat", "Bench"]);
    const bench = recs.find((r) => r.exerciseId === "e1")!;
    expect(bench.prKg).toBe(70);
    expect(bench.prDateIso).toBe("2026-06-10");
    expect(bench.timesTrained).toBe(2);
    expect(bench.lastDoneIso).toBe("2026-06-10");
    expect(bench.est1RmKg).toBeCloseTo(81.67, 1);
  });
});

describe("buildWeeklyGoal", () => {
  const now = new Date("2026-06-23T12:00:00Z"); // Tuesday
  const W = (
    id: string,
    started_at: string,
    status: "completed" | "abandoned" = "completed",
  ): WorkoutSessionRow => ({
    id,
    started_at,
    duration_seconds: 0,
    status,
    avg_hr: null,
    day_id: null,
  });
  const workouts = [
    W("a", "2026-06-22T08:00:00Z"),
    W("b", "2026-06-23T08:00:00Z"),
    W("c", "2026-06-16T08:00:00Z"),
    W("d", "2026-06-15T08:00:00Z"),
    W("e", "2026-06-17T08:00:00Z"),
    W("x", "2026-06-23T09:00:00Z", "abandoned"),
  ];
  it("counts completed workouts per ISO week with hit flags", () => {
    const g = buildWeeklyGoal(workouts, now, 3, 8);
    expect(g.target).toBe(3);
    expect(g.history).toHaveLength(8);
    expect(g.thisWeekCount).toBe(2);
    const last = g.history[g.history.length - 1];
    expect(last.count).toBe(2);
    expect(last.hit).toBe(false);
    const prev = g.history[g.history.length - 2];
    expect(prev.count).toBe(3);
    expect(prev.hit).toBe(true);
  });
  it("never hits when target is 0", () => {
    const g = buildWeeklyGoal(workouts, now, 0, 4);
    expect(g.target).toBe(0);
    expect(g.history.every((h) => h.hit === false)).toBe(true);
  });
});
