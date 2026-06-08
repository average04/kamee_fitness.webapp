"use client";

import { useState } from "react";
import {
  addExercise,
  deleteBlock,
  moveBlock,
  updateBlock,
} from "@/app/admin/(panel)/plans/tree-actions";
import {
  BLOCK_KINDS,
  type BlockKind,
  type ExerciseOption,
  type PlanBlockNode,
} from "@/lib/admin/plans";
import { MoveDelete, PRIMARY, SELECT } from "./controls";
import { ExerciseEditor } from "./ExerciseEditor";
import { ExerciseRow } from "./ExerciseRow";
import { useTreeAction } from "./use-tree-action";

export function BlockCard({
  planId,
  dayId,
  block,
  index,
  count,
  options,
}: {
  planId: string;
  dayId: string;
  block: PlanBlockNode;
  index: number;
  count: number;
  options: ExerciseOption[];
}) {
  const { pending, run } = useTreeAction();
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <select
          value={block.kind}
          disabled={pending}
          onChange={(e) =>
            run(() => updateBlock(planId, block.id, e.target.value as BlockKind))
          }
          className={SELECT}
        >
          {BLOCK_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <MoveDelete
          index={index}
          count={count}
          pending={pending}
          onMove={(d) => run(() => moveBlock(planId, dayId, block.id, d))}
          onDelete={() => run(() => deleteBlock(planId, dayId, block.id))}
        />
      </div>

      <ul className="mt-2 divide-y divide-zinc-800/60">
        {block.exercises.length === 0 && (
          <li className="py-1 text-xs text-zinc-600">No exercises</li>
        )}
        {block.exercises.map((ex, i) => (
          <ExerciseRow
            key={ex.id}
            planId={planId}
            blockId={block.id}
            ex={ex}
            index={i}
            count={block.exercises.length}
            options={options}
          />
        ))}
      </ul>

      {adding ? (
        <ExerciseEditor
          options={options}
          pending={pending}
          onSubmit={(f) => {
            run(() => addExercise(planId, block.id, f));
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setAdding(true)}
          className={`${PRIMARY} mt-2`}
        >
          + Exercise
        </button>
      )}
    </div>
  );
}
