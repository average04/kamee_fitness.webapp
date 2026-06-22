import { describe, expect, it } from "vitest";
import { summarizeWorkouts } from "./workouts";
import { resolveWindow } from "./range";
import type { SessionSetRow, WorkoutSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z");
const ALL = resolveWindow("all", now);
const WEEK = resolveWindow("week", now);

const workouts: WorkoutSessionRow[] = [
  { id: "s1", started_at: "2026-06-20T10:00:00Z", duration_seconds: 1800, status: "completed", avg_hr: 120 },
  { id: "s2", started_at: "2026-06-10T10:00:00Z", duration_seconds: 2400, status: "completed", avg_hr: null },
  { id: "s3", started_at: "2026-06-09T10:00:00Z", duration_seconds: 999, status: "abandoned", avg_hr: null },
];
const sets: SessionSetRow[] = [
  { session_id: "s1", plan_exercise_id: "pe1", reps_done: 10, weight: 50 },
  { session_id: "s1", plan_exercise_id: "pe1", reps_done: 8, weight: 60 },
  { session_id: "s2", plan_exercise_id: "pe2", reps_done: 12, weight: 20 },
];
const names = { pe1: "Bench Press", pe2: "Squat" };
const streaks = { current_streak: 9, longest_streak: 14, track_current_streak: 0, track_longest_streak: 0 };

describe("summarizeWorkouts", () => {
  it("counts only completed sessions in range", () => {
    const all = summarizeWorkouts(workouts, sets, names, streaks, ALL);
    expect(all.sessions).toBe(2);
    const week = summarizeWorkouts(workouts, sets, names, streaks, WEEK);
    expect(week.sessions).toBe(1);
  });
  it("sums volume = reps*weight and time across completed sessions", () => {
    const all = summarizeWorkouts(workouts, sets, names, streaks, ALL);
    expect(all.totalVolumeKg).toBe(10 * 50 + 8 * 60 + 12 * 20);
    expect(all.timeTrainedSeconds).toBe(1800 + 2400);
  });
  it("passes streaks through and computes PRs + top exercises by name", () => {
    const all = summarizeWorkouts(workouts, sets, names, streaks, ALL);
    expect(all.currentStreak).toBe(9);
    expect(all.longestStreak).toBe(14);
    expect(all.prs).toContainEqual({ name: "Bench Press", weightKg: 60 });
    expect(all.topExercises[0]).toEqual({ name: "Bench Press", sets: 2 });
  });
});
