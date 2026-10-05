import { isMeasuredLiftingSet, type SetMetrics } from "./oneRepMax";

export type SetWithExercise = SetMetrics & {
  exerciseId: string;
  sessionId?: string;
  occurrenceId?: string;
  position?: number;
  ordinal?: number;
  name?: string;
  primaryMuscle?: string;
};

export type ExerciseBlock = {
  exerciseId: string;
  occurrenceId: string;
  name: string;
  primaryMuscle: string | null;
  sets: SetMetrics[];
  topSetKg: number | null;
  volumeKg: number | null;
  topDeltaKg: number | null;
  volumeDeltaKg: number | null;
  isPr: boolean;
};

export type WorkoutDetailSummary = {
  totalVolumeKg: number;
  totalVolumeDeltaKg: number | null;
  totalSets: number;
  totalReps: number;
  exercises: ExerciseBlock[];
};

type Agg = { first: SetWithExercise; sets: SetMetrics[]; top: number | null; vol: number | null };
function group(sets: SetWithExercise[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const s of sets) {
    const key = s.occurrenceId ?? s.exerciseId;
    const a = m.get(key) ?? { first: s, sets: [], top: null, vol: null };
    a.sets.push({ reps: s.reps, weightKg: s.weightKg, durationSeconds: s.durationSeconds ?? null, trackingType: s.trackingType ?? "weight_reps" });
    if (isMeasuredLiftingSet(s)) {
      a.top = Math.max(a.top ?? 0, s.weightKg);
      a.vol = (a.vol ?? 0) + s.reps * s.weightKg;
    }
    m.set(key, a);
  }
  return m;
}

export function summarizeWorkoutDetail(
  current: SetWithExercise[], previous: SetWithExercise[], names: Record<string, string>,
  priorMaxByExercise: Record<string, number>, muscleByExercise: Record<string, string>,
): WorkoutDetailSummary {
  // Source adapters order positions and ordinals; never merge repeated occurrences.
  const ordered = [...current].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.ordinal ?? 0) - (b.ordinal ?? 0));
  const cur = group(ordered);
  const prev = group(previous);
  const exercises: ExerciseBlock[] = [...cur.entries()].map(([occurrenceId, a]) => {
    const exerciseId = a.first.exerciseId;
    const p = prev.get(occurrenceId);
    const priorMax = priorMaxByExercise[exerciseId];
    return {
      exerciseId, occurrenceId,
      name: a.first.name ?? names[exerciseId] ?? "Exercise",
      primaryMuscle: a.first.primaryMuscle ?? muscleByExercise[exerciseId] ?? null,
      sets: a.sets, topSetKg: a.top, volumeKg: a.vol,
      topDeltaKg: p?.top != null && a.top != null ? a.top - p.top : null,
      volumeDeltaKg: p?.vol != null && a.vol != null ? a.vol - p.vol : null,
      isPr: priorMax != null && a.top != null && a.top > priorMax,
    };
  });
  const totalVolumeKg = exercises.reduce((s, e) => s + (e.volumeKg ?? 0), 0);
  const prevTotal = [...prev.values()].reduce((s, a) => s + (a.vol ?? 0), 0);
  const comparable = exercises.some((e) => e.volumeKg != null) && [...prev.values()].some((a) => a.vol != null);
  return {
    totalVolumeKg, totalVolumeDeltaKg: comparable ? totalVolumeKg - prevTotal : null,
    totalSets: current.length, totalReps: current.reduce((s, x) => s + (x.reps ?? 0), 0), exercises,
  };
}
