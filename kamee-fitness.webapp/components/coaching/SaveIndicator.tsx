"use client";

import type { SaveState } from "@/lib/coaching/autosave";

export function SaveIndicator({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry?: () => void;
}) {
  if (state === "idle") return null;
  if (state === "saving") return <p className="text-xs text-muted">Saving…</p>;
  if (state === "saved") return <p className="text-xs text-muted">Saved</p>;
  return (
    <p className="text-xs text-muted">
      Couldn&apos;t save ·{" "}
      <button
        type="button"
        onClick={onRetry}
        className="underline hover:text-mist"
      >
        Retry
      </button>
    </p>
  );
}
