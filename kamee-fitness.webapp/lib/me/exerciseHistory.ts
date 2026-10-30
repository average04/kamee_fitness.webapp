import { epley1Rm, isMeasuredLiftingSet, type SetMetrics } from "./oneRepMax";

type SessionTiming = {
  source?: "planned" | "freestyle";
  timestampPrecision?: "instant" | "date";
  startedAt?: string;
};
export type SetWithDate = SetMetrics & SessionTiming & { dateIso: string; sessionId?: string };
export type ExerciseSession = SessionTiming & {
  sessionId: string;
  dateIso: string;
  topSetKg: number | null;
  volumeKg: number | null;
  bestEst1RmKg: number | null;
  reps: number;
  durationSeconds: number;
};

function knownInstant(session: SessionTiming): number | null {
  if (session.timestampPrecision !== "instant" || !session.startedAt) return null;
  const time = Date.parse(session.startedAt);
  return Number.isFinite(time) ? time : null;
}
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
    const e = bySession.get(id) ?? {
      sessionId: id, dateIso: s.dateIso, source: s.source, timestampPrecision: s.timestampPrecision, startedAt: s.startedAt,
      topSetKg: null, volumeKg: null, bestEst1RmKg: null, reps: 0, durationSeconds: 0,
    };
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
  const series = [...bySession.values()].sort((a, b) => {
    const dayOrder = a.dateIso.localeCompare(b.dateIso);
    if (dayOrder) return dayOrder;
    const aTime = knownInstant(a), bTime = knownInstant(b);
    // Date-only sessions have a display position, but their anchors do not establish chronology.
    if (aTime == null || bTime == null) return Number(aTime == null) - Number(bTime == null);
    return aTime - bTime;
  });
  const latestDate = series.at(-1)?.dateIso;
  const latestDay = series.filter((s) => s.dateIso === latestDate);
  let lastWeightKg: number | null = null;
  if (latestDay.length === 1) lastWeightKg = latestDay[0].topSetKg;
  else if (latestDay.length > 1 && latestDay.every((s) => knownInstant(s) != null)) {
    const latest = latestDay.at(-1)!;
    const previous = latestDay.at(-2)!;
    if (knownInstant(latest) !== knownInstant(previous)) lastWeightKg = latest.topSetKg;
  }
  let prKg = 0;
  let prDateIso: string | null = null;
  for (const e of series) {
    if (e.topSetKg != null && e.topSetKg > prKg) { prKg = e.topSetKg; prDateIso = e.dateIso; }
  }
  return {
    series, prKg, prDateIso, timesTrained: series.length,
    bestVolumeKg: series.reduce((m, e) => Math.max(m, e.volumeKg ?? 0), 0),
    lastWeightKg,
    totalReps: series.reduce((sum, s) => sum + s.reps, 0),
  };
}
