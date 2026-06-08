import type { StoreSlice } from "@/lib/admin/metrics";
import { ChartEmpty, DONUT_COLORS } from "./chart-ui";

const STORE_LABELS: Record<string, string> = {
  app_store: "App Store",
  play_store: "Play Store",
  stripe: "Stripe",
  unknown: "Unknown",
};

const label = (s: string) => STORE_LABELS[s] ?? s;
const color = (i: number) => DONUT_COLORS[i % DONUT_COLORS.length];

/**
 * Donut of active subscriptions by store. Rendered with a CSS conic-gradient
 * (masked into a ring) rather than Recharts: a single full-circle slice is a
 * known Recharts rendering glitch, and this is correct for any slice count.
 */
export function StoreDonut({ data }: { data: StoreSlice[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <ChartEmpty height={150} />;

  const stops = data
    .map((d, i) => {
      const before = data.slice(0, i).reduce((s, x) => s + x.count, 0);
      const start = (before / total) * 360;
      const end = ((before + d.count) / total) * 360;
      return `${color(i)} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `conic-gradient(${stops})`,
            WebkitMask: "radial-gradient(circle, transparent 50px, #000 51px)",
            mask: "radial-gradient(circle, transparent 50px, #000 51px)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-zinc-100">{total}</span>
          <span className="text-[11px] text-zinc-500">active</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.store} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: color(i) }}
            />
            <span className="text-zinc-300">{label(d.store)}</span>
            <span className="text-zinc-500">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
