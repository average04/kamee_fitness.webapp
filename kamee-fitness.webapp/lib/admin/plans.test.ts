import { describe, expect, it } from "vitest";
import {
  parsePlanForm,
  reorder,
  validatePlanInput,
  type PlanInput,
} from "./plans";

const base: PlanInput = {
  title: "Push Pull Legs",
  summary: null,
  goal: null,
  level: "beginner",
  weeks_count: 4,
  est_minutes_per_session: 45,
  price_cents: 0,
  currency: "USD",
  equipment_tier: "minimal",
  required_equipment: [],
  target_muscles: [],
  kind: "system",
  cover_image_path: null,
};

describe("validatePlanInput", () => {
  it("accepts a valid plan", () => {
    expect(validatePlanInput(base).ok).toBe(true);
  });
  it("requires a title", () => {
    const r = validatePlanInput({ ...base, title: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBeTruthy();
  });
  it("bounds weeks_count to 1..52", () => {
    expect(validatePlanInput({ ...base, weeks_count: 0 }).ok).toBe(false);
    expect(validatePlanInput({ ...base, weeks_count: 53 }).ok).toBe(false);
    expect(validatePlanInput({ ...base, weeks_count: 1 }).ok).toBe(true);
  });
  it("rejects a negative price", () => {
    expect(validatePlanInput({ ...base, price_cents: -1 }).ok).toBe(false);
  });
  it("rejects invalid enum values", () => {
    expect(validatePlanInput({ ...base, level: "pro" as never }).ok).toBe(false);
    expect(
      validatePlanInput({ ...base, equipment_tier: "x" as never }).ok,
    ).toBe(false);
    expect(validatePlanInput({ ...base, kind: "z" as never }).ok).toBe(false);
  });
});

describe("parsePlanForm", () => {
  it("extracts fields, parses numbers/arrays, nulls blanks", () => {
    const fd = new FormData();
    fd.set("title", "  PPL  ");
    fd.set("summary", "");
    fd.set("goal", "strength");
    fd.set("level", "intermediate");
    fd.set("weeks_count", "6");
    fd.set("est_minutes_per_session", "");
    fd.set("price_cents", "999");
    fd.set("currency", "usd");
    fd.set("equipment_tier", "full_gym");
    fd.set("required_equipment", "barbell\ndumbbell\n barbell");
    fd.set("target_muscles", "chest\nback");
    fd.set("kind", "custom");

    const out = parsePlanForm(fd);
    expect(out.title).toBe("PPL");
    expect(out.summary).toBeNull();
    expect(out.goal).toBe("strength");
    expect(out.level).toBe("intermediate");
    expect(out.weeks_count).toBe(6);
    expect(out.est_minutes_per_session).toBeNull();
    expect(out.price_cents).toBe(999);
    expect(out.currency).toBe("USD");
    expect(out.equipment_tier).toBe("full_gym");
    expect(out.required_equipment).toEqual(["barbell", "dumbbell"]);
    expect(out.target_muscles).toEqual(["chest", "back"]);
    expect(out.kind).toBe("custom");
  });

  it("defaults numbers safely on garbage input", () => {
    const fd = new FormData();
    fd.set("title", "x");
    fd.set("weeks_count", "abc");
    fd.set("price_cents", "");
    const out = parsePlanForm(fd);
    expect(out.weeks_count).toBe(1);
    expect(out.price_cents).toBe(0);
  });
});

describe("reorder", () => {
  it("moves an item up by swapping with its predecessor", () => {
    expect(reorder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
  });
  it("moves an item down", () => {
    expect(reorder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the edges or for unknown ids", () => {
    expect(reorder(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(reorder(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
    expect(reorder(["a", "b", "c"], "z", "up")).toEqual(["a", "b", "c"]);
  });
});
