import { describe, it, expect } from "vitest";
import {
  commaValues,
  draftPayload,
  validateDraft,
  actionError,
} from "./plan-validation";
import { newDay, newMeals, type PlanDocument } from "./plans";
const plan = () =>
  ({
    id: "p",
    title: "Plan",
    required_equipment: [],
    target_muscles: [],
    weeks: [{ lineage_key: "w", role: "build", days: [newDay()] }],
    meals: newMeals(),
  }) as unknown as PlanDocument;
describe("review regressions", () => {
  it.each([null, undefined])("saves a legacy %s level as Any level during an unrelated summary edit", (level) => {
    const p = Object.assign(plan(), { level, summary: "Summary-only edit" });
    expect(draftPayload(p).level).toBe("none");
    expect(draftPayload(p).summary).toBe("Summary-only edit");
  });
  it.each(["none", "beginner", "intermediate", "advanced", ""])(
    "preserves an explicit level %j in the save payload",
    (level) => {
      expect(draftPayload(Object.assign(plan(), { level })).level).toBe(level);
    },
  );
  it("rejects a 600 calorie day before the atomic save", () => {
    const p = plan();
    p.meals!.days[0].kcal = 600;
    expect(validateDraft(p).join()).toContain("1,200");
  });
  it("accepts day limits and rejects oversized labels and fractional sets", () => {
    const p = plan();
    expect(validateDraft(p)).toEqual([]);
    p.meals!.days[0].label = "x".repeat(41);
    p.weeks[0].days[0].blocks = [
      {
        lineage_key: "b",
        kind: "main",
        exercises: [{ exercise_id: "catalog", sets: 3.5, reps: "10", rest_seconds: 60 } as never],
      },
    ];
    expect(validateDraft(p)).toHaveLength(2);
  });
  it("rejects fractional estimated minutes", () => {
    const p = plan(); p.est_minutes_per_session = 12.5;
    expect(validateDraft(p).join()).toContain("Estimated session minutes");
  });
  it("removes empty comma entries", () =>
    expect(commaValues("band, , mat,")).toEqual(["band", "mat"]));
  it("omits physical row ids and timestamps from schedule payload", () => {
    const p = plan();
    Object.assign(p.weeks[0], { id: "physical", created_at: "date" });
    expect(draftPayload(p).weeks[0]).not.toHaveProperty("id");
    expect(draftPayload(p).weeks[0]).not.toHaveProperty("created_at");
  });
  it("does not expose raw constraint names", () =>
    expect(
      actionError({ code: "23514", message: "meal_plan_days_kcal_check" }),
    ).not.toContain("_check"));
});
