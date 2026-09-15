import { describe, it, expect } from "vitest";
import { planGoals } from "./goals";
import { draftPayload, validateDraft } from "./plan-validation";
import type { PlanDocument } from "./plans";
const plan = { goal: "old", goals: ["strength", "conditioning"], required_equipment: [], target_muscles: [], weeks: [], meals: null } as unknown as PlanDocument;
describe("plan goals", () => {
 it("sends a real array and compatible primary goal", () => {
  expect(draftPayload(plan)).toMatchObject({ goal: "strength", goals: ["strength", "conditioning"] });
 });
 it("preserves old free text including commas", () => { expect(planGoals({goal:"Strong, steady"})).toEqual(["Strong, steady"]); });
 it("allows clearing all goals", () => { expect(planGoals({goal:"old",goals:[]})).toEqual([]); });
 it("rejects duplicate or oversized goals", () => {
  expect(validateDraft({...plan, goals:["strength","strength"]})).toContain("Choose up to 12 unique goals, each 1-80 characters.");
  expect(validateDraft({...plan, goals:["x".repeat(81)]})).toContain("Choose up to 12 unique goals, each 1-80 characters.");
 });
});
