import { describe, expect, it } from "vitest";
import { duplicate, move, progressWeek, type Week } from "./plans";
import { buildRunDayCardio } from "./outdoor/runDayForm";
import { flattenSegments } from "./outdoor/segments";

const week: Week = {
  lineage_key: "week",
  role: "build",
  days: [
    {
      lineage_key: "day",
      title: "Strength",
      day_kind: "workout",
      coaching_video_id: "video",
      cardio: null,
      blocks: [
        {
          lineage_key: "block",
          kind: "main",
          exercises: [
            {
              lineage_key: "exercise",
              exercise_id: "catalog",
              sets: 3,
              reps: "8-12",
              rest_seconds: 60,
              tempo: "3010",
              weight_hint: null,
              notes: null,
              coaching_video_id: "video",
            },
          ],
        },
      ],
    },
  ],
};
describe("coach schedule operations", () => {
  it("duplicates logical nodes without changing catalog/video references or the original", () => {
    const copy = duplicate(week);
    expect(copy.lineage_key).not.toBe(week.lineage_key);
    expect(copy.days[0].blocks[0].exercises[0].lineage_key).not.toBe(
      "exercise",
    );
    expect(copy.days[0].blocks[0].exercises[0].exercise_id).toBe("catalog");
    expect(copy.days[0].coaching_video_id).toBe("video");
    expect(week.days[0].lineage_key).toBe("day");
  });
  it("previews bounded progression without rewriting range prescriptions", () => {
    const next = progressWeek(week, 50, 2, -100);
    const exercise = next.days[0].blocks[0].exercises[0];
    expect(exercise.sets).toBe(30);
    expect(exercise.rest_seconds).toBe(0);
    expect(exercise.reps).toBe("8-12");
    expect(week.days[0].blocks[0].exercises[0].sets).toBe(3);
  });
  it("reorders without dropping siblings or wrapping at boundaries", () => {
    expect(move(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});
describe("native outdoor contract", () => {
  it("includes native warmup/cooldown and compatible run-walk guidance", () => {
    const { cardio } = buildRunDayCardio({
      kind: "run_walk",
      reps: 6,
      runSec: 60,
      walkSec: 90,
    });
    expect(cardio.targetSeconds).toBe(1500);
    expect(cardio.guidanceConfig).toEqual({
      warmupWalkSec: 300,
      runSec: 60,
      walkSec: 90,
    });
    expect(cardio.targetKind).toBe("intervals");
    expect(flattenSegments(cardio.segments!)).toHaveLength(14);
  });
  it("keeps walking sessions entirely in walk mode", () => {
    const { cardio } = buildRunDayCardio({
      kind: "walk_intervals",
      reps: 4,
      fastSec: 60,
      easySec: 90,
    });
    expect(cardio.mode).toBe("walk");
    expect(
      flattenSegments(cardio.segments!).every((s) => s.mode === "walk"),
    ).toBe(true);
  });
});
