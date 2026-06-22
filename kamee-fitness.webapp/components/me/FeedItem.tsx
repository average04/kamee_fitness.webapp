import Link from "next/link";
import type { FeedItem as Item } from "@/lib/me/feed";
import { fmtDistance, fmtVolume, type Units } from "@/lib/me/units";

export default function FeedItem({ item, units }: { item: Item; units: Units }) {
  const href =
    item.kind === "workout" ? `/me/workouts/${item.id}` : `/me/tracks/${item.id}`;
  const metric =
    item.kind === "workout"
      ? fmtVolume(item.volumeKg, units)
      : fmtDistance(item.distanceM, units);
  const date = item.dateIso.slice(0, 10);
  const accent = item.kind === "workout" ? "text-leaf-400" : "text-teal-500";
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-leaf-500/30"
    >
      <div className="min-w-0">
        <div className="truncate font-display text-sm font-semibold text-mist">
          {item.title}
        </div>
        <div className="text-xs text-muted">{date}</div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className={accent}>{metric}</span>
        <span className="text-muted" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}
