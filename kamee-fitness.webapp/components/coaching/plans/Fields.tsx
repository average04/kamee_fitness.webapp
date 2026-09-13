"use client";
import { useId, type ReactNode, type DragEvent } from "react";
import type { Video } from "@/lib/coaching/plans";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  multiline = false,
  maxLength,
  step,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  multiline?: boolean;
  maxLength?: number;
  step?: number | "any";
}) {
  return (
    <label className="plan-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="coach-input"
          rows={3}
          maxLength={maxLength}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="coach-input"
          type={type}
          maxLength={maxLength}
          step={step}
          min={min}
          max={max}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="plan-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="coach-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
export function VideoSelect({
  value,
  videos,
  onChange,
}: {
  value: string | null;
  videos: Video[];
  onChange: (v: string | null) => void;
}) {
  return (
    <Select
      label="Video"
      value={value ?? ""}
      onChange={(v) => onChange(v || null)}
    >
      <option value="">No video</option>
      {value && !videos.some((v) => v.id === value) && (
        <option value={value} disabled>
          Unavailable video - replace or remove
        </option>
      )}
      {videos
        .filter(
          (v) => (v.status === "ready" && !v.retired_at) || v.id === value,
        )
        .map((v) => (
          <option key={v.id} value={v.id} disabled={v.status !== "ready"}>
            {v.title}
            {v.status !== "ready" ? " (unavailable - replace or remove)" : ""}
            {v.retired_at ? " (removed from library)" : ""}
          </option>
        ))}
    </Select>
  );
}
export function OrderControls({
  label,
  index,
  count,
  move,
  duplicate,
  remove,
  dragGroup,
}: {
  label: string;
  index: number;
  count: number;
  move: (delta: number) => void;
  duplicate?: () => void;
  remove: () => void;
  dragGroup?: string;
}) {
  return (
    <div className="plan-order">
      {dragGroup && (
        <button
          type="button"
          draggable
          aria-label={`Drag ${label} to reorder`}
          onDragStart={(e) => startDrag(e, dragGroup, index)}
        >
          ⠿
        </button>
      )}
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={!index}
        onClick={() => move(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => move(1)}
      >
        ↓
      </button>
      {duplicate && (
        <button type="button" onClick={duplicate}>
          Duplicate
        </button>
      )}
      <button type="button" onClick={remove}>
        Remove
      </button>
    </div>
  );
}
const dragType = "application/x-kamee-plan-order";
export function startDrag(e: DragEvent, group: string, index: number) {
  e.stopPropagation();
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(dragType, JSON.stringify({ group, index }));
}
export function dropProps<T>(
  group: string,
  index: number,
  items: T[],
  change: (items: T[]) => void,
) {
  return {
    onDragOver(e: DragEvent) {
      if (e.dataTransfer.types.includes(dragType)) e.preventDefault();
    },
    onDrop(e: DragEvent) {
      try {
        const source = JSON.parse(e.dataTransfer.getData(dragType));
        if (
          source.group !== group ||
          !Number.isInteger(source.index) ||
          source.index < 0 ||
          source.index >= items.length
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        const next = [...items];
        const [item] = next.splice(source.index, 1);
        next.splice(index, 0, item);
        change(next);
      } catch {
        /* Ignore unrelated dragged content. */
      }
    },
  };
}
