// Mirrored from mobile lib/track/guidance/cueTimeline.ts; preserve native run/walk semantics.
import { flattenSegments, SegmentLeaf, SessionSegments } from './segments';
import type { GuidancePlan } from './plans';

export interface CueEvent { atSecond: number; text: string }

function minutesPhrase(seconds: number): string {
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    return m === 1 ? '1 minute' : `${m} minutes`;
  }
  return `${seconds} seconds`;
}

/** Coaching language for a work leaf's effort — spoken at the leaf start so
 *  the runner hears HOW the block should feel, not just how long it is
 *  (mirrors the catalog day notes the screen shows). */
const RUN_EFFORT_PHRASE: Record<SegmentLeaf['effort'], string> = {
  easy: 'easy and conversational — you could chat',
  steady: 'steady — comfortably hard, short sentences',
  hard: 'hard — push it, a few words at a time',
};
const WALK_EFFORT_PHRASE: Record<SegmentLeaf['effort'], string> = {
  easy: 'easy and relaxed',
  steady: 'brisk — you can talk, but not sing',
  hard: 'power pace — arms driving',
};

const HALFWAY_PHRASE: Record<SegmentLeaf['effort'], string> = {
  easy: 'Halfway — keep it relaxed',
  steady: 'Halfway — hold the rhythm',
  hard: 'Halfway — stay strong',
};

/** Halfway / five-minutes-left marks only make sense on genuinely long
 *  leaves. The five-left floor is 660 (not 600) so the two marks are always
 *  ≥30s apart — at exactly 600 they would collide at the same second. */
const MARK_MIN_LEAF_SEC = 600;
const FIVE_LEFT_MIN_LEAF_SEC = 660;
/** Transition heads-up ("Coming up: …") fires this long before a leaf ends —
 *  but never out of a leaf shorter than the floor (a 20s stride would get its
 *  heads-up 5s after it started; pure noise). */
const HEADSUP_BEFORE_SEC = 15;
const HEADSUP_MIN_LEAF_SEC = 60;

function leafCue(leaf: SegmentLeaf): string {
  if (leaf.cue) return leaf.cue;
  const dur = minutesPhrase(leaf.seconds);
  switch (leaf.role) {
    case 'warmup':   return `Warm up — ${dur} easy walk`;
    case 'cooldown': return `Cool down — ${dur} easy walk`;
    case 'recover':  return leaf.mode === 'walk' ? `Recover — walk ${dur}` : `Recover — easy ${dur}`;
    default:
      return leaf.mode === 'run'
        ? `Run — ${dur}, ${RUN_EFFORT_PHRASE[leaf.effort]}`
        : `Walk — ${dur}, ${WALK_EFFORT_PHRASE[leaf.effort]}`;
  }
}

/** Short spoken name for a leaf in the "Coming up: …" heads-up. */
function headsUpLabel(leaf: SegmentLeaf): string {
  switch (leaf.role) {
    case 'warmup':   return 'warm-up walk';
    case 'cooldown': return 'cool-down walk';
    case 'recover':  return leaf.mode === 'walk' ? 'recovery walk' : 'easy recovery jog';
    default:
      return leaf.mode === 'run'
        ? `${leaf.effort} run`
        : leaf.effort === 'hard' ? 'power walk' : leaf.effort === 'steady' ? 'brisk walk' : 'easy walk';
  }
}

/** Voice-cue schedule for a structured session. Native side is a dumb timed
 *  player: speak text when session-elapsed crosses atSecond. Beyond the leaf
 *  start cues this also emits, per leaf: a halfway + five-minutes-left mark
 *  (long leaves only, so a 25-minute easy run isn't 25 silent minutes) and a
 *  "Coming up: …" heads-up shortly before each transition. */
export function buildCueTimeline(segments: SessionSegments): CueEvent[] {
  const leaves = flattenSegments(segments);
  const out: CueEvent[] = [];
  let at = 0;
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    out.push({ atSecond: at, text: leafCue(leaf) });
    if (leaf.seconds >= MARK_MIN_LEAF_SEC) {
      out.push({ atSecond: at + leaf.seconds / 2, text: HALFWAY_PHRASE[leaf.effort] });
    }
    if (leaf.seconds >= FIVE_LEFT_MIN_LEAF_SEC) {
      out.push({ atSecond: at + leaf.seconds - 300, text: 'Five minutes left' });
    }
    const next = leaves[i + 1];
    if (next && leaf.seconds >= HEADSUP_MIN_LEAF_SEC) {
      out.push({
        atSecond: at + leaf.seconds - HEADSUP_BEFORE_SEC,
        text: `Coming up: ${headsUpLabel(next)}`,
      });
    }
    at += leaf.seconds;
  }
  out.push({ atSecond: at, text: 'Workout complete — keep going or finish up' });
  // Marks/heads-ups interleave with later leaf starts — the native players
  // expect (and re-sort defensively into) ascending order.
  return out.sort((a, b) => a.atSecond - b.atSecond);
}

/** Strict structural flatten to the legacy {warmup, run, walk} repeating
 *  shape for binaries that predate the cue timeline. Returns the legacy plan
 *  ONLY when the segment list is, in order: zero or more warmup leaves, then
 *  exactly one repeat group whose body is exactly [run leaf, walk leaf],
 *  then zero or more cooldown leaves — nothing else. Any other shape
 *  (extra work leaves, multiple repeat groups, wrong body shape, ...)
 *  returns null so old binaries fall back to on-screen guidance only rather
 *  than voicing a wrong session shape. */
export function compileToLegacyGuidance(segments: SessionSegments): GuidancePlan | null {
  let i = 0;
  let warmupWalkSec = 0;
  while (i < segments.length) {
    const seg = segments[i]!;
    if ('role' in seg && seg.role === 'warmup') { warmupWalkSec += seg.seconds; i++; continue; }
    break;
  }

  const repeatSeg = segments[i];
  if (!repeatSeg || !('repeat' in repeatSeg) || 'role' in repeatSeg || repeatSeg.of.length !== 2) return null;
  const [a, b] = repeatSeg.of;
  if (a!.mode !== 'run' || b!.mode !== 'walk') return null;
  const runSec = a!.seconds;
  const walkSec = b!.seconds;
  i++;

  while (i < segments.length) {
    const seg = segments[i]!;
    if ('role' in seg && seg.role === 'cooldown') { i++; continue; }
    break;
  }

  if (i !== segments.length) return null;
  return { id: 'program-legacy', name: 'Program', warmupWalkSec, runSec, walkSec };
}
