import Link from "next/link";
import type { TrackBest, TrackRecords as Records } from "@/lib/me/trackRecords";
import {
  fmtClock,
  fmtDistance,
  fmtDuration,
  fmtElevation,
  type Units,
} from "@/lib/me/units";
import StatGrid from "./StatGrid";

function paceLabel(secPerKm: number, units: Units): string {
  const secPerUnit = units === "imperial" ? secPerKm * 1.609344 : secPerKm;
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")} ${units === "imperial" ? "/mi" : "/km"}`;
}

function BestRow({
  label,
  best,
  value,
}: {
  label: string;
  best: TrackBest;
  value: string;
}) {
  if (!best) return null;
  return (
    <Link
      href={`/me/tracks/${best.trackId}`}
      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-leaf-300"
    >
      <span className="font-display font-semibold text-mist">{label}</span>
      <span className="flex items-center gap-3 text-sm">
        <span className="text-teal-500">{value}</span>
        <span className="hidden text-xs capitalize text-muted sm:inline">
          {best.mode} · {best.dateIso}
        </span>
        <span className="text-muted" aria-hidden>
          →
        </span>
      </span>
    </Link>
  );
}

export default function TrackRecords({
  records,
  units,
}: {
  records: Records;
  units: Units;
}) {
  const { bests, efforts, totals } = records;
  const anyBest =
    bests.longestDistanceM ||
    bests.longestDurationS ||
    bests.fastestPaceSecPerKm ||
    bests.mostElevationM;

  if (!totals.sessions) {
    return (
      <p className="text-sm text-muted">
        No outdoor activities yet — start a walk or run in the app.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {anyBest && (
        <div className="divide-y divide-white/8 border-y border-white/8">
          <BestRow
            label="Longest distance"
            best={bests.longestDistanceM}
            value={
              bests.longestDistanceM
                ? fmtDistance(bests.longestDistanceM.value, units)
                : ""
            }
          />
          <BestRow
            label="Longest duration"
            best={bests.longestDurationS}
            value={
              bests.longestDurationS
                ? fmtDuration(bests.longestDurationS.value)
                : ""
            }
          />
          <BestRow
            label="Fastest pace"
            best={bests.fastestPaceSecPerKm}
            value={
              bests.fastestPaceSecPerKm
                ? paceLabel(bests.fastestPaceSecPerKm.value, units)
                : ""
            }
          />
          <BestRow
            label="Most elevation"
            best={bests.mostElevationM}
            value={
              bests.mostElevationM
                ? `↑ ${fmtElevation(bests.mostElevationM.value, units)}`
                : ""
            }
          />
        </div>
      )}

      {(efforts.fastest1kS || efforts.fastest5kS) && (
        <div>
          <h4 className="mb-2 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted">
            Best efforts
          </h4>
          <div className="divide-y divide-white/8 border-y border-white/8">
            <BestRow
              label="Fastest 1K"
              best={efforts.fastest1kS}
              value={efforts.fastest1kS ? fmtClock(efforts.fastest1kS.value) : ""}
            />
            <BestRow
              label="Fastest 5K"
              best={efforts.fastest5kS}
              value={efforts.fastest5kS ? fmtClock(efforts.fastest5kS.value) : ""}
            />
          </div>
        </div>
      )}

      <StatGrid
        cells={[
          { label: "Total distance", value: fmtDistance(totals.distanceM, units) },
          { label: "Moving time", value: fmtDuration(totals.durationS) },
          { label: "Sessions", value: String(totals.sessions) },
          { label: "Total climb", value: fmtElevation(totals.elevationM, units) },
        ]}
      />
    </div>
  );
}
