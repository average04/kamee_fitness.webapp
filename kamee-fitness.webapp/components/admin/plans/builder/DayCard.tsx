"use client";

import { useState } from "react";
import {
  addBlock,
  deleteDay,
  moveDay,
  updateDay,
} from "@/app/admin/(panel)/plans/tree-actions";
import {
  DAY_KINDS,
  type DayKind,
  type ExerciseOption,
  type PlanDayNode,
} from "@/lib/admin/plans";
import { BTN, INPUT, MoveDelete, SELECT } from "./controls";
import { BlockCard } from "./BlockCard";
import { useTreeAction } from "./use-tree-action";

export function DayCard({
  planId,
  weekId,
  day,
  index,
  count,
  options,
}: {
  planId: string;
  weekId: string;
  day: PlanDayNode;
  index: number;
  count: number;
  options: ExerciseOption[];
}) {
  const { pending, run } = useTreeAction();
  const [title, setTitle] = useState(day.title ?? "");

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-300">Day {index + 1}</span>
        <select
          value={day.day_kind}
          disabled={pending}
          onChange={(e) =>
            run(() => updateDay(planId, day.id, title, e.target.value as DayKind))
          }
          className={SELECT}
        >
          {DAY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if ((day.title ?? "") !== title) {
              run(() => updateDay(planId, day.id, title, day.day_kind));
            }
          }}
          placeholder="Title (optional)"
          className={`${INPUT} w-48`}
        />
        <span className="ml-auto">
          <MoveDelete
            index={index}
            count={count}
            pending={pending}
            onMove={(d) => run(() => moveDay(planId, weekId, day.id, d))}
            onDelete={() => run(() => deleteDay(planId, weekId, day.id))}
          />
        </span>
      </div>

      {day.day_kind === "workout" && (
        <div className="mt-3 space-y-2">
          {day.blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              planId={planId}
              dayId={day.id}
              block={b}
              index={i}
              count={day.blocks.length}
              options={options}
            />
          ))}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => addBlock(planId, day.id, "main"))}
            className={BTN}
          >
            + Block
          </button>
        </div>
      )}
    </div>
  );
}
