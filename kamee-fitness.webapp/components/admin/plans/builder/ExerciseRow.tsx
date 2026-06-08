"use client";

import { useState } from "react";
import {
  deleteExercise,
  moveExercise,
  updateExercise,
} from "@/app/admin/(panel)/plans/tree-actions";
import type { ExerciseOption, PlanExerciseNode } from "@/lib/admin/plans";
import { BTN, MoveDelete } from "./controls";
import { ExerciseEditor } from "./ExerciseEditor";
import { useTreeAction } from "./use-tree-action";

export function ExerciseRow({
  planId,
  blockId,
  ex,
  index,
  count,
  options,
}: {
  planId: string;
  blockId: string;
  ex: PlanExerciseNode;
  index: number;
  count: number;
  options: ExerciseOption[];
}) {
  const { pending, run } = useTreeAction();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <ExerciseEditor
          options={options}
          initial={ex}
          pending={pending}
          onSubmit={(f) => {
            run(() => updateExercise(planId, ex.id, f));
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <span className="min-w-0 flex-1 truncate text-zinc-300">
        <span className="text-zinc-500">
          {ex.sets}×{ex.reps}
        </span>{" "}
        {ex.exercise_name ?? ex.exercise_id}
        {ex.rest_seconds ? (
          <span className="text-zinc-500"> · {ex.rest_seconds}s</span>
        ) : null}
        {ex.weight_hint ? (
          <span className="text-zinc-500"> · {ex.weight_hint}</span>
        ) : null}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => setEditing(true)}
        className={BTN}
      >
        Edit
      </button>
      <MoveDelete
        index={index}
        count={count}
        pending={pending}
        onMove={(d) => run(() => moveExercise(planId, blockId, ex.id, d))}
        onDelete={() => run(() => deleteExercise(planId, blockId, ex.id))}
      />
    </li>
  );
}
