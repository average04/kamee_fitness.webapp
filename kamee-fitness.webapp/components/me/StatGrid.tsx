export default function StatGrid({
  cells,
}: {
  cells: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-white/8 bg-white/[0.02] p-3"
        >
          <div className="text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted">
            {c.label}
          </div>
          <div className="mt-1 font-display text-lg font-bold text-mist">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
