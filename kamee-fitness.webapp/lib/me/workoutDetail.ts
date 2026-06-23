export type SetWithExercise = {
  exerciseId: string;
  reps: number;
  weightKg: number;
};

export type ExerciseBlock = {
  exerciseId: string;
  name: string;
  primaryMuscle: string | null;
  sets: { reps: number; weightKg: number }[];
  topSetKg: number;
  volumeKg: number;
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

type Agg = { sets: { reps: number; weightKg: number }[]; top: number; vol: number };

function group(sets: SetWithExercise[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const s of sets) {
    const a = m.get(s.exerciseId) ?? { sets: [], top: 0, vol: 0 };
    a.sets.push({ reps: s.reps, weightKg: s.weightKg });
    a.top = Math.max(a.top, s.weightKg);
    a.vol += s.reps * s.weightKg;
    m.set(s.exerciseId, a);
  }
  return m;
}

export function summarizeWorkoutDetail(
  current: SetWithExercise[],
  previous: SetWithExercise[],
  names: Record<string, string>,
  priorMaxByExercise: Record<string, number>,
  muscleByExercise: Record<string, string>,
): WorkoutDetailSummary {
  const cur = group(current);
  const prev = group(previous);
  const hasPrev = previous.length > 0;

  const exercises: ExerciseBlock[] = [...cur.entries()].map(([exerciseId, a]) => {
    const p = prev.get(exerciseId);
    const priorMax = priorMaxByExercise[exerciseId];
    return {
      exerciseId,
      name: names[exerciseId] ?? "Exercise",
      primaryMuscle: muscleByExercise[exerciseId] ?? null,
      sets: a.sets,
      topSetKg: a.top,
      volumeKg: a.vol,
      topDeltaKg: p ? a.top - p.top : null,
      volumeDeltaKg: p ? a.vol - p.vol : null,
      isPr: priorMax != null && a.top > priorMax,
    };
  });
  exercises.sort((x, y) => y.volumeKg - x.volumeKg);

  const totalVolumeKg = exercises.reduce((s, e) => s + e.volumeKg, 0);
  const prevTotal = [...prev.values()].reduce((s, a) => s + a.vol, 0);
  const totalSets = current.length;
  const totalReps = current.reduce((s, x) => s + x.reps, 0);
  return {
    totalVolumeKg,
    totalVolumeDeltaKg: hasPrev ? totalVolumeKg - prevTotal : null,
    totalSets,
    totalReps,
    exercises,
  };
}
