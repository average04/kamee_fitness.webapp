"use client";
import { useState } from "react";
import {
  dayKeys,
  emptyNutrition,
  newMeals,
  type Meals,
  type Nutrition,
  type Video,
} from "@/lib/coaching/plans";
import { Field, Select, VideoSelect } from "./Fields";

const macros: [keyof Nutrition, string][] = [
  ["kcal", "Calories"],
  ["protein_g", "Protein (g)"],
  ["carbs_g", "Carbs (g)"],
  ["fat_g", "Fat (g)"],
];
function NutritionFields({
  value,
  onChange,
  dayTotals = false,
}: {
  dayTotals?: boolean;
  value: Nutrition;
  onChange: (n: Nutrition) => void;
}) {
  return (
    <div className="plan-grid">
      {macros.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          type="number"
          min={dayTotals && key === "kcal" ? 1200 : 0}
          max={
            dayTotals
              ? key === "kcal"
                ? 6000
                : key === "carbs_g"
                  ? 1000
                  : 500
              : undefined
          }
          step={key === "kcal" ? 1 : 0.1}
          value={value[key]}
          onChange={(v) => onChange({ ...value, [key]: Number(v) })}
        />
      ))}
    </div>
  );
}
export function MealsEditor({
  value,
  videos,
  onChange,
}: {
  value: Meals | null;
  videos: Video[];
  onChange: (v: Meals | null) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  if (!value)
    return (
      <div className="coach-panel plan-stack">
        <h2>Meals</h2>
        <p className="coach-panel-description">
          Attach a meal schedule to this plan.
        </p>
        <button
          type="button"
          className="plan-primary"
          onClick={() => onChange(newMeals())}
        >
          Add meals
        </button>
      </div>
    );
  const day = value.days[selected] ?? value.days[0];
  const updateDay = (patch: Partial<typeof day>) =>
    onChange({
      ...value,
      days: value.days.map((d) =>
        d.day_key === day.day_key ? { ...d, ...patch } : d,
      ),
    });
  return (
    <section className="coach-panel plan-stack">
      <div className="plan-card">
        <h2>Meals</h2>
        <button
          type="button"
          className="plan-secondary"
          onClick={() => {
            if (confirm("Remove the attached meals from this draft?"))
              onChange(null);
          }}
        >
          Remove meals
        </button>
      </div>
      <Field
        label="Title"
        maxLength={80}
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
      />
      <Select
        label="Schedule by"
        value={value.keyed_by}
        onChange={(v) => {
          const keyed_by = v as Meals["keyed_by"];
          if (
            !confirm("Changing the schedule replaces its meal days. Continue?")
          )
            return;
          setSelected(0);
          onChange({
            ...value,
            keyed_by,
            days: dayKeys(keyed_by).map((day_key) => ({
              ...emptyNutrition(),
              kcal: 2000,
              lineage_key: crypto.randomUUID(),
              day_key,
              shape: "steady",
              label: day_key,
              note: "",
              meals: [],
            })),
          });
        }}
      >
        <option value="weekday">Weekday</option>
        <option value="day_kind">Training day type</option>
      </Select>
      <div className="plan-tabs" aria-label="Meal day">
        {value.days.map((d, i) => (
          <button
            type="button"
            aria-pressed={selected === i}
            key={d.day_key}
            onClick={() => setSelected(i)}
          >
            {d.day_key.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <div className="plan-grid">
        <Field
          label="Day label"
          maxLength={40}
          value={day.label}
          onChange={(label) => updateDay({ label })}
        />
        <Select
          label="Day shape"
          value={day.shape}
          onChange={(shape) => updateDay({ shape })}
        >
          {["steady", "protein", "light", "carb_up", "fuel_run"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      <Field
        label="Day note"
        maxLength={240}
        value={day.note}
        onChange={(note) => updateDay({ note })}
      />
      <h3>Day totals</h3>
      <NutritionFields dayTotals value={day} onChange={updateDay} />
      {day.meals.map((meal, mi) => {
        const set = (patch: Partial<typeof meal>) =>
          updateDay({
            meals: day.meals.map((m, i) => (i === mi ? { ...m, ...patch } : m)),
          });
        return (
          <div key={mi} className="plan-block plan-stack">
            <div className="plan-card">
              <h3>Meal {mi + 1}</h3>
              <button
                type="button"
                onClick={() =>
                  updateDay({ meals: day.meals.filter((_, i) => i !== mi) })
                }
              >
                Remove
              </button>
            </div>
            <div className="plan-grid">
              <Select
                label="Slot"
                value={meal.slot}
                onChange={(slot) => set({ slot })}
              >
                {[
                  "breakfast",
                  "snack_am",
                  "lunch",
                  "snack_pm",
                  "dinner",
                  "pre_run",
                  "post_run",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Field
                label="Meal name"
                value={meal.title}
                onChange={(title) => set({ title })}
              />
              <Field
                label="Portion"
                value={meal.portion_note}
                onChange={(portion_note) => set({ portion_note })}
              />
              <VideoSelect
                value={meal.video_id}
                videos={videos}
                onChange={(video_id) => set({ video_id })}
              />
            </div>
            <h4>Ingredients</h4>
            {meal.ingredients.map((ingredient, ii) => {
              const update = (patch: Partial<typeof ingredient>) =>
                set({
                  ingredients: meal.ingredients.map((v, i) =>
                    i === ii ? { ...v, ...patch } : v,
                  ),
                });
              return (
                <div className="plan-exercise plan-stack" key={ii}>
                  <div className="plan-grid">
                    <Field
                      label="Ingredient"
                      value={ingredient.name}
                      onChange={(name) => update({ name })}
                    />
                    <Field
                      label="Quantity"
                      type="number"
                      min={0}
                      step="any"
                      value={ingredient.quantity}
                      onChange={(v) => update({ quantity: Number(v) })}
                    />
                    <Field
                      label="Unit"
                      value={ingredient.unit}
                      onChange={(unit) => update({ unit })}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set({
                          ingredients: meal.ingredients.filter(
                            (_, i) => i !== ii,
                          ),
                        })
                      }
                    >
                      Remove ingredient
                    </button>
                  </div>
                  <NutritionFields value={ingredient} onChange={update} />
                </div>
              );
            })}
            <button
              type="button"
              className="plan-secondary"
              disabled={meal.ingredients.length >= 15}
              onClick={() =>
                set({
                  ingredients: [
                    ...meal.ingredients,
                    { ...emptyNutrition(), name: "", quantity: 1, unit: "g" },
                  ],
                })
              }
            >
              Add ingredient
            </button>
            <Field
              label="Steps (one per line, up to 10)"
              multiline
              value={meal.steps.join("\n")}
              onChange={(v) => set({ steps: v.split("\n") })}
            />
            <h4>Substitutions</h4>
            {meal.substitutions.map((sub, si) => (
              <div className="plan-grid" key={si}>
                {(["for", "use", "note"] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      key === "for"
                        ? "Replace"
                        : key === "use"
                          ? "With"
                          : "Note"
                    }
                    value={sub[key]}
                    onChange={(v) =>
                      set({
                        substitutions: meal.substitutions.map((s, i) =>
                          i === si ? { ...s, [key]: v } : s,
                        ),
                      })
                    }
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    set({
                      substitutions: meal.substitutions.filter(
                        (_, i) => i !== si,
                      ),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="plan-secondary"
              disabled={meal.substitutions.length >= 5}
              onClick={() =>
                set({
                  substitutions: [
                    ...meal.substitutions,
                    { for: "", use: "", note: "" },
                  ],
                })
              }
            >
              Add substitution
            </button>
            <h4>Meal totals</h4>
            <NutritionFields value={meal} onChange={set} />
            <button
              type="button"
              className="plan-secondary"
              onClick={() =>
                set(
                  meal.ingredients.reduce(
                    (n, i) => ({
                      kcal: n.kcal + i.kcal,
                      protein_g: n.protein_g + i.protein_g,
                      carbs_g: n.carbs_g + i.carbs_g,
                      fat_g: n.fat_g + i.fat_g,
                    }),
                    emptyNutrition(),
                  ),
                )
              }
            >
              Use ingredient totals
            </button>
          </div>
        );
      })}
      {error && <p role="alert">{error}</p>}
      <div className="plan-card">
        <button
          type="button"
          className="plan-secondary"
          disabled={day.meals.length >= 8}
          onClick={() =>
            updateDay({
              meals: [
                ...day.meals,
                {
                  ...emptyNutrition(),
                  slot: "breakfast",
                  title: "",
                  portion_note: "",
                  ingredients: [],
                  steps: [],
                  substitutions: [],
                  video_id: null,
                },
              ],
            })
          }
        >
          Add meal
        </button>
        <button
          type="button"
          className="plan-secondary"
          onClick={() => {
            const totals = day.meals.reduce(
              (n, m) => ({
                kcal: n.kcal + m.kcal,
                protein_g: n.protein_g + m.protein_g,
                carbs_g: n.carbs_g + m.carbs_g,
                fat_g: n.fat_g + m.fat_g,
              }),
              emptyNutrition(),
            );
            if (
              !Number.isInteger(totals.kcal) ||
              totals.kcal < 1200 ||
              totals.kcal > 6000 ||
              totals.protein_g > 500 ||
              totals.fat_g > 500 ||
              totals.carbs_g > 1000
            ) {
              setError(
                "Day totals need 1,200-6,000 whole calories, protein/fat up to 500 g and carbs up to 1,000 g. Add the remaining meals first.",
              );
              return;
            }
            setError("");
            updateDay(totals);
          }}
        >
          Use meal totals for day
        </button>
      </div>
    </section>
  );
}
