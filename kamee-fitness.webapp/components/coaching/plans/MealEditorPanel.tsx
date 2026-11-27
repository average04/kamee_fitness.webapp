"use client";

import { useState } from "react";
import { applyIngredientChanges, sumNutrition } from "@/lib/coaching/meal-editing";
import { emptyNutrition, type Meal, type Nutrition, type Video } from "@/lib/coaching/plans";
import { Field, Select, VideoSelect } from "./Fields";

export const mealSlotLabels: Record<string, string> = {
  breakfast: "Breakfast", snack_am: "Morning snack", lunch: "Lunch",
  snack_pm: "Afternoon snack", dinner: "Dinner", pre_run: "Before a run", post_run: "After a run",
};

export function NutritionFields({ value, onChange, dayTotals = false }: {
  value: Nutrition; onChange: (value: Nutrition) => void; dayTotals?: boolean;
}) {
  const macros: [keyof Nutrition, string][] = [["kcal", "Calories"], ["protein_g", "Protein (g)"], ["carbs_g", "Carbs (g)"], ["fat_g", "Fat (g)"]];
  return <div className="plan-grid">{macros.map(([key, label]) => <Field key={key} label={label} type="number"
    min={dayTotals && key === "kcal" ? 1200 : 0}
    max={dayTotals ? (key === "kcal" ? 6000 : key === "carbs_g" ? 1000 : 500) : undefined}
    step={key === "kcal" ? 1 : 0.1} value={value[key]}
    onChange={(v) => onChange({ ...value, [key]: Number(v) })} />)}</div>;
}

export function NutritionSummary({ value }: { value: Nutrition }) {
  return <dl className="plan-meal-nutrition-values">{(["kcal", "protein_g", "carbs_g", "fat_g"] as const).map((key, i) => (
    <div key={key}><dt>{["Calories", "Protein", "Carbs", "Fat"][i]}</dt><dd>{Number(value[key].toFixed(1))}{i ? "g" : ""}</dd></div>
  ))}</dl>;
}

export function MealEditorPanel({ value: meal, videos, onChange, onDone, onDuplicate, onRemove, canDuplicate, manualNutrition, onNutritionModeChange }: {
  value: Meal; videos: Video[]; onChange: (value: Meal) => void;
  onDone: () => void; onDuplicate: () => void; onRemove: () => void; canDuplicate: boolean;
  manualNutrition: boolean; onNutritionModeChange: (manual: boolean) => void;
}) {
  const [openIngredient, setOpenIngredient] = useState<number | null>(null);
  const set = (patch: Partial<Meal>) => onChange({ ...meal, ...patch });
  const updateIngredients = (ingredients: Meal["ingredients"]) => onChange(applyIngredientChanges(meal, ingredients, manualNutrition));
  const calculated = sumNutrition(meal.ingredients);
  return <div className="plan-stack">
    <div className="plan-card"><h3>Edit {mealSlotLabels[meal.slot]?.toLowerCase() ?? "meal"}</h3><span className="plan-meal-meta">Changes stay in your draft</span></div>
    <Field label="Meal name" value={meal.title} onChange={(title) => set({ title })} />
    <div className="plan-meal-two-fields">
      <Select label="Meal time" value={meal.slot} onChange={(slot) => set({ slot })}>{Object.entries(mealSlotLabels).map(([slot, label]) => <option key={slot} value={slot}>{label}</option>)}</Select>
      <Field label="Portion" value={meal.portion_note} onChange={(portion_note) => set({ portion_note })} />
    </div>
    <section className="plan-meal-ingredients" aria-label="Ingredients">
      <div className="plan-card"><h4>Ingredients</h4><span className="plan-meal-meta">Open one to edit</span></div>
      {!meal.ingredients.length && <p className="coach-panel-description">Add ingredients to calculate this meal’s nutrition.</p>}
      {meal.ingredients.map((ingredient, ii) => {
        const update = (patch: Partial<typeof ingredient>) => updateIngredients(meal.ingredients.map((item, i) => i === ii ? { ...item, ...patch } : item));
        return <details className="plan-meal-ingredient" key={ii} open={openIngredient === ii} onToggle={(event) => {
          if (event.currentTarget.open) setOpenIngredient(ii);
          else setOpenIngredient((current) => current === ii ? null : current);
        }}>
          <summary><span className="plan-meal-ingredient-name">{ingredient.name || `Ingredient ${ii + 1}`}<small>{ingredient.quantity} {ingredient.unit}</small></span><span className="plan-meal-meta">{ingredient.kcal} kcal</span></summary>
          <div className="plan-stack">
            <Field label="Ingredient" value={ingredient.name} onChange={(name) => update({ name })} />
            <div className="plan-meal-two-fields">
              <Field label="Quantity" type="number" min={0} step="any" value={ingredient.quantity} onChange={(v) => update({ quantity: Number(v) })} />
              <Field label="Unit" value={ingredient.unit} onChange={(unit) => update({ unit })} />
            </div>
            <NutritionFields value={ingredient} onChange={update} />
            <button type="button" className="plan-danger" onClick={() => { updateIngredients(meal.ingredients.filter((_, i) => i !== ii)); setOpenIngredient(null); }}>Remove ingredient</button>
          </div>
        </details>;
      })}
      <button type="button" className="plan-meal-text-action" disabled={meal.ingredients.length >= 15} onClick={() => {
        setOpenIngredient(meal.ingredients.length);
        updateIngredients([...meal.ingredients, { ...emptyNutrition(), name: "", quantity: 1, unit: "g" }]);
      }}>+ Add ingredient</button>
    </section>
    <section className="plan-meal-recipe-nutrition" aria-label="Meal nutrition">
      <div className="plan-card"><h4>Meal nutrition</h4><span className="plan-meal-meta">{manualNutrition ? "Stored totals" : "From ingredients"}</span></div>
      <NutritionSummary value={meal} />
      <details className="plan-meal-disclosure"><summary>Edit nutrition</summary><div className="plan-stack">
        <p className="coach-panel-description">Use calculated totals to keep nutrition in sync with ingredients, or enter your own totals. Daily targets stay unchanged.</p>
        <NutritionFields value={meal} onChange={(nutrition) => { onNutritionModeChange(true); set(nutrition); }} />
        <p className="coach-panel-description">Ingredients add up to {calculated.kcal} kcal · {calculated.protein_g}g protein · {calculated.carbs_g}g carbs · {calculated.fat_g}g fat.</p>
        <button type="button" className="plan-secondary" onClick={() => { onNutritionModeChange(false); set(calculated); }}>Use calculated totals</button>
      </div></details>
    </section>
    <details className="plan-meal-disclosure"><summary>More details</summary><div className="plan-stack">
      <Field label="Steps (one per line, up to 10)" multiline value={meal.steps.join("\n")} onChange={(v) => set({ steps: v.split("\n") })} />
      <h4>Substitutions</h4>
      {meal.substitutions.map((sub, si) => <div className="plan-exercise plan-stack" key={si}>
        <div className="plan-grid">{(["for", "use", "note"] as const).map((key) => <Field key={key} label={key === "for" ? "Replace" : key === "use" ? "With" : "Note"} value={sub[key]} onChange={(v) => set({ substitutions: meal.substitutions.map((s, i) => i === si ? { ...s, [key]: v } : s) })} />)}</div>
        <button type="button" className="plan-danger" onClick={() => set({ substitutions: meal.substitutions.filter((_, i) => i !== si) })}>Remove substitution</button>
      </div>)}
      <button type="button" className="plan-secondary" disabled={meal.substitutions.length >= 5} onClick={() => set({ substitutions: [...meal.substitutions, { for: "", use: "", note: "" }] })}>Add substitution</button>
      <VideoSelect value={meal.video_id} videos={videos} onChange={(video_id) => set({ video_id })} />
      <button type="button" className="plan-danger" onClick={onRemove}>Remove meal</button>
    </div></details>
    <div className="plan-card plan-meal-editor-actions"><button type="button" className="plan-secondary" disabled={!canDuplicate} onClick={onDuplicate}>Duplicate meal</button><button type="button" className="plan-primary" onClick={onDone}>Done</button></div>
  </div>;
}
