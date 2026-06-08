"use client";

import { useState } from "react";
import type { ExerciseFields } from "@/app/admin/(panel)/plans/tree-actions";
import type { ExerciseOption, PlanExerciseNode } from "@/lib/admin/plans";
import { BTN, INPUT, PRIMARY, SELECT } from "./controls";

const toInt = (s: string) => Number.parseInt(s, 10);

/** Add/edit form for one exercise in a block. Used in both add and edit modes. */
export function ExerciseEditor({
  options,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  options: ExerciseOption[];
  initial?: PlanExerciseNode;
  pending: boolean;
  onSubmit: (fields: ExerciseFields) => void;
  onCancel: () => void;
}) {
  const [exerciseId, setExerciseId] = useState(initial?.exercise_id ?? "");
  const [sets, setSets] = useState(String(initial?.sets ?? 3));
  const [reps, setReps] = useState(initial?.reps ?? "");
  const [tempo, setTempo] = useState(initial?.tempo ?? "");
  const [rest, setRest] = useState(
    initial?.rest_seconds != null ? String(initial.rest_seconds) : "",
  );
  const [weight, setWeight] = useState(initial?.weight_hint ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = () =>
    onSubmit({
      exercise_id: exerciseId,
      sets: toInt(sets),
      reps,
      tempo: tempo || null,
      rest_seconds: rest === "" ? null : toInt(rest),
      weight_hint: weight || null,
      notes: notes || null,
    });

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <select
        value={exerciseId}
        onChange={(e) => setExerciseId(e.target.value)}
        className={`${SELECT} w-full`}
      >
        <option value="">— pick exercise —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        <L label="Sets">
          <input
            type="number"
            min={1}
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className={`${INPUT} w-16`}
          />
        </L>
        <L label="Reps">
          <input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="8-10"
            className={`${INPUT} w-24`}
          />
        </L>
        <L label="Rest (s)">
          <input
            type="number"
            min={0}
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            className={`${INPUT} w-20`}
          />
        </L>
        <L label="Tempo">
          <input
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            placeholder="2-0-1"
            className={`${INPUT} w-20`}
          />
        </L>
        <L label="Weight hint">
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="bodyweight"
            className={`${INPUT} w-28`}
          />
        </L>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className={`${INPUT} w-full`}
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !exerciseId}
          onClick={submit}
          className={PRIMARY}
        >
          {initial ? "Save" : "Add exercise"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className={BTN}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      {children}
    </label>
  );
}
