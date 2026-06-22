import type { Split } from "@/lib/me/trackDetail";
import type { Units } from "@/lib/me/units";

function pace(secPerUnit: number): string {
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SplitBars({
  splits,
  units,
}: {
  splits: Split[];
  units: Units;
}) {
  if (!splits.length) return null;
  const unit = units === "imperial" ? "mi" : "km";
  const full = splits.filter((s) => !s.partial);
  const fastest = full.length ? Math.min(...full.map((s) => s.paceSecPerUnit)) : 0;
  const slowest = full.length ? Math.max(...full.map((s) => s.paceSecPerUnit)) : 1;
  const span = Math.max(1, slowest - fastest);
  return (
    <ul className="space-y-1.5">
      {splits.map((s) => {
        const isFastest = !s.partial && s.paceSecPerUnit === fastest;
        const width = s.partial
          ? 40
          : 40 + (1 - (s.paceSecPerUnit - fastest) / span) * 60;
        return (
          <li key={s.index} className="flex items-center gap-3 text-xs">
            <span className="w-10 text-muted">
              {unit}
              {s.index}
              {s.partial ? "•" : ""}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className={
                  "h-full rounded-full " + (isFastest ? "bg-sun-500" : "bg-teal-500")
                }
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-12 text-right text-mist/85">
              {pace(s.paceSecPerUnit)}/{unit}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
