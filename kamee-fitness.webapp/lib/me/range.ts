export type Range = "week" | "month" | "all" | "custom";

export function parseRange(value: string | undefined | null): Range {
  return value === "week" || value === "month" || value === "custom"
    ? value
    : "all";
}

/** An inclusive time window. `null` bound = open-ended on that side. */
export type DateWindow = { startMs: number | null; endMs: number | null };

const DAY_MS = 86_400_000;

/** True when `iso` falls inside the window (open bounds always pass). */
export function inWindow(iso: string, w: DateWindow): boolean {
  if (w.startMs == null && w.endMs == null) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  if (w.startMs != null && t < w.startMs) return false;
  if (w.endMs != null && t > w.endMs) return false;
  return true;
}

/**
 * Resolve the active range (plus optional custom `from`/`to` YYYY-MM-DD dates)
 * into a window. Presets are rolling windows ending now; custom uses the given
 * day bounds (local midnight start, end-of-day end). Unparseable custom bounds
 * become open.
 */
export function resolveWindow(
  range: Range,
  now: Date,
  from?: string | null,
  to?: string | null,
): DateWindow {
  if (range === "all") return { startMs: null, endMs: null };
  if (range === "custom") {
    const startMs = from ? Date.parse(`${from}T00:00:00`) : NaN;
    const endMs = to ? Date.parse(`${to}T23:59:59.999`) : NaN;
    return {
      startMs: Number.isNaN(startMs) ? null : startMs,
      endMs: Number.isNaN(endMs) ? null : endMs,
    };
  }
  const days = range === "week" ? 7 : 30;
  return { startMs: now.getTime() - days * DAY_MS, endMs: null };
}
