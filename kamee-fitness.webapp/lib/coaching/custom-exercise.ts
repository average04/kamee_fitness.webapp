import type { Exercise } from "./plans";

export function timedSeconds(reps: string): number | null {
  const match = /^(\d+)s$/.exec(reps.trim());
  return match ? Number(match[1]) : null;
}

export function customExerciseIssue(name: string, reps: string): string | null {
  if (!name.trim() || name.trim().length > 120) return "Enter an exercise name (up to 120 characters).";
  const seconds = timedSeconds(reps);
  if (seconds !== null) return seconds >= 1 && seconds <= 3600 ? null : "Duration must be 1–3,600 seconds.";
  if (!/^[1-9]\d{0,2}(-[1-9]\d{0,2})?$/.test(reps)) return "Enter reps such as 10 or 8-12.";
  const [min, max] = reps.split("-").map(Number);
  return max !== undefined && max < min ? "The rep range must increase." : null;
}

export function makeCustomExercise(name: string, reps: string): Exercise {
  const issue = customExerciseIssue(name, reps);
  if (issue) throw new Error(issue);
  return { lineage_key: crypto.randomUUID(), exercise_id: null, custom_name: name.trim(),
    sets: 3, reps, rest_seconds: 60, tempo: null, weight_hint: null, notes: null, coaching_video_id: null };
}
