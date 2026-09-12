"use client";

import type { SaveState } from "@/lib/coaching/autosave";

export function SaveIndicator({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry?: () => void;
}) {
  // I7 (fix round 1): a single persistent live region (rather than
  // returning null/a fresh element per state) so assistive tech actually
  // announces the Saving -> Saved/error transition instead of missing it.
  return (
    <p role="status" aria-live="polite" className="text-xs text-muted">
      {state === "saving" && "Saving…"}
      {state === "saved" && "Saved"}
      {state === "error" && (
        <>
          Couldn&apos;t save ·{" "}
          <button type="button" onClick={onRetry} className="underline hover:text-mist">
            Retry
          </button>
        </>
      )}
    </p>
  );
}
