import type { Ingredient, Meal, Meals, Nutrition } from "./plans";

const nutritionFields = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

export function sumNutrition(items: readonly Nutrition[]): Nutrition {
  const totals: Nutrition = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const item of items) {
    for (const field of nutritionFields) totals[field] += item[field];
  }
  for (const field of nutritionFields) {
    totals[field] = Math.round(totals[field] * 10) / 10;
  }
  return totals;
}

export function usesIngredientTotals(meal: Meal): boolean {
  const totals = sumNutrition(meal.ingredients);
  return nutritionFields.every((field) => meal[field] === totals[field]);
}

export function applyIngredientChanges(
  meal: Meal,
  ingredients: Ingredient[],
  manualOverride = false,
): Meal {
  const totals =
    !manualOverride && usesIngredientTotals(meal)
      ? sumNutrition(ingredients)
      : {};
  return { ...meal, ...totals, ingredients };
}

export function copyMealsToDays(
  value: Meals,
  sourceDayKey: string,
  destinationDayKeys: readonly string[],
): Meals {
  const source = value.days.find((day) => day.day_key === sourceDayKey);
  if (!source) return value;

  const destinations = new Set(destinationDayKeys);
  let changed = false;
  const days = value.days.map((day) => {
    if (day.day_key === sourceDayKey || !destinations.has(day.day_key)) return day;
    changed = true;
    return { ...day, meals: structuredClone(source.meals) };
  });
  return changed ? { ...value, days } : value;
}
