"use client";
import { useState } from "react";
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
  const [search, setSearch] = useState("");
  const options = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()),
  );
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
          <div className="plan-card">
            <Select
              label="Block"
              value={block.kind}
              onChange={(v) =>
                setBlock(bi, { ...block, kind: v as Block["kind"] })
              }
            >
              {["warmup", "main", "cooldown", "superset", "circuit"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </Select>
            <OrderControls
              dragGroup={blocks
                .map((b) => b.lineage_key)
                .sort()
                .join()}
              label={`block ${bi + 1}`}
              index={bi}
              count={blocks.length}
              move={(delta) => onChange(move(blocks, bi, delta))}
              remove={() => onChange(blocks.filter((_, i) => i !== bi))}
            />
          </div>
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
                <div className="plan-card">
                  <strong>
                    {exercises.find((e) => e.id === ex.exercise_id)?.name ??
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
                <div className="plan-grid">
                  <Field
                    label="Sets"
                    type="number"
                    min={1}
                    max={30}
                    value={ex.sets}
                    onChange={(v) => set({ sets: Number(v) })}
                  />
                  <Field
                    label="Reps"
                    value={ex.reps}
                    onChange={(reps) => set({ reps })}
                  />
                  <Field
                    label="Rest (sec)"
                    type="number"
                    min={0}
                    max={3600}
                    value={ex.rest_seconds}
                    onChange={(v) => set({ rest_seconds: Number(v) })}
                  />
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
              </div>
            );
          })}
          <div className="plan-grid">
            <Field label="Find exercise" value={search} onChange={setSearch} />
            <Select
              label="Add from catalog"
              value=""
              onChange={(id) => {
                if (!id) return;
                setBlock(bi, {
                  ...block,
                  exercises: [
                    ...block.exercises,
                    {
                      lineage_key: crypto.randomUUID(),
                      exercise_id: id,
                      sets: 3,
                      reps: "10",
                      rest_seconds: 60,
                      tempo: null,
                      weight_hint: null,
                      notes: null,
                      coaching_video_id: null,
                    },
                  ],
                });
              }}
            >
              <option value="">Choose exercise</option>
              {options.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="plan-secondary"
        disabled={blocks.length >= 12}
        onClick={() =>
          onChange([
            ...blocks,
            { lineage_key: crypto.randomUUID(), kind: "main", exercises: [] },
          ])
        }
      >
        Add block
      </button>
    </section>
  );
}
