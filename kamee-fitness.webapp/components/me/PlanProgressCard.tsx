import type { PlanSummary } from "@/lib/me/plan";

export default function PlanProgressCard({ plan }: { plan: PlanSummary }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-sm font-semibold text-mist">
          {plan.title}
        </div>
        <div className="text-xs text-muted">
          Week {plan.currentWeek} of {plan.totalWeeks}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-leaf-500"
          style={{ width: `${plan.pct}%` }}
        />
      </div>
    </div>
  );
}
