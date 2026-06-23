import { epley1Rm } from "./oneRepMax";

export type RecordSet = {
  exerciseId: string;
  name: string;
  dateIso: string;
  reps: number;
  weightKg: number;
};

export type ExerciseRecord = {
  exerciseId: string;
  name: string;
  prKg: number;
  prDateIso: string | null;
  est1RmKg: number;
  timesTrained: number;
  lastDoneIso: string | null;
};

export function buildRecords(sets: RecordSet[]): ExerciseRecord[] {
  const byEx = new Map<
    string,
    {
      name: string;
      prKg: number;
      prDateIso: string | null;
      est1RmKg: number;
      dates: Set<string>;
      lastDoneIso: string | null;
    }
  >();
  for (const s of sets) {
    const r =
      byEx.get(s.exerciseId) ??
      {
        name: s.name,
        prKg: 0,
        prDateIso: null,
        est1RmKg: 0,
        dates: new Set<string>(),
        lastDoneIso: null,
      };
    r.name = s.name;
    r.dates.add(s.dateIso);
    if (r.lastDoneIso == null || s.dateIso > r.lastDoneIso) r.lastDoneIso = s.dateIso;
    if (s.weightKg > 0) {
      if (s.weightKg > r.prKg) {
        r.prKg = s.weightKg;
        r.prDateIso = s.dateIso;
      }
      r.est1RmKg = Math.max(r.est1RmKg, epley1Rm(s.weightKg, s.reps));
    }
    byEx.set(s.exerciseId, r);
  }
  return [...byEx.entries()]
    .map(([exerciseId, r]) => ({
      exerciseId,
      name: r.name,
      prKg: r.prKg,
      prDateIso: r.prDateIso,
      est1RmKg: r.est1RmKg,
      timesTrained: r.dates.size,
      lastDoneIso: r.lastDoneIso,
    }))
    .sort((a, b) => b.prKg - a.prKg);
}
