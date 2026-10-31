import { describe, expect, it } from "vitest";
import type { Ingredient, Meal, Meals, Nutrition } from "./plans";
import {
  applyIngredientChanges,
  copyMealsToDays,
  sumNutrition,
  usesIngredientTotals,
} from "./meal-editing";

const zero: Nutrition = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
const rice: Ingredient = {
  name: "Rice",
  quantity: 1,
  unit: "cup",
  kcal: 200,
  protein_g: 4,
  carbs_g: 44,
  fat_g: 0.5,
};
const meal = (overrides: Partial<Meal> = {}): Meal => ({
  ...zero,
  kcal: 200,
  protein_g: 4,
  carbs_g: 44,
  fat_g: 0.5,
  slot: "lunch",
  title: "Rice bowl",
  portion_note: "One bowl",
  ingredients: [{ ...rice }],
  steps: ["Cook rice"],
  substitutions: [{ for: "Rice", use: "Quinoa", note: "Same portion" }],
  video_id: "video-1",
  ...overrides,
});

describe("meal nutrition editing", () => {
  it("rounds each final ingredient sum to one decimal", () => {
    expect(
      sumNutrition([
        { kcal: 0.1, protein_g: 1.24, carbs_g: 2.36, fat_g: 0.15 },
        { kcal: 0.2, protein_g: 1.24, carbs_g: 2.36, fat_g: 0.15 },
      ]),
    ).toEqual({ kcal: 0.3, protein_g: 2.5, carbs_g: 4.7, fat_g: 0.3 });
    expect(sumNutrition([])).toEqual(zero);
  });

  it("recognizes calculated totals and empty new meals", () => {
    expect(usesIngredientTotals(meal())).toBe(true);
    expect(usesIngredientTotals(meal({ ...zero, ingredients: [] }))).toBe(true);
    expect(usesIngredientTotals(meal({ protein_g: 20 }))).toBe(false);
    expect(usesIngredientTotals(meal({ ingredients: [] }))).toBe(false);
  });

  it("updates calculated totals when ingredients change without mutating the meal", () => {
    const original = meal();
    const ingredients = [{ ...rice, kcal: 250, protein_g: 5 }];

    expect(applyIngredientChanges(original, ingredients)).toEqual({
      ...original,
      ingredients,
      kcal: 250,
      protein_g: 5,
    });
    expect(original.kcal).toBe(200);
    expect(original.ingredients[0].kcal).toBe(200);
  });

  it("calculates totals for the first ingredients of an empty new meal", () => {
    expect(
      applyIngredientChanges(meal({ ...zero, ingredients: [] }), [rice]),
    ).toMatchObject({ kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0.5 });
  });

  it("preserves every stored nutrition value when any manual total differs", () => {
    const manual = meal({ protein_g: 20 });
    const ingredients = [{ ...rice, kcal: 500, carbs_g: 100 }];

    expect(applyIngredientChanges(manual, ingredients)).toEqual({
      ...manual,
      ingredients,
    });
  });

  it("honors explicit manual mode even when previous totals equal ingredients", () => {
    const original = meal();
    const ingredients = [{ ...rice, kcal: 500, protein_g: 20 }];

    expect(applyIngredientChanges(original, ingredients, true)).toEqual({
      ...original,
      ingredients,
    });
  });
});

const meals = (): Meals => ({
  lineage_key: "meal-plan",
  title: "Weekly meals",
  keyed_by: "weekday",
  days: ["mon", "tue", "wed", "thu"].map((day_key, index) => ({
    lineage_key: `day-${index}`,
    day_key,
    label: `Label ${index}`,
    shape: `Shape ${index}`,
    note: `Note ${index}`,
    kcal: 1800 + index * 100,
    protein_g: 100 + index * 10,
    carbs_g: 200 + index * 20,
    fat_g: 50 + index * 5,
    meals: [meal({ title: `${day_key} bowl` })],
  })),
});

describe("copying meals to days", () => {
  it("copies only meals while preserving destination targets and identity", () => {
    const original = meals();
    const result = copyMealsToDays(original, "mon", ["tue", "wed", "mon", "missing"]);

    expect(result).not.toBe(original);
    expect(result).toMatchObject({
      lineage_key: "meal-plan",
      title: "Weekly meals",
      keyed_by: "weekday",
    });
    for (const index of [1, 2]) {
      expect(result.days[index]).toEqual({
        ...original.days[index],
        meals: original.days[0].meals,
      });
    }
    expect(result.days[0]).toBe(original.days[0]);
    expect(result.days[3]).toBe(original.days[3]);
    expect(original.days[1].meals[0].title).toBe("tue bowl");
  });

  it("deeply isolates each destination from the source and other copies", () => {
    const original = meals();
    const result = copyMealsToDays(original, "mon", ["tue", "wed"]);
    const copiedMeal = result.days[1].meals[0];
    copiedMeal.ingredients[0].name = "Brown rice";
    copiedMeal.steps[0] = "Steam rice";
    copiedMeal.substitutions[0].note = "Double portion";

    for (const untouched of [original.days[0].meals[0], result.days[2].meals[0]]) {
      expect(untouched.ingredients[0].name).toBe("Rice");
      expect(untouched.steps[0]).toBe("Cook rice");
      expect(untouched.substitutions[0].note).toBe("Same portion");
    }
  });

  it("returns the original when there is no source or valid other destination", () => {
    const original = meals();
    expect(copyMealsToDays(original, "missing", ["tue"])).toBe(original);
    expect(copyMealsToDays(original, "mon", [])).toBe(original);
    expect(copyMealsToDays(original, "mon", ["mon", "missing"])).toBe(original);
  });
});
