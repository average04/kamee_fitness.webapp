import Link from "next/link";
import type { FeedItem as Item } from "@/lib/me/feed";
import {
  fmtDistance,
  fmtDuration,
  fmtPaceFromMeters,
  fmtVolume,
  type Units,
} from "@/lib/me/units";
import RouteThumbnail from "./RouteThumbnail";
import RowPendingArrow from "./RowPendingArrow";

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M4 9H2v6h2v-2h1v2h2V7H5v2H4V9zm16 0v2h-1V9h-2v8h2v-2h1v2h2V9h-2zM8 11h8v2H8v-2z" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M5 19c4 0 4-7 8-7s4 7 8 7" strokeLinecap="round" />
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function FeedItem({ item, units }: { item: Item; units: Units }) {
  const isWorkout = item.kind === "workout";
  const href = isWorkout ? `/me/workouts/${item.id}` : `/me/tracks/${item.id}`;
  const accent = isWorkout ? "text-leaf-400" : "text-teal-500";
  const metric = isWorkout
    ? fmtVolume(item.volumeKg, units)
    : fmtDistance(item.distanceM, units);
  const secondary = isWorkout
    ? `${item.setCount} ${item.setCount === 1 ? "set" : "sets"} · ${fmtDuration(item.durationS)}`
    : `${fmtPaceFromMeters(item.distanceM, item.durationS, units)} · ${fmtDuration(item.durationS)}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-leaf-500/30"
    >
      {isWorkout ? (
        <span
          className={
            "grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-500/10 " +
            accent
          }
        >
          <DumbbellIcon />
        </span>
      ) : (
        <span className="size-10 shrink-0 [&>svg]:size-10">
          <RouteThumbnail routePoints={item.routePoints} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {!isWorkout && (
            <span className="text-teal-500/70">
              <RouteIcon />
            </span>
          )}
          <span className="truncate font-display text-sm font-semibold text-mist">
            {item.title}
          </span>
        </div>
        <div className="text-xs text-muted">{secondary}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <span className={accent}>{metric}</span>
        <RowPendingArrow />
      </div>
    </Link>
  );
}
