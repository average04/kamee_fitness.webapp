type StatCardProps = {
  label: string;
  value: number | string;
  /** Small muted line under the value (e.g. a percentage or context). */
  hint?: string;
  /** "+N this week" badge; omitted when undefined. */
  delta?: number;
};

const fmt = (v: number | string) =>
  typeof v === "number" ? v.toLocaleString("en-US") : v;

export function StatCard({ label, value, hint, delta }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">
        {fmt(value)}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined && delta > 0 && (
          <span className="font-medium text-emerald-400">
            +{delta.toLocaleString("en-US")} this week
          </span>
        )}
        {hint && <span className="text-zinc-500">{hint}</span>}
      </div>
    </div>
  );
}
