import { customExerciseIssue } from "./custom-exercise";
import { planGoals } from "./goals";
import type { PlanDocument } from "./plans";

export const commaValues = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export function validateDraft(plan: PlanDocument): string[] {
  const issues: string[] = [];
  const goals = planGoals(plan);
  if (goals.length > 12 || new Set(goals).size !== goals.length || goals.some(g => !g.trim() || g.length > 80 || g !== g.trim()))
    issues.push("Choose up to 12 unique goals, each 1-80 characters.");
  if (plan.est_minutes_per_session != null && (!Number.isInteger(plan.est_minutes_per_session) || plan.est_minutes_per_session < 1 || plan.est_minutes_per_session > 1440))
    issues.push("Estimated session minutes must be a whole number from 1 to 1,440.");
  plan.weeks.forEach((w, wi) =>
    w.days.forEach((d, di) =>
      d.blocks.forEach((b) =>
        b.exercises.forEach((e) => {
          if (!e.exercise_id) {
            const issue = customExerciseIssue(e.custom_name ?? "", e.reps);
            if (issue) issues.push(`Week ${wi + 1}, day ${di + 1}: ${issue}`);
          }
          if (
            !Number.isInteger(e.sets) ||
            e.sets < 1 ||
            e.sets > 30 ||
            !Number.isInteger(e.rest_seconds) ||
            e.rest_seconds < 0 ||
            e.rest_seconds > 3600
          )
            issues.push(
              `Week ${wi + 1}, day ${di + 1}: sets must be whole numbers from 1 to 30; rest seconds from 0 to 3600.`,
            );
        }),
      ),
    ),
  );
  if (plan.meals) {
    if (!plan.meals.title.trim() || plan.meals.title.length > 80)
      issues.push("Meal schedule title must be 1-80 characters.");
    for (const d of plan.meals.days) {
      if (d.label.length > 40 || d.note.length > 240)
        issues.push(
          `${d.day_key}: meal label allows 40 characters and note allows 240.`,
        );
      if (!Number.isInteger(d.kcal) || d.kcal < 1200 || d.kcal > 6000)
        issues.push(
          `${d.day_key}: day calories must be a whole number from 1,200 to 6,000.`,
        );
      if (
        d.protein_g < 0 ||
        d.protein_g > 500 ||
        d.fat_g < 0 ||
        d.fat_g > 500 ||
        d.carbs_g < 0 ||
        d.carbs_g > 1000
      )
        issues.push(
          `${d.day_key}: protein/fat must be 0-500 g and carbs 0-1,000 g.`,
        );
    }
  }
  return issues;
}
/** Only author-editable fields cross the action boundary; omit DB IDs/timestamps. */
export function draftPayload(p: PlanDocument) {
  return {
    title: p.title,
    summary: p.summary,
    goal: planGoals(p)[0] ?? null,
    goals: planGoals(p),
    level: p.level,
    equipment_tier: p.equipment_tier,
    required_equipment: p.required_equipment.filter(Boolean),
    target_muscles: p.target_muscles.filter(Boolean),
    est_minutes_per_session: p.est_minutes_per_session,
    cover_image_path: p.cover_image_path,
    change_note: p.change_note,
    weeks: p.weeks.map((w) => ({
      lineage_key: w.lineage_key,
      role: w.role,
      days: w.days.map((d) => ({
        lineage_key: d.lineage_key,
        title: d.title,
        day_kind: d.day_kind,
        coaching_video_id: d.coaching_video_id,
        blocks: d.blocks.map((b) => ({
          lineage_key: b.lineage_key,
          kind: b.kind,
          exercises: b.exercises.map((e) => ({
            lineage_key: e.lineage_key,
            exercise_id: e.exercise_id,
            custom_name: e.custom_name ?? null,
            sets: e.sets,
            reps: e.reps,
            tempo: e.tempo,
            rest_seconds: e.rest_seconds,
            weight_hint: e.weight_hint,
            notes: e.notes,
            coaching_video_id: e.coaching_video_id,
          })),
        })),
        cardio: d.cardio
          ? {
              lineage_key: d.cardio.lineage_key,
              segments: d.cardio.segments,
              notes: d.cardio.notes,
              session_type: d.cardio.session_type,
            }
          : null,
      })),
    })),
    meals: p.meals
      ? {
          lineage_key: p.meals.lineage_key,
          title: p.meals.title,
          keyed_by: p.meals.keyed_by,
          days: p.meals.days.map((d) => ({
            lineage_key: d.lineage_key,
            day_key: d.day_key,
            shape: d.shape,
            label: d.label,
            note: d.note,
            kcal: d.kcal,
            protein_g: d.protein_g,
            carbs_g: d.carbs_g,
            fat_g: d.fat_g,
            meals: d.meals,
          })),
        }
      : null,
  };
}
export function actionError(error: { code?: string; message: string }): string {
  if (error.code === "40001" || error.code === "PT409")
    return "This plan changed in another tab. Reload to compare the saved version and your local copy. Restoring keeps conflict protection.";
  if (error.code === "42501")
    return "Your access changed. Sign in again or contact support; your local edits are preserved.";
  if (error.code === "P0001") return error.message;
  if (error.code?.startsWith("22") || error.code?.startsWith("23"))
    return "Check the plan values and required fields before saving.";
  return "Could not save. Your local edits are preserved; try again.";
}
