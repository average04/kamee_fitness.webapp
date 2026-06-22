/** Epley estimated one-rep max. reps <= 1 returns the weight unchanged. */
export function epley1Rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
