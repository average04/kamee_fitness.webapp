"use client";
import { AddCustomExercise } from "./AddCustomExercise";
import { timedSeconds } from "@/lib/coaching/custom-exercise";
import { ExercisePicker } from "./ExercisePicker";
import Image from "next/image";
import {
  duplicate,
  move,
  type Block,
  type ExerciseOption,
  type Video,
} from "@/lib/coaching/plans";
import { Field, Select, VideoSelect, OrderControls, dropProps } from "./Fields";

export function WorkoutEditor({
  blocks,
  exercises,
  videos,
  onChange,
}: {
  blocks: Block[];
  exercises: ExerciseOption[];
  videos: Video[];
  onChange: (v: Block[]) => void;
}) {
  const setBlock = (i: number, b: Block) =>
    onChange(blocks.map((old, n) => (n === i ? b : old)));
  return (
    <section className="plan-stack">
      <h3>Exercises</h3>
      {blocks.map((block, bi) => (
        <div
          key={block.lineage_key}
          className="plan-block plan-stack"
          {...dropProps(
            blocks
              .map((b) => b.lineage_key)
              .sort()
              .join(),
            bi,
            blocks,
            onChange,
          )}
        >
          <div className="plan-item-header">
            <h4>Exercise group {bi + 1}</h4>
              <OrderControls label={`group ${bi + 1}`} index={bi} count={blocks.length}
                move={(delta) => onChange(move(blocks, bi, delta))}
                remove={() => { if (confirm("Remove this group and its exercises?")) onChange(blocks.filter((_, i) => i !== bi)); }} />
          </div>
          <details className="plan-advanced">
            <summary>Exercise group settings</summary>
            <div className="plan-stack">
              <Select label="Group type" value={block.kind}
                onChange={(v) => setBlock(bi, { ...block, kind: v as Block["kind"] })}>
                {[["main", "Regular exercises"], ["warmup", "Warm-up"], ["cooldown", "Cool-down"],
                  ["superset", "Superset"], ["circuit", "Circuit"]].map(([value, label]) =>
                  <option key={value} value={value}>{label}</option>)}
              </Select>

            </div>
          </details>
          {block.exercises.map((ex, ei) => {
            const demo = exercises.find(
              (e) => e.id === ex.exercise_id,
            )?.demo_image_path;
            const set = (patch: Partial<typeof ex>) =>
              setBlock(bi, {
                ...block,
                exercises: block.exercises.map((v, i) =>
                  i === ei ? { ...ex, ...patch } : v,
                ),
              });
            return (
              <div
                className="plan-exercise plan-stack"
                key={ex.lineage_key}
                {...dropProps(
                  block.lineage_key,
                  ei,
                  block.exercises,
                  (exercises) => setBlock(bi, { ...block, exercises }),
                )}
              >
                <div className="plan-item-header">
                  <strong>
                    {ex.custom_name ?? exercises.find((e) => e.id === ex.exercise_id)?.name ??
                      "Exercise"}
                  </strong>
                  <OrderControls
                    dragGroup={block.lineage_key}
                    label={`exercise ${ei + 1}`}
                    index={ei}
                    count={block.exercises.length}
                    move={(d) =>
                      setBlock(bi, {
                        ...block,
                        exercises: move(block.exercises, ei, d),
                      })
                    }
                    duplicate={() =>
                      setBlock(bi, {
                        ...block,
                        exercises: [...block.exercises, duplicate(ex)],
                      })
                    }
                    remove={() =>
                      setBlock(bi, {
                        ...block,
                        exercises: block.exercises.filter((_, i) => i !== ei),
                      })
                    }
                  />
                </div>
                {demo && (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${demo}`}
                    width={88}
                    height={88}
                    unoptimized
                    alt="Exercise demonstration"
                    className="rounded-lg"
                  />
                )}
                {ex.custom_name != null && <Field label="Custom exercise name" value={ex.custom_name} onChange={(custom_name) => set({ custom_name })} />}
                <div className="plan-grid plan-prescription">
                  <Select label="Tracking" value={timedSeconds(ex.reps) !== null ? "time" : "reps"} onChange={(mode) => set({ reps: mode === "time" ? "45s" : "10" })}>
                    <option value="reps">Sets &amp; reps</option><option value="time">Timed</option>
                  </Select>
                  <Field
                    label="Sets"
                    type="number"
                    min={1}
                    max={30}
                    value={ex.sets}
                    onChange={(v) => set({ sets: Number(v) })}
                  />
                  <Field
                    label={timedSeconds(ex.reps) !== null ? "Seconds per set" : "Reps per set"}
                    type={timedSeconds(ex.reps) !== null ? "number" : "text"}
                    min={1}
                    max={3600}
                    value={timedSeconds(ex.reps) ?? ex.reps}
                    onChange={(value) => set({ reps: timedSeconds(ex.reps) !== null ? `${value || "0"}s` : value })}
                  />
                  <Field
                    label="Rest (sec)"
                    type="number"
                    min={0}
                    max={3600}
                    value={ex.rest_seconds}
                    onChange={(v) => set({ rest_seconds: Number(v) })}
                  />
                </div>
                <details className="plan-advanced">
                  <summary>Notes, video &amp; advanced settings</summary>
                  <div className="plan-grid">
                  <Field
                    label="Tempo"
                    value={ex.tempo}
                    onChange={(tempo) => set({ tempo })}
                  />
                  <Field
                    label="Weight hint"
                    value={ex.weight_hint}
                    onChange={(weight_hint) => set({ weight_hint })}
                  />
                  <VideoSelect
                    value={ex.coaching_video_id}
                    videos={videos}
                    onChange={(coaching_video_id) => set({ coaching_video_id })}
                  />
                </div>
                <Field
                  label="Notes"
                  value={ex.notes}
                  onChange={(notes) => set({ notes })}
                />
                </details>
              </div>
            );
          })}
          <AddCustomExercise onAdd={(exercise) => setBlock(bi, { ...block, exercises: [...block.exercises, exercise] })} />
          <ExercisePicker exercises={exercises} onAdd={(id) => setBlock(bi, {
            ...block, exercises: [...block.exercises, makeExercise(id)],
          })} />
        </div>
      ))}
      {blocks.length === 0 ? (
        <>
          <p className="coach-panel-description">Choose an exercise, then set the sets, reps and rest.</p>
          <AddCustomExercise onAdd={(exercise) => onChange([{lineage_key: crypto.randomUUID(), kind: "main", exercises: [exercise]}])} />
          <ExercisePicker exercises={exercises} onAdd={(id) => onChange([
            { lineage_key: crypto.randomUUID(), kind: "main", exercises: [makeExercise(id)] },
          ])} />
        </>
      ) : (
        <details className="plan-advanced">
          <summary>Add a warm-up, circuit or other group</summary>
          <button type="button" className="plan-secondary" disabled={blocks.length >= 12}
            onClick={() => onChange([...blocks, { lineage_key: crypto.randomUUID(), kind: "main", exercises: [] }])}>
            Add exercise group
          </button>
        </details>
      )}
    </section>
  );
}

function makeExercise(id: string): Block["exercises"][number] {
  return { lineage_key: crypto.randomUUID(), exercise_id: id, sets: 3, reps: "10",
    rest_seconds: 60, tempo: null, weight_hint: null, notes: null, coaching_video_id: null };
}
