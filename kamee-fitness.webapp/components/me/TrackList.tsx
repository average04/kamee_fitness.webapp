import type { TrackSummary } from "@/lib/me/tracks";
import { fmtDistance, fmtDuration, type Units } from "@/lib/me/units";
import RouteThumbnail from "./RouteThumbnail";

export default function TrackList({
  recent,
  units,
}: {
  recent: TrackSummary["recent"];
  units: Units;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {recent.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3"
        >
          <RouteThumbnail routePoints={t.routePoints} />
          <div>
            <div className="font-display text-sm font-semibold capitalize text-mist">
              {t.mode}
            </div>
            <div className="text-xs text-muted">
              {fmtDistance(t.distanceM, units)} · {fmtDuration(t.durationS)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
