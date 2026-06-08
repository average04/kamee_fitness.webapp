"use client";

export const BTN =
  "rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 enabled:hover:border-zinc-500 disabled:opacity-40";
export const PRIMARY =
  "rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white enabled:hover:bg-emerald-500 disabled:opacity-40";
export const SELECT =
  "rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-600 disabled:opacity-40";
export const INPUT =
  "rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-emerald-600";

const ICON =
  "rounded border border-zinc-700 px-1.5 text-xs text-zinc-400 enabled:hover:border-zinc-500 disabled:opacity-30";
const ICON_DANGER =
  "rounded border border-red-900 px-1.5 text-xs text-red-400 enabled:hover:bg-red-950/40 disabled:opacity-30";

/** Up / down / delete cluster for a reorderable, removable node. */
export function MoveDelete({
  index,
  count,
  pending,
  onMove,
  onDelete,
}: {
  index: number;
  count: number;
  pending: boolean;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        title="Move up"
        disabled={pending || index === 0}
        onClick={() => onMove("up")}
        className={ICON}
      >
        ↑
      </button>
      <button
        type="button"
        title="Move down"
        disabled={pending || index === count - 1}
        onClick={() => onMove("down")}
        className={ICON}
      >
        ↓
      </button>
      <button
        type="button"
        title="Delete"
        disabled={pending}
        onClick={onDelete}
        className={ICON_DANGER}
      >
        ✕
      </button>
    </span>
  );
}
