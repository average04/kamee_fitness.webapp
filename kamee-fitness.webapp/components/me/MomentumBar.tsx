import type { Momentum } from "@/lib/me/momentum";

export default function MomentumBar({ m }: { m: Momentum }) {
  const since =
    m.daysSinceLastWorkout == null
      ? "No workouts yet"
      : m.daysSinceLastWorkout === 0
        ? "Trained today"
        : `${m.daysSinceLastWorkout}d since last workout`;
  const delta = m.workoutsThisWeek - m.workoutsLastWeek;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  const arrowColor =
    delta > 0 ? "text-leaf-400" : delta < 0 ? "text-ember-400" : "text-muted";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-mist/85">
        {since}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-mist/85">
        {m.workoutsThisWeek} this week{" "}
        <span className={arrowColor} aria-label={`change ${delta}`}>
          {arrow}
          {delta !== 0 ? Math.abs(delta) : ""}
        </span>
      </span>
    </div>
  );
}
