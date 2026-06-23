import { epley1Rm } from "./oneRepMax";

export type SetWithDate = { dateIso: string; reps: number; weightKg: number };

export type ExerciseSession = {
  dateIso: string;
  topSetKg: number;
  volumeKg: number;
  bestEst1RmKg: number;
};

export type ExerciseHistory = {
  series: ExerciseSession[];
  prKg: number;
  prDateIso: string | null;
  timesTrained: number;
  bestVolumeKg: number;
  lastWeightKg: number;
  totalReps: number;
};

export function buildExerciseHistory(sets: SetWithDate[]): ExerciseHistory {
  const byDate = new Map<string, ExerciseSession>();
  for (const s of sets) {
    const e =
      byDate.get(s.dateIso) ??
      { dateIso: s.dateIso, topSetKg: 0, volumeKg: 0, bestEst1RmKg: 0 };
    e.topSetKg = Math.max(e.topSetKg, s.weightKg);
    e.volumeKg += s.reps * s.weightKg;
    e.bestEst1RmKg = Math.max(e.bestEst1RmKg, epley1Rm(s.weightKg, s.reps));
    byDate.set(s.dateIso, e);
  }
  const series = [...byDate.values()].sort((a, b) =>
    a.dateIso.localeCompare(b.dateIso),
  );
  let prKg = 0;
  let prDateIso: string | null = null;
  for (const e of series) {
    if (e.topSetKg > prKg) {
      prKg = e.topSetKg;
      prDateIso = e.dateIso;
    }
  }
  const bestVolumeKg = series.reduce((m, e) => Math.max(m, e.volumeKg), 0);
  const lastWeightKg = series.length ? series[series.length - 1].topSetKg : 0;
  const totalReps = sets.reduce((s, x) => s + x.reps, 0);
  return {
    series,
    prKg,
    prDateIso,
    timesTrained: series.length,
    bestVolumeKg,
    lastWeightKg,
    totalReps,
  };
}
