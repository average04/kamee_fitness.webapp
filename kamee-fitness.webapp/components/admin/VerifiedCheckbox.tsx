"use client";

import { useState, useTransition } from "react";

/**
 * Inline toggle for an exercise's `verified` moderation flag in the list table.
 * Updates optimistically via the passed server action and reverts if the write
 * fails, surfacing a small "!" on error.
 */
export function VerifiedCheckbox({
  id,
  name,
  initialVerified,
  onToggle,
}: {
  id: string;
  name: string;
  initialVerified: boolean;
  onToggle: (
    id: string,
    verified: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [verified, setVerified] = useState(initialVerified);
  const [errored, setErrored] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setVerified(next); // optimistic
    setErrored(false);
    startTransition(async () => {
      const res = await onToggle(id, next);
      if (!res.ok) {
        setVerified(!next); // revert
        setErrored(true);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="checkbox"
        checked={verified}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
        aria-label={`Mark ${name} as verified`}
        title={verified ? "Verified" : "Not verified"}
        className="h-4 w-4 cursor-pointer accent-emerald-500 disabled:cursor-default disabled:opacity-50"
      />
      {errored && (
        <span className="text-xs text-red-400" title="Save failed">
          !
        </span>
      )}
    </span>
  );
}
