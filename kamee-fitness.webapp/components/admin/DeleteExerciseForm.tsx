"use client";

import { useState } from "react";

/**
 * Delete control gated behind typing "yes" — prevents accidental one-click
 * deletes. The `deleteExercise` server action (passed in) still enforces admin
 * auth, so this is a footgun guard, not a security boundary.
 */
export function DeleteExerciseForm({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState("");
  const armed = confirm.trim().toLowerCase() === "yes";

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder='Type "yes" to delete'
        aria-label='Type "yes" to confirm deletion'
        className="w-40 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-red-700"
      />
      <button
        type="submit"
        disabled={!armed}
        className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 enabled:hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete
      </button>
    </form>
  );
}
