import { describe, it, expect } from "vitest";
import { makeCustomExercise, customExerciseIssue, timedSeconds } from "./custom-exercise";
describe("custom exercise prescription", () => {
  it("uses native timed notation and a separate custom name", () => {
    expect(makeCustomExercise("  Bear hold  ", "45s")).toMatchObject({exercise_id:null,custom_name:"Bear hold",reps:"45s",sets:3});
    expect(timedSeconds("45s")).toBe(45);
  });
  it("allows sets with reps and ranges", () => {
    expect(customExerciseIssue("My movement","8-12")).toBeNull();
    expect(timedSeconds("10")).toBeNull();
  });
  it("rejects invalid names, times and reps", () => {
    for (const [name,reps] of [["","10"],["x".repeat(121),"10"],["Hold","0s"],["Hold","3601s"],["Squat","2.5"],["Squat","12-8"]])
      expect(customExerciseIssue(name,reps)).not.toBeNull();
  });
});
