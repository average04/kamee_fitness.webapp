// Mirrored from mobile lib/plans/catalog/sessions.ts; preserve native run/walk semantics.
import type { Segment, SegmentLeaf } from './segments';
import type {
  CatalogCardioDay,
  CatalogWorkoutBlock,
  CatalogWorkoutDay,
  CatalogWorkoutExercise,
} from './types';

export const wu = (sec = 300): SegmentLeaf => ({ role: 'warmup', mode: 'walk', seconds: sec, effort: 'easy' });
export const cd = (sec = 300): SegmentLeaf => ({ role: 'cooldown', mode: 'walk', seconds: sec, effort: 'easy' });
const runLeaf = (seconds: number, effort: SegmentLeaf['effort']): SegmentLeaf => ({ role: 'work', mode: 'run', seconds, effort });
const recoverWalk = (seconds: number): SegmentLeaf => ({ role: 'recover', mode: 'walk', seconds, effort: 'easy' });
const rep = (repeat: number, of: SegmentLeaf[]): Segment => ({ repeat, of });

export function easyRun(min: number, title = 'Easy run'): CatalogCardioDay {
  return { title, sessionType: 'easy', segments: [wu(), runLeaf(min * 60, 'easy'), cd()],
    notes: `${min}-min easy run — conversational, you could chat` };
}

export function longRun(min: number): CatalogCardioDay {
  return { title: 'Long run', sessionType: 'long', segments: [wu(), runLeaf(min * 60, 'easy'), cd()],
    notes: `${min}-min long run — keep it easy, this builds endurance` };
}

export function runWalk(title: string, reps: number, runSec: number, walkSec: number): CatalogCardioDay {
  const rMin = Math.round(runSec / 60 * 10) / 10, wMin = Math.round(walkSec / 60 * 10) / 10;
  return { title, sessionType: 'intervals',
    segments: [wu(), rep(reps, [runLeaf(runSec, 'steady'), recoverWalk(walkSec)]), cd()],
    notes: `${reps} × (${rMin}-min run / ${wMin}-min walk) — steady, short sentences` };
}

export function strides(baseMin: number): CatalogCardioDay {
  return { title: 'Easy + strides', sessionType: 'strides',
    segments: [wu(), runLeaf(baseMin * 60, 'easy'), rep(4, [runLeaf(20, 'hard'), recoverWalk(60)]), cd()],
    notes: `${baseMin}-min easy, then 4 × 20-sec fast strides with full walk-back recovery` };
}

export function intervals(reps: number, workSec: number, recSec: number): CatalogCardioDay {
  // M:SS, not `Math.round(workSec / 60)` + a literal ':00'. The plan builder
  // feeds this anything from 10 s to 1800 s, where rounding printed "2:00" for
  // 90 s and "0:00" for 20 s. Byte-identical for every catalog call site —
  // they all pass whole minutes (120/180/240).
  const w = `${Math.floor(workSec / 60)}:${String(workSec % 60).padStart(2, '0')}`;
  return { title: 'Intervals', sessionType: 'intervals',
    segments: [wu(), runLeaf(600, 'easy'), rep(reps, [runLeaf(workSec, 'hard'), recoverWalk(recSec)]), cd()],
    notes: `10-min easy, then ${reps} × ${w} hard (RPE 7–8) with walk recovery` };
}

export function tempo(easyMin: number, steadyMin: number): CatalogCardioDay {
  return { title: 'Tempo run', sessionType: 'tempo',
    segments: [wu(), runLeaf(easyMin * 60, 'easy'), runLeaf(steadyMin * 60, 'steady'), runLeaf(easyMin * 60, 'easy'), cd()],
    notes: `${easyMin} easy / ${steadyMin} steady (RPE 5–6) / ${easyMin} easy` };
}

export function timeTrial(min: number, title: string, notes: string): CatalogCardioDay {
  return { title, sessionType: 'time_trial', segments: [wu(), runLeaf(min * 60, 'steady'), cd()], notes };
}

export function shakeout(min: number): CatalogCardioDay {
  return { ...easyRun(min, 'Shakeout run'), notes: `${min}-min very easy shakeout — save your legs` };
}

// ---- Walking sessions (Outdoor discipline, walk mode throughout) ----------

const walkLeaf = (seconds: number, effort: SegmentLeaf['effort']): SegmentLeaf => ({
  role: 'work',
  mode: 'walk',
  seconds,
  effort,
});

export function easyWalk(min: number, title = 'Easy walk'): CatalogCardioDay {
  return {
    title,
    sessionType: 'easy',
    segments: [wu(), walkLeaf(min * 60, 'easy'), cd()],
    notes: `${min}-min easy walk — comfortable, unhurried`,
  };
}

export function briskWalk(min: number, title = 'Brisk walk'): CatalogCardioDay {
  return {
    title,
    sessionType: 'easy',
    segments: [wu(), walkLeaf(min * 60, 'steady'), cd()],
    notes: `${min}-min brisk walk — you can talk, but not sing`,
  };
}

export function longWalk(min: number): CatalogCardioDay {
  return {
    title: 'Long walk',
    sessionType: 'long',
    segments: [wu(), walkLeaf(min * 60, 'easy'), cd()],
    notes: `${min}-min long walk — easy pace, time on feet is the win`,
  };
}

export function walkIntervals(reps: number, fastSec: number, easySec: number): CatalogCardioDay {
  // Deliberately NOT switched to `intervals`' M:SS above: shipped catalog plans
  // call this with 90 s (wave2's power-walk weeks), which prints "1.5-min"
  // today and would become "1:30" — a live text change to plans already in
  // users' hands. Sub-minute builder values still read oddly here ("0.2-min");
  // parked rather than rewriting shipped copy.
  const fMin = Math.round((fastSec / 60) * 10) / 10;
  return {
    title: 'Power intervals',
    sessionType: 'intervals',
    segments: [
      wu(),
      walkLeaf(600, 'steady'),
      rep(reps, [walkLeaf(fastSec, 'hard'), recoverWalk(easySec)]),
      cd(),
    ],
    notes: `10-min brisk, then ${reps} × ${fMin}-min power walk with easy recovery`,
  };
}

export function timeTrialWalk(min: number, title: string, notes: string): CatalogCardioDay {
  return { title, sessionType: 'time_trial', segments: [wu(), walkLeaf(min * 60, 'steady'), cd()], notes };
}

// ---- Hybrid strength days (pointer-visited, Workout-tab-executed) ---------

export function exercise(
  slug: string,
  sets: number,
  reps: string,
  restSeconds = 60,
  notes?: string,
): CatalogWorkoutExercise {
  return { slug, sets, reps, restSeconds, ...(notes ? { notes } : {}) };
}

export function workoutDay(title: string, blocks: CatalogWorkoutBlock[]): CatalogWorkoutDay {
  return { title, workout: { blocks } };
}
