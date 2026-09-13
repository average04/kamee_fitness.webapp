// Mirrored from mobile lib/plans/runDayForm.ts; preserve native run/walk semantics.
import type { CardioPrescription } from './planCardio';
type DayKind = 'workout' | 'rest' | 'active_recovery' | 'run' | 'hybrid';
type Discipline = 'strength' | 'running';
import {
  briskWalk,
  easyRun,
  easyWalk,
  intervals,
  longRun,
  longWalk,
  runWalk,
  strides,
  tempo,
  timeTrial,
  timeTrialWalk,
  walkIntervals,
} from './sessions';
import type { CatalogCardioDay } from './types';
import { compileToLegacyGuidance } from './cueTimeline';
import {
  flattenSegments,
  sessionTotalSeconds,
  type Segment,
  type SegmentLeaf,
  type SessionSegments,
  type SessionType,
} from './segments';

/** Builder-level session kinds. Walk kinds are separate entries (not a mode
 *  flag) so the params ↔ segments mapping stays 1:1 with the catalog
 *  constructors and `parseRunDayCardio` can be deterministic. */
export type RunDayKind =
  | 'easy'
  | 'long'
  | 'run_walk'
  | 'intervals'
  | 'tempo'
  | 'strides'
  | 'time_trial'
  | 'easy_walk'
  | 'brisk_walk'
  | 'long_walk'
  | 'walk_intervals'
  | 'time_trial_walk';

export type RunDayParams =
  | { kind: 'easy'; minutes: number }
  | { kind: 'long'; minutes: number }
  | { kind: 'run_walk'; reps: number; runSec: number; walkSec: number }
  | { kind: 'intervals'; reps: number; workSec: number; recoverSec: number }
  | { kind: 'tempo'; easyMin: number; steadyMin: number }
  | { kind: 'strides'; baseMin: number }
  | { kind: 'time_trial'; minutes: number }
  | { kind: 'easy_walk'; minutes: number }
  | { kind: 'brisk_walk'; minutes: number }
  | { kind: 'long_walk'; minutes: number }
  | { kind: 'walk_intervals'; reps: number; fastSec: number; easySec: number }
  | { kind: 'time_trial_walk'; minutes: number };

/** Camel-case mirror of a `plan_day_cardio` row, as `createPlan` inserts it —
 *  an alias of the API's `CardioPrescription` rather than a re-declaration, so
 *  the draft and read shapes can never drift. Nullable `segments`/`sessionType`
 *  let an unparseable saved row round-trip through edit untouched;
 *  `buildRunDayCardio` always sets both. */
export type DraftCardio = CardioPrescription;

export interface BuiltRunDay {
  title: string;
  cardio: DraftCardio;
}

function catalogDayFor(params: RunDayParams): CatalogCardioDay {
  switch (params.kind) {
    case 'easy':
      return easyRun(params.minutes);
    case 'long':
      return longRun(params.minutes);
    case 'run_walk':
      return runWalk('Run/Walk', params.reps, params.runSec, params.walkSec);
    case 'intervals':
      return intervals(params.reps, params.workSec, params.recoverSec);
    case 'tempo':
      return tempo(params.easyMin, params.steadyMin);
    case 'strides':
      return strides(params.baseMin);
    case 'time_trial':
      return timeTrial(
        params.minutes,
        'Time trial',
        `${params.minutes}-min time trial — steady, strong effort`,
      );
    case 'easy_walk':
      return easyWalk(params.minutes);
    case 'brisk_walk':
      return briskWalk(params.minutes);
    case 'long_walk':
      return longWalk(params.minutes);
    case 'walk_intervals':
      return walkIntervals(params.reps, params.fastSec, params.easySec);
    case 'time_trial_walk':
      return timeTrialWalk(
        params.minutes,
        'Time trial walk',
        `${params.minutes}-min time trial walk — steady, strong effort`,
      );
  }
}

/** Prescription mode for a session: 'walk' when every work leaf walks.
 *  Mirrors `dayMode` in `catalog/seedSql.ts`. */
function sessionMode(segments: SessionSegments): 'walk' | 'run' {
  const work = flattenSegments(segments).filter((l) => l.role === 'work');
  return work.length > 0 && work.every((l) => l.mode === 'walk') ? 'walk' : 'run';
}

/** Build the full cardio prescription for a parameterized run day — the exact
 *  row shape the catalog seeds (`seedSql.ts` lines 80-84): `target_kind` is
 *  'intervals' only when the legacy compile succeeds, guidance_config is the
 *  stripped 3-field object, target_seconds is the session total. */
export function buildRunDayCardio(params: RunDayParams): BuiltRunDay {
  const day = catalogDayFor(params);
  const legacy = compileToLegacyGuidance(day.segments);
  return {
    title: day.title,
    cardio: {
      targetKind: legacy ? 'intervals' : 'continuous',
      mode: sessionMode(day.segments),
      targetSeconds: sessionTotalSeconds(day.segments),
      guidanceConfig: legacy
        ? { warmupWalkSec: legacy.warmupWalkSec, runSec: legacy.runSec, walkSec: legacy.walkSec }
        : null,
      notes: day.notes,
      segments: day.segments,
      sessionType: day.sessionType,
    },
  };
}

type RepeatGroup = { repeat: number; of: SegmentLeaf[] };
const isLeaf = (s: Segment): s is SegmentLeaf => 'role' in s;
const isGroup = (s: Segment): s is RepeatGroup => !('role' in s);

function leavesEqual(a: SegmentLeaf, b: SegmentLeaf): boolean {
  return (
    a.role === b.role &&
    a.mode === b.mode &&
    a.seconds === b.seconds &&
    a.effort === b.effort &&
    // A cue-carrying leaf is a different session from a bare one. Normalize a
    // jsonb `null` back to undefined so a stored no-cue leaf still matches.
    (a.cue ?? undefined) === (b.cue ?? undefined)
  );
}

/** Structural deep-equal over the segment tree. Deliberately NOT
 *  `JSON.stringify` equality: saved rows come back from Postgres `jsonb`,
 *  which does not preserve object key order, so a stringify compare would
 *  reject every real row and silently downgrade all edit-mode seeding. */
function segmentsEqual(a: SessionSegments, b: SessionSegments): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (isLeaf(x)) {
      if (!isLeaf(y) || !leavesEqual(x, y)) return false;
    } else {
      if (isLeaf(y)) return false;
      if (x.repeat !== y.repeat || x.of.length !== y.of.length) return false;
      for (let j = 0; j < x.of.length; j++) {
        if (!leavesEqual(x.of[j]!, y.of[j]!)) return false;
      }
    }
  }
  return true;
}

/** Compile-time exhaustiveness over `SessionType` — a 7th member stops
 *  compiling here. Still returns null at runtime: `session_type` reaches us as
 *  unvalidated text on legacy rows. */
function unknownSessionType(_exhaustive: never): null {
  return null;
}

/** Best guess at the params from the session's shape alone. Structural only,
 *  and deliberately lenient — `parseRunDayCardio` verifies by reconstruction
 *  before trusting anything this returns. */
function candidateParams(sessionType: SessionType, segments: SessionSegments): RunDayParams | null {
  const groups = segments.filter(isGroup);
  // Top-level leaves that carry the session's structure (not warmup/cooldown).
  const mains = segments
    .filter(isLeaf)
    .filter((l) => l.role !== 'warmup' && l.role !== 'cooldown');

  switch (sessionType) {
    case 'easy': {
      if (groups.length > 0 || mains.length !== 1 || mains[0]!.role !== 'work') return null;
      const main = mains[0]!;
      const minutes = main.seconds / 60;
      if (main.mode === 'walk') {
        return main.effort === 'steady'
          ? { kind: 'brisk_walk', minutes }
          : { kind: 'easy_walk', minutes };
      }
      return { kind: 'easy', minutes };
    }

    case 'long': {
      if (groups.length > 0 || mains.length !== 1 || mains[0]!.role !== 'work') return null;
      const main = mains[0]!;
      return { kind: main.mode === 'walk' ? 'long_walk' : 'long', minutes: main.seconds / 60 };
    }

    case 'intervals': {
      if (groups.length !== 1) return null;
      const g = groups[0]!;
      if (g.of.length !== 2) return null;
      const work = g.of.find((l) => l.role === 'work');
      const recover = g.of.find((l) => l.role === 'recover');
      if (!work || !recover) return null;
      if (work.mode === 'walk') {
        // walkIntervals: one steady walk work leaf before the repeat group.
        if (mains.length !== 1 || mains[0]!.mode !== 'walk') return null;
        return {
          kind: 'walk_intervals',
          reps: g.repeat,
          fastSec: work.seconds,
          easySec: recover.seconds,
        };
      }
      // runWalk has no pre-repeat leaf; hard intervals have one easy run leaf.
      if (mains.length === 0) {
        return { kind: 'run_walk', reps: g.repeat, runSec: work.seconds, walkSec: recover.seconds };
      }
      if (mains.length === 1 && mains[0]!.mode === 'run') {
        return {
          kind: 'intervals',
          reps: g.repeat,
          workSec: work.seconds,
          recoverSec: recover.seconds,
        };
      }
      return null;
    }

    case 'tempo': {
      if (groups.length > 0 || mains.length !== 3) return null;
      if (mains.some((l) => l.mode !== 'run')) return null;
      const [a, b, c] = mains;
      if (a!.seconds !== c!.seconds) return null;
      return { kind: 'tempo', easyMin: a!.seconds / 60, steadyMin: b!.seconds / 60 };
    }

    case 'strides': {
      if (groups.length !== 1 || mains.length !== 1 || mains[0]!.mode !== 'run') return null;
      return { kind: 'strides', baseMin: mains[0]!.seconds / 60 };
    }

    case 'time_trial': {
      if (groups.length > 0 || mains.length !== 1 || mains[0]!.role !== 'work') return null;
      const main = mains[0]!;
      return {
        kind: main.mode === 'walk' ? 'time_trial_walk' : 'time_trial',
        minutes: main.seconds / 60,
      };
    }

    default:
      return unknownSessionType(sessionType);
  }
}

/**
 * Inverse of `buildRunDayCardio`: recover the builder params from a saved
 * cardio row. Returns null for any shape this builder does not author
 * (legacy rows without segments, hand-tuned catalog shapes, etc.) — callers
 * must then preserve the row verbatim rather than rebuild it.
 *
 * A shape match alone is necessary but NOT sufficient: it ignores everything a
 * rebuild would regenerate — leg efforts, warmup/cooldown lengths, the 600s
 * intervals lead-in, per-leaf cues, the exact strides group. So the candidate
 * is verified by reconstruction: we rebuild from it and require the segments to
 * match structurally. Anything this builder cannot reproduce exactly is
 * rejected, which is what makes a later rebuild non-destructive.
 */
export function parseRunDayCardio(cardio: {
  sessionType: SessionType | null;
  segments: SessionSegments | null;
}): RunDayParams | null {
  const { sessionType, segments } = cardio;
  if (!sessionType || !segments) return null;

  const candidate = candidateParams(sessionType, segments);
  if (!candidate) return null;
  return segmentsEqual(catalogDayFor(candidate).segments, segments) ? candidate : null;
}

export interface PlanDisciplineMeta {
  discipline: Discipline;
  hasWorkouts: boolean;
  daysPerWeek: number | null;
}

/**
 * Plan-level columns derived from the composed days (post-normalization —
 * workout days without exercises arrive as 'rest'). `daysPerWeek` counts
 * CARDIO days only, mirroring the catalog's semantics: hybrid workout days
 * float outside the weekly run calendar (`catalog/types.ts`). Strength plans
 * keep `null`, matching every custom plan authored before this feature.
 */
export function derivePlanDisciplineMeta(
  days: { dayKind: DayKind; exerciseCount: number }[],
): PlanDisciplineMeta {
  const hasWorkouts = days.some((d) => d.dayKind === 'workout' && d.exerciseCount > 0);
  const runCount = days.filter((d) => d.dayKind === 'run').length;
  if (runCount === 0) return { discipline: 'strength', hasWorkouts, daysPerWeek: null };
  const weeks = Math.max(1, Math.ceil(days.length / 7));
  const avg = Math.round(runCount / weeks);
  return {
    discipline: 'running',
    hasWorkouts,
    daysPerWeek: Math.min(7, Math.max(1, avg)),
  };
}
