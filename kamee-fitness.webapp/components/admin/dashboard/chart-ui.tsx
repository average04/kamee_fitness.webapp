/** Shared dark-theme constants and bits for the dashboard Recharts components. */

export const EMERALD = "#10b981";
export const SKY = "#38bdf8";
export const DONUT_COLORS = ["#10b981", "#38bdf8", "#a78bfa", "#f59e0b", "#f43f5e", "#94a3b8"];

export const GRID_STROKE = "#27272a";

/** Spread onto an `<XAxis>` / `<YAxis>` for the muted dark look. */
export const AXIS = {
  tick: { fill: "#71717a", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Spread onto a Recharts `<Tooltip>`. */
export const TOOLTIP = {
  contentStyle: {
    background: "#0a0c0d",
    border: "1px solid #27272a",
    borderRadius: 8,
    fontSize: 12,
    color: "#e4e4e7",
  },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
} as const;

/** "2026-06-08" -> "Jun 8" (UTC, matches how buckets are keyed). */
export function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Tiny colored-dot legend label, used in chart card headers. */
export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** Centered placeholder shown in place of a chart when there's no data. */
export function ChartEmpty({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-zinc-600"
      style={{ height }}
    >
      No data yet
    </div>
  );
}
