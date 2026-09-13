// Mirrored from mobile api/planCardio.ts; preserve native run/walk semantics.
import { validateSegments, SessionSegments, SessionType } from './segments';

export interface CardioPrescription {
  targetKind: 'intervals' | 'continuous';
  mode: 'walk' | 'run';
  targetSeconds: number | null;
  guidanceConfig: { warmupWalkSec: number; runSec: number; walkSec: number } | null;
  notes: string | null;
  segments: SessionSegments | null;   // v2: structured session; null = legacy row
  sessionType: SessionType | null;    // v2: easy|long|intervals|tempo|strides|time_trial
}

const SESSION_TYPES = new Set(['easy', 'long', 'intervals', 'tempo', 'strides', 'time_trial']);

/** Maps a raw plan_day_cardio row (snake_case) to a CardioPrescription, or
 *  null when the day has no cardio prescription. Supabase returns an embedded
 *  one-to-one as either an object or a single-element array — handle both. */
export function mapCardioRow(row: unknown): CardioPrescription | null {
  const r = Array.isArray(row) ? row[0] : row;
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const gc = o.guidance_config as
    | { warmupWalkSec: number; runSec: number; walkSec: number }
    | null
    | undefined;
  const st = o.session_type as string | null | undefined;
  return {
    targetKind: o.target_kind as 'intervals' | 'continuous',
    mode: (o.mode as 'walk' | 'run') ?? 'run',
    targetSeconds: (o.target_seconds as number | null) ?? null,
    guidanceConfig: gc ?? null,
    notes: (o.notes as string | null) ?? null,
    segments: validateSegments(o.segments),
    sessionType: st && SESSION_TYPES.has(st) ? (st as SessionType) : null,
  };
}
