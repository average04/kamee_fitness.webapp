"use client";

import {
  addDay,
  deleteWeek,
  moveWeek,
} from "@/app/admin/(panel)/plans/tree-actions";
import type { ExerciseOption, PlanWeekNode } from "@/lib/admin/plans";
import { BTN, MoveDelete } from "./controls";
import { DayCard } from "./DayCard";
import { useTreeAction } from "./use-tree-action";

export function WeekCard({
  planId,
  week,
  index,
  count,
  options,
}: {
  planId: string;
  week: PlanWeekNode;
  index: number;
  count: number;
  options: ExerciseOption[];
}) {
  const { pending, run } = useTreeAction();

  return (
    <div className="rounded-xl border border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-medium text-zinc-200">Week {index + 1}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => addDay(planId, week.id))}
            className={BTN}
          >
            + Day
          </button>
          <MoveDelete
            index={index}
            count={count}
            pending={pending}
            onMove={(d) => run(() => moveWeek(planId, week.id, d))}
            onDelete={() => run(() => deleteWeek(planId, week.id))}
          />
        </div>
      </div>
      <div className="space-y-2 p-3">
        {week.days.length === 0 && (
          <p className="text-xs text-zinc-600">No days yet.</p>
        )}
        {week.days.map((d, i) => (
          <DayCard
            key={d.id}
            planId={planId}
            weekId={week.id}
            day={d}
            index={i}
            count={week.days.length}
            options={options}
          />
        ))}
      </div>
    </div>
  );
}
