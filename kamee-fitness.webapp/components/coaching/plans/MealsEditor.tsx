"use client";

import { useId, useRef, useState } from "react";
import { copyMealsToDays, sumNutrition } from "@/lib/coaching/meal-editing";
import { dayKeys, duplicate, emptyNutrition, mealDayLabel, mealDayName, newMeals, type Meals, type Video } from "@/lib/coaching/plans";
import { Field, Select } from "./Fields";
import { MealEditorPanel, mealSlotLabels, NutritionFields, NutritionSummary } from "./MealEditorPanel";

const focusLabels: Record<string, string> = {
  steady: "Balanced", protein: "Higher protein", light: "Light day",
  carb_up: "Higher carbohydrate", fuel_run: "Fuel for running",
};

export function MealsEditor({ value, videos, onChange }: {
  value: Meals | null; videos: Video[]; onChange: (value: Meals | null) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [mealIndex, setMealIndex] = useState<number | null>(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [showTargets, setShowTargets] = useState(false);
  // Existing saved totals stay fixed unless the coach explicitly opts in to calculation.
  const [manualModes, setManualModes] = useState<Record<string, boolean>>({});
  const editorRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const copyDialog = useRef<HTMLDialogElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const editorId = useId();
  const copyTitleId = useId();
  const copyDescriptionId = useId();
  const targetFieldsId = useId();

  const reveal = (target: "editor" | "list", focusIndex?: number) => {
    requestAnimationFrame(() => {
      const element = target === "editor" ? editorRef.current : listRef.current;
      const workbench = editorRef.current?.parentElement;
      const focusTarget = target === "list" && focusIndex !== undefined
        ? listRef.current?.querySelector<HTMLButtonElement>(`[data-meal-edit="${focusIndex}"]`) ?? element
        : element;
      focusTarget?.focus({ preventScroll: true });
      if (element && workbench && getComputedStyle(workbench).gridTemplateColumns.split(" ").length === 1) {
        element.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
    });
  };

  if (!value) return <section className="coach-panel plan-stack">
    <h2>Meals for each day</h2>
    <p className="coach-panel-description">Optional. Add a daily menu, or continue to preview.</p>
    <button type="button" className="plan-primary" onClick={() => onChange(newMeals())}>Add meals</button>
  </section>;

  const selectedDay = Math.min(selected, value.days.length - 1);
  const day = value.days[selectedDay];
  const meal = mealIndex === null ? null : day.meals[mealIndex];
  const totals = sumNutrition(day.meals);
  const updateDay = (patch: Partial<typeof day>) => {
    setNotice("");
    onChange({ ...value, days: value.days.map((d) => d.day_key === day.day_key ? { ...d, ...patch } : d) });
  };
  const chooseMeal = (index: number) => { setMealIndex(index); reveal("editor"); };

  return <section className="coach-panel plan-stack plan-meals-workspace">
    <div className="plan-card">
      <div><h2>Meals for each day</h2><p className="coach-panel-description">Build a daily menu, then reuse it wherever it fits.</p></div>
      <button ref={copyButton} type="button" className="plan-secondary" disabled={!day.meals.length || value.days.length < 2} onClick={() => { setCopyTargets([]); copyDialog.current?.showModal(); }}>Copy day</button>
    </div>
    <details className="plan-meal-disclosure plan-meal-settings"><summary>Meal plan settings</summary><div className="plan-stack">
      <div className="plan-grid">
        <Field label="Title" maxLength={80} value={value.title} onChange={(title) => onChange({ ...value, title })} />
        <Select label="Schedule by" value={value.keyed_by} onChange={(v) => {
          const keyed_by = v as Meals["keyed_by"];
          if (!confirm("Changing the schedule replaces its meal days. Continue?")) return;
          setSelected(0); setMealIndex(null); setError(""); setNotice("");
          onChange({ ...value, keyed_by, days: dayKeys(keyed_by).map((day_key) => ({
            ...emptyNutrition(), kcal: 2000, lineage_key: crypto.randomUUID(), day_key,
            shape: "steady", label: mealDayName(day_key), note: "", meals: [],
          })) });
        }}><option value="weekday">Day 1–7</option><option value="day_kind">Training day type</option></Select>
      </div>
      <button type="button" className="plan-danger" onClick={() => { if (confirm("Remove the attached meals from this draft?")) onChange(null); }}>Remove meals</button>
    </div></details>

    <div className={`plan-meal-days${value.keyed_by === "day_kind" ? " plan-meal-days-by-kind" : ""}`} role="group" aria-label="Meal day">
      {value.days.map((d, i) => <button type="button" key={d.day_key} aria-pressed={selectedDay === i}
        aria-label={`${mealDayName(d.day_key)}, ${d.meals.length} ${d.meals.length === 1 ? "meal" : "meals"}`}
        onClick={() => { setSelected(i); setMealIndex(null); setError(""); setNotice(""); }}>
        <span>{mealDayName(d.day_key)}</span>
        <small>{d.meals.length ? <>{d.meals.length}<span className="plan-meal-count-word"> {d.meals.length === 1 ? "meal" : "meals"}</span></> : "—"}</small>
      </button>)}
    </div>
    <div className="plan-card plan-meal-day-heading">
      <div><h3>{mealDayLabel(day)}</h3><p className="coach-panel-description">{focusLabels[day.shape] ?? day.shape}{day.note ? ` · ${day.note}` : ""}</p></div>
      <span className="plan-meal-meta">{day.meals.length} {day.meals.length === 1 ? "meal" : "meals"}</span>
    </div>
    <details className="plan-meal-disclosure plan-meal-settings" key={day.lineage_key}><summary>Day settings</summary><div className="plan-stack">
      <div className="plan-grid">
        <Field label="Day label" maxLength={40} value={mealDayLabel(day)} onChange={(label) => updateDay({ label })} />
        <Select label="Nutrition focus" value={day.shape} onChange={(shape) => updateDay({ shape })}>{Object.entries(focusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
      </div>
      <Field label="Day note" maxLength={240} value={day.note} onChange={(note) => updateDay({ note })} />
    </div></details>

    <div className="plan-meal-workbench">
      <section ref={listRef} className="plan-meal-list" aria-label="Meals in this day" tabIndex={-1}>
        {!day.meals.length && <div className="plan-meal-empty"><h4>No meals yet</h4><p>Add a meal, or copy a menu from another day.</p></div>}
        {day.meals.map((item, i) => <article className={`plan-meal-card${mealIndex === i ? " plan-meal-selected" : ""}`} key={i}>
          <span className="plan-meal-meta">{mealSlotLabels[item.slot] ?? item.slot}</span>
          <h4>{item.title || `Meal ${i + 1}`}</h4>
          <p className="plan-meal-card-detail">{item.portion_note || "Portion not set"} · {item.ingredients.length} {item.ingredients.length === 1 ? "ingredient" : "ingredients"}</p>
          <div className="plan-card"><span>{item.kcal} kcal</span><button type="button" className="plan-secondary" data-meal-edit={i} aria-pressed={mealIndex === i} aria-controls={editorId} aria-label={`Edit ${item.title || `meal ${i + 1}`}`} onClick={() => chooseMeal(i)}>{mealIndex === i ? "Editing" : "Edit"}</button></div>
        </article>)}
        <button type="button" className="plan-secondary plan-meal-add" disabled={day.meals.length >= 8} onClick={() => {
          setManualModes((modes) => ({ ...modes, [`${day.lineage_key}:${day.meals.length}`]: false }));
          updateDay({ meals: [...day.meals, { ...emptyNutrition(), slot: "breakfast", title: "", portion_note: "", ingredients: [], steps: [], substitutions: [], video_id: null }] });
          chooseMeal(day.meals.length);
        }}>+ Add meal</button>
      </section>
      <section id={editorId} ref={editorRef} className="plan-meal-editor" aria-label="Edit selected meal" tabIndex={-1}>
        {meal && mealIndex !== null ? <MealEditorPanel key={`${day.lineage_key}:${mealIndex}`} value={meal} videos={videos} canDuplicate={day.meals.length < 8}
          manualNutrition={manualModes[`${day.lineage_key}:${mealIndex}`] ?? true}
          onNutritionModeChange={(manual) => setManualModes((modes) => ({ ...modes, [`${day.lineage_key}:${mealIndex}`]: manual }))}
          onChange={(next) => updateDay({ meals: day.meals.map((m, i) => i === mealIndex ? next : m) })}
          onDone={() => { setMealIndex(null); reveal("list", mealIndex); }}
          onDuplicate={() => {
            if (day.meals.length >= 8) return;
            setManualModes((modes) => ({ ...modes, [`${day.lineage_key}:${day.meals.length}`]: modes[`${day.lineage_key}:${mealIndex}`] ?? true }));
            updateDay({ meals: [...day.meals, duplicate(meal)] }); chooseMeal(day.meals.length);
          }}
          onRemove={() => {
            if (!confirm(`Remove ${meal.title || "this meal"} from the draft?`)) return;
            setManualModes((modes) => {
              const next = { ...modes };
              day.meals.forEach((_, i) => delete next[`${day.lineage_key}:${i}`]);
              day.meals.forEach((_, i) => {
                if (i !== mealIndex) next[`${day.lineage_key}:${i < mealIndex ? i : i - 1}`] = modes[`${day.lineage_key}:${i}`] ?? true;
              });
              return next;
            });
            updateDay({ meals: day.meals.filter((_, i) => i !== mealIndex) }); setMealIndex(null); reveal("list");
          }} /> : <div className="plan-meal-empty"><h4>Choose a meal to edit</h4><p>Start with its name and ingredients. Add the extra details when you need them.</p></div>}
      </section>
    </div>

    <section className="plan-meal-daily-nutrition" aria-label="Daily nutrition summary">
      <div><div className="plan-card"><h3>Meals add up to</h3><span className="plan-meal-meta">Calculated</span></div><NutritionSummary value={totals} /></div>
      <div><div className="plan-card"><h3>Daily targets</h3><button type="button" className="plan-meal-text-action" aria-expanded={showTargets} aria-controls={targetFieldsId} onClick={() => setShowTargets(!showTargets)}>{showTargets ? "Done" : "Edit targets"}</button></div><NutritionSummary value={day} /><p className="coach-panel-description">Targets stay as you set them when meals change.</p></div>
    </section>
    {showTargets && <section id={targetFieldsId} className="plan-block plan-stack" aria-label="Edit daily targets">
      <h3>Daily targets for {mealDayLabel(day)}</h3>
      <NutritionFields dayTotals value={day} onChange={updateDay} />
      <button type="button" className="plan-secondary" disabled={!day.meals.length} onClick={() => {
        if (!Number.isInteger(totals.kcal) || totals.kcal < 1200 || totals.kcal > 6000 || totals.protein_g > 500 || totals.fat_g > 500 || totals.carbs_g > 1000) {
          setError("Daily targets need 1,200–6,000 whole calories, protein/fat up to 500 g and carbs up to 1,000 g. Add the remaining meals first."); return;
        }
        setError(""); updateDay(totals);
      }}>Use meal totals as targets</button>
      {error && <p role="alert">{error}</p>}
    </section>}
    {notice && <p role="status" className="plan-meal-notice">{notice}</p>}

    <dialog ref={copyDialog} className="plan-meal-copy-dialog" aria-labelledby={copyTitleId} aria-describedby={copyDescriptionId} onClose={() => copyButton.current?.focus({ preventScroll: true })}>
      <div className="plan-stack">
        <h2 id={copyTitleId}>Copy {mealDayName(day.day_key)} meals</h2>
        <p id={copyDescriptionId} className="coach-panel-description">Choose where to copy these {day.meals.length} meals. Existing meals on the selected days will be replaced. Daily targets and day settings stay unchanged.</p>
        <div className="plan-meal-copy-options">{value.days.filter((d) => d.day_key !== day.day_key).map((d) => <label key={d.day_key}>
          <input type="checkbox" checked={copyTargets.includes(d.day_key)} onChange={(e) => setCopyTargets(e.target.checked ? [...copyTargets, d.day_key] : copyTargets.filter((key) => key !== d.day_key))} />
          <span>{mealDayName(d.day_key)}<small>{d.meals.length ? `${d.meals.length} meals will be replaced` : "No meals yet"}</small></span>
        </label>)}</div>
        <div className="plan-card plan-meal-dialog-actions"><button type="button" className="plan-secondary" onClick={() => copyDialog.current?.close()}>Cancel</button>
          <button type="button" className="plan-primary" disabled={!copyTargets.length} onClick={() => {
            setManualModes((modes) => {
              const next = { ...modes };
              value.days.filter((d) => copyTargets.includes(d.day_key)).forEach((destination) => {
                for (let i = 0; i < Math.max(destination.meals.length, day.meals.length); i++) delete next[`${destination.lineage_key}:${i}`];
                day.meals.forEach((_, i) => { next[`${destination.lineage_key}:${i}`] = modes[`${day.lineage_key}:${i}`] ?? true; });
              });
              return next;
            });
            onChange(copyMealsToDays(value, day.day_key, copyTargets));
            setNotice(`Meals copied to ${copyTargets.length} ${copyTargets.length === 1 ? "day" : "days"}. Save the draft to keep your changes.`);
            copyDialog.current?.close();
          }}>Copy meals</button></div>
      </div>
    </dialog>
  </section>;
}
