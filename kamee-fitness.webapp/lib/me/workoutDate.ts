import type { WorkoutSessionRow } from "./queries";

/** Freestyle training uses its captured local date; legacy planned rows keep UTC behavior. */
export function workoutTrainingIso(w: Pick<WorkoutSessionRow, "source" | "performed_date" | "started_at">): string {
  return w.source === "freestyle" && w.performed_date ? w.performed_date : w.started_at;
}

export function workoutDate(w: Pick<WorkoutSessionRow, "source" | "performed_date" | "started_at">): string {
  return workoutTrainingIso(w).slice(0, 10);
}
