"use client";

import { addWeek } from "@/app/admin/(panel)/plans/tree-actions";
import type { ExerciseOption, PlanWeekNode } from "@/lib/admin/plans";
import { PRIMARY } from "./controls";
import { useTreeAction } from "./use-tree-action";
import { WeekCard } from "./WeekCard";

export function PlanBuilder({
  planId,
  weeks,
  options,
}: {
  planId: string;
  weeks: PlanWeekNode[];
  options: ExerciseOption[];
}) {
  const { pending, run } = useTreeAction();

  return (
    <div className="space-y-4">
      {weeks.length === 0 && (
        <p className="text-sm text-zinc-500">No weeks yet — add one to start.</p>
      )}
      {weeks.map((w, i) => (
        <WeekCard
          key={w.id}
          planId={planId}
          week={w}
          index={i}
          count={weeks.length}
          options={options}
        />
      ))}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => addWeek(planId))}
        className={PRIMARY}
      >
        + Add week
      </button>
    </div>
  );
}
