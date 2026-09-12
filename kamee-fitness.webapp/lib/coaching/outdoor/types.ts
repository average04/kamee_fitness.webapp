// Mirrored from mobile lib/plans/catalog/types.ts; preserve native run/walk semantics.
import type { SessionSegments, SessionType } from './segments';
type RunningPlanKind = string;

export interface CatalogWorkoutExercise {
  /** exercises.slug — resolved to an id at seed time; unknown slugs abort the seed. */
  slug: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  notes?: string;
}

export interface CatalogWorkoutBlock {
  /** Must be a `block_kind` enum label — the seed inserts it verbatim. */
  kind: 'warmup' | 'main' | 'cooldown' | 'superset' | 'circuit';
  exercises: CatalogWorkoutExercise[];
}

/** A cardio day (structured segments) — the date-pinned, Track-executed kind. */
export interface CatalogCardioDay {
  title: string;
  sessionType: SessionType;
  segments: SessionSegments;
  notes: string;
  workout?: undefined;
}

/** A strength day inside a hybrid plan — pointer-visited, Workout-tab-executed. */
export interface CatalogWorkoutDay {
  title: string;
  workout: { blocks: CatalogWorkoutBlock[] };
  sessionType?: undefined;
  segments?: undefined;
  notes?: undefined;
}

export type CatalogDay = CatalogCardioDay | CatalogWorkoutDay;

export interface CatalogWeek { role: 'build' | 'cutback' | 'taper' | 'goal'; days: CatalogDay[] }
export interface CatalogPlan {
  title: string; summary: string;
  level: 'beginner' | 'intermediate';
  /** Explicit ladder/pool classification, seeded verbatim as `plans.run_kind`
   *  (see `buildCatalogSeedSql`). Required — not optional and not `string` —
   *  so a new catalog entry that omits or typos it fails to compile instead
   *  of seeding `run_kind = null` and silently falling through to the
   *  title-keyword fallback in `classifyRunningPlan`, where it matches
   *  nothing and becomes unrecommendable. */
  runKind: RunningPlanKind;
  /** SCHEDULABLE cardio days per week (what the enrollment picker asks for);
   *  hybrid plans' workout days float outside the weekly calendar. */
  daysPerWeek: 3 | 4;
  estMinutesPerSession: number;
  weeksCount: number;
  weeks: CatalogWeek[];
}
