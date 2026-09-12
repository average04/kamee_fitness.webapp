// Mirrored from mobile lib/track/guidance/plans.ts; preserve native run/walk semantics.
/** A run/walk interval plan: an optional warm-up walk, then [run, walk]
 *  repeating until the session ends. */
export interface GuidancePlan {
  id: string;
  name: string;
  warmupWalkSec: number; // 0 = no warm-up
  runSec: number;
  walkSec: number;
}

export type GuidancePhase = 'warmup' | 'run' | 'walk';

export interface GuidancePhaseState {
  phase: GuidancePhase;
  secondsLeftInPhase: number;
  /** Session-elapsed second at which the current phase ends. */
  nextBoundaryAt: number;
}

/** Ordered progression of built-in presets (the "templates"). The user steps
 *  up to a harder one as they improve — no auto-progression. */
export const GUIDANCE_PRESETS: GuidancePlan[] = [
  { id: 'ease-in', name: 'Ease-in', warmupWalkSec: 300, runSec: 60, walkSec: 120 },
  { id: 'steady', name: 'Steady', warmupWalkSec: 300, runSec: 120, walkSec: 120 },
  { id: 'build', name: 'Build', warmupWalkSec: 300, runSec: 180, walkSec: 90 },
  { id: 'push', name: 'Push', warmupWalkSec: 300, runSec: 300, walkSec: 60 },
];

/** Defaults for the user's custom plan. */
export const DEFAULT_CUSTOM = { warmupWalkSec: 300, runSec: 60, walkSec: 120 };

/**
 * Which phase a plan is in at `elapsedSec` (pause-aware session elapsed, NOT
 * wall-clock). Pure: the single source of truth for both the on-screen pill
 * and the native cue timing (the Swift side mirrors this rule).
 */
export function phaseAt(plan: GuidancePlan, elapsedSec: number): GuidancePhaseState {
  const e = Math.max(0, elapsedSec);

  if (e < plan.warmupWalkSec) {
    return { phase: 'warmup', secondsLeftInPhase: plan.warmupWalkSec - e, nextBoundaryAt: plan.warmupWalkSec };
  }

  const cycle = plan.runSec + plan.walkSec;
  if (cycle <= 0) {
    return { phase: 'walk', secondsLeftInPhase: Infinity, nextBoundaryAt: Infinity };
  }

  const since = e - plan.warmupWalkSec;
  const cyclesDone = Math.floor(since / cycle);
  const pos = since - cyclesDone * cycle;
  const cycleStart = plan.warmupWalkSec + cyclesDone * cycle;

  if (pos < plan.runSec) {
    return { phase: 'run', secondsLeftInPhase: plan.runSec - pos, nextBoundaryAt: cycleStart + plan.runSec };
  }
  return { phase: 'walk', secondsLeftInPhase: cycle - pos, nextBoundaryAt: cycleStart + cycle };
}
