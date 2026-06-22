const ACCENT = {
  leaf: "text-leaf-400",
  teal: "text-teal-500",
  sun: "text-sun-500",
  mist: "text-mist",
} as const;

export default function StatCard({
  label,
  value,
  sub,
  accent = "mist",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: keyof typeof ACCENT;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className={"mt-1 font-display text-2xl font-bold " + ACCENT[accent]}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted/80">{sub}</div>}
    </div>
  );
}
