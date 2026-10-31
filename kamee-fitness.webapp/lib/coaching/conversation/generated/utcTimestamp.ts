// Generated from src/lib/coaching/utcTimestamp.ts; run the app sync-coaching-conversation-client script. Do not edit.
const UTC_RFC3339 = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.([0-9]+))?(?:Z|\+00:00)$/;

export type Timestamp = { wholeMs: number; fraction: string; floorMs: number; ceilMs: number };

export function parseTimestamp(value: unknown): Timestamp | null {
  if (typeof value !== 'string') return null;
  const match = value.match(UTC_RFC3339);
  if (!match || match[0] !== value) return null;
  const whole = match[1]!;
  const wholeMs = Date.parse(`${whole}Z`);
  // Date.parse normalizes some impossible dates and 24:00:00; reject those round trips.
  if (!Number.isFinite(wholeMs) || new Date(wholeMs).toISOString().slice(0, 19) !== whole)
    return null;
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  const floorMs = wholeMs + Number((fraction + '000').slice(0, 3));
  const ceilMs = floorMs + (fraction.length > 3 ? 1 : 0);
  return { wholeMs, fraction, floorMs, ceilMs };
}

export function compareTimestamp(
  a: Pick<Timestamp, 'wholeMs' | 'fraction'>,
  b: Pick<Timestamp, 'wholeMs' | 'fraction'>,
): number {
  if (a.wholeMs !== b.wholeMs) return a.wholeMs < b.wholeMs ? -1 : 1;
  // Preserve all server fractional precision for chronology and authorization caps.
  const precision = Math.max(a.fraction.length, b.fraction.length);
  const left = a.fraction.padEnd(precision, '0');
  const right = b.fraction.padEnd(precision, '0');
  return left === right ? 0 : left < right ? -1 : 1;
}
