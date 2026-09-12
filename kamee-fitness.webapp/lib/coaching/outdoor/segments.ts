// Mirrored from mobile lib/track/guidance/segments.ts; preserve native run/walk semantics.
/** Structured session model (plan engine v2). A session is an ordered list of
 *  segments: leaves (one timed block) or repeat groups. Finite — unlike the
 *  legacy GuidancePlan cycle, a session ends after its last leaf. */

export type Effort = 'easy' | 'steady' | 'hard';
export type SessionType = 'easy' | 'long' | 'intervals' | 'tempo' | 'strides' | 'time_trial';

export interface SegmentLeaf {
  role: 'warmup' | 'work' | 'recover' | 'cooldown';
  mode: 'run' | 'walk';
  seconds: number;
  effort: Effort;
  cue?: string; // optional voice-cue text override
}

export type Segment = SegmentLeaf | { repeat: number; of: SegmentLeaf[] };
export type SessionSegments = Segment[];

const ROLES = new Set(['warmup', 'work', 'recover', 'cooldown']);
const MODES = new Set(['run', 'walk']);
const EFFORTS = new Set(['easy', 'steady', 'hard']);

function isLeaf(v: unknown): v is SegmentLeaf {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    ROLES.has(o.role as string) &&
    MODES.has(o.mode as string) &&
    typeof o.seconds === 'number' &&
    Number.isFinite(o.seconds) &&
    EFFORTS.has(o.effort as string) &&
    (o.cue === undefined || typeof o.cue === 'string')
  );
}

export function validateSegments(value: unknown): SessionSegments | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const seg of value) {
    if (isLeaf(seg)) continue;
    if (!seg || typeof seg !== 'object') return null;
    const g = seg as { repeat?: unknown; of?: unknown };
    if (typeof g.repeat !== 'number' || g.repeat < 1) return null;
    if (!Array.isArray(g.of) || g.of.length === 0 || !g.of.every(isLeaf)) return null;
  }
  return value as SessionSegments;
}

export function flattenSegments(segments: SessionSegments): SegmentLeaf[] {
  const out: SegmentLeaf[] = [];
  for (const seg of segments) {
    if ('repeat' in seg && !('role' in seg)) {
      for (let i = 0; i < seg.repeat; i++) {
        for (const leaf of seg.of) if (leaf.seconds > 0) out.push(leaf);
      }
    } else if ((seg as SegmentLeaf).seconds > 0) {
      out.push(seg as SegmentLeaf);
    }
  }
  return out;
}

export function sessionTotalSeconds(segments: SessionSegments): number {
  return flattenSegments(segments).reduce((sum, l) => sum + l.seconds, 0);
}

export interface SegmentPhase {
  leaf: SegmentLeaf | null;
  index: number;               // index into flattenSegments(); -1 when done
  secondsLeftInLeaf: number;   // 0 when done
  nextBoundaryAt: number;      // session-elapsed sec when the current leaf ends; Infinity when done
  nextLeaf: SegmentLeaf | null;
  done: boolean;               // open state: past the last leaf
}

/** Which leaf a structured session is in at `elapsedSec` (pause-aware session
 *  elapsed, NOT wall clock). Single source of truth for the on-screen pill
 *  and the cue timeline. Finite: past the end returns done=true. */
export function segmentAt(segments: SessionSegments, elapsedSec: number): SegmentPhase {
  const leaves = flattenSegments(segments);
  const e = Math.max(0, elapsedSec);
  let start = 0;
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    const end = start + leaf.seconds;
    if (e < end) {
      return {
        leaf, index: i,
        secondsLeftInLeaf: end - e,
        nextBoundaryAt: end,
        nextLeaf: leaves[i + 1] ?? null,
        done: false,
      };
    }
    start = end;
  }
  return { leaf: null, index: -1, secondsLeftInLeaf: 0, nextBoundaryAt: Infinity, nextLeaf: null, done: true };
}
