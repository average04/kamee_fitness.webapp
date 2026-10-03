import { epley1Rm, isMeasuredLiftingSet, type SetMetrics } from "./oneRepMax";

export type SetWithDate = SetMetrics & { dateIso: string; sessionId?: string };
export type ExerciseSession = {
  sessionId: string;
  dateIso: string;
  topSetKg: number | null;
  volumeKg: number | null;
  bestEst1RmKg: number | null;
  reps: number;
  durationSeconds: number;
};
export type ExerciseHistory = {
  series: ExerciseSession[];
  prKg: number;
  prDateIso: string | null;
  timesTrained: number;
  bestVolumeKg: number;
  lastWeightKg: number | null;
  totalReps: number;
};

export function buildExerciseHistory(sets: SetWithDate[]): ExerciseHistory {
  const bySession = new Map<string, ExerciseSession>();
  for (const s of sets) {
    const id = s.sessionId ?? s.dateIso;
    const e = bySession.get(id) ?? { sessionId: id, dateIso: s.dateIso, topSetKg: null, volumeKg: null, bestEst1RmKg: null, reps: 0, durationSeconds: 0 };
    e.reps += s.reps ?? 0;
    e.durationSeconds += s.durationSeconds ?? 0;
    if (isMeasuredLiftingSet(s)) {
      e.topSetKg = Math.max(e.topSetKg ?? 0, s.weightKg);
      e.volumeKg = (e.volumeKg ?? 0) + s.reps * s.weightKg;
      const estimated = epley1Rm(s.weightKg, s.reps, s.trackingType);
      if (estimated != null) e.bestEst1RmKg = Math.max(e.bestEst1RmKg ?? 0, estimated);
    }
    bySession.set(id, e);
  }
  const series = [...bySession.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  let prKg = 0;
  let prDateIso: string | null = null;
  for (const e of series) {
    if (e.topSetKg != null && e.topSetKg > prKg) { prKg = e.topSetKg; prDateIso = e.dateIso; }
  }
  return {
    series, prKg, prDateIso, timesTrained: series.length,
    bestVolumeKg: series.reduce((m, e) => Math.max(m, e.volumeKg ?? 0), 0),
    lastWeightKg: series.at(-1)?.topSetKg ?? null,
    totalReps: series.reduce((sum, s) => sum + s.reps, 0),
  };
}
