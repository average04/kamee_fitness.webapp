import type { WeeklyGoal } from "@/lib/me/goal";

export default function WeeklyGoalCard({ goal }: { goal: WeeklyGoal }) {
  const { target, thisWeekCount, history } = goal;
  const segs = Math.max(target, thisWeekCount, 1);
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-sm font-semibold text-mist">
          Weekly goal
        </div>
        <div className="text-xs text-muted">
          {thisWeekCount}
          {target > 0 ? ` / ${target}` : ""} this week
        </div>
      </div>
      {target > 0 && (
        <div className="mt-2 flex gap-1">
          {Array.from({ length: segs }).map((_, i) => (
            <div
              key={i}
              className={
                "h-2 flex-1 rounded-full " +
                (i < thisWeekCount ? "bg-leaf-500" : "bg-white/8")
              }
            />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        {history.map((h) => (
          <span
            key={h.weekStartIso}
            title={`${h.weekStartIso}: ${h.count}${target > 0 ? `/${target}` : ""}`}
            className={
              "size-2.5 rounded-full " +
              (h.hit
                ? "bg-sun-500"
                : h.count > 0
                  ? "bg-leaf-500/40"
                  : "bg-white/10")
            }
          />
        ))}
        <span className="ml-2 text-[0.6rem] uppercase tracking-[0.16em] text-muted">
          last {history.length} wks
        </span>
      </div>
    </div>
  );
}
