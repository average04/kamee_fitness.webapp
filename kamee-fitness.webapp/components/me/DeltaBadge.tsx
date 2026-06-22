export default function DeltaBadge({
  delta,
  format,
}: {
  delta: number | null;
  format: (n: number) => string;
}) {
  if (delta == null) return null;
  if (delta === 0) return <span className="text-xs text-muted">—</span>;
  const up = delta > 0;
  return (
    <span className={"text-xs " + (up ? "text-leaf-400" : "text-ember-400")}>
      {up ? "▲" : "▼"} {format(Math.abs(delta))}
    </span>
  );
}
