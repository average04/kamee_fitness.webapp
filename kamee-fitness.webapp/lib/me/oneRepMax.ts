export type TrackingType = "weight_reps" | "reps" | "duration";
export type SetMetrics = {
  reps: number | null;
  weightKg: number | null;
  durationSeconds?: number | null;
  trackingType?: TrackingType;
};

export function isMeasuredLiftingSet(s: SetMetrics): s is SetMetrics & { reps: number; weightKg: number } {
  return (s.trackingType ?? "weight_reps") === "weight_reps" &&
    s.reps != null && Number.isFinite(s.reps) && s.reps > 0 &&
    s.weightKg != null && Number.isFinite(s.weightKg) && s.weightKg >= 0;
}

/** No estimate exists for unmeasured load or incompatible metrics. */
export function epley1Rm(weightKg: number | null, reps: number | null, trackingType: TrackingType = "weight_reps"): number | null {
  if (!isMeasuredLiftingSet({ weightKg, reps, trackingType }) || weightKg == null || reps == null || weightKg <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
