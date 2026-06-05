"use client";

import { useRef, useState } from "react";

/**
 * Delete control. The page button only OPENS a confirmation modal — it never
 * deletes. Inside the modal the confirm button stays disabled until "yes" is
 * typed, and Enter is blocked, so deleting takes a deliberate click. The
 * `deleteExercise` server action still enforces admin auth.
 */
export function DeleteExerciseForm({
  id,
  name,
  action,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirm, setConfirm] = useState("");
  const armed = confirm.trim().toLowerCase() === "yes";

  function openModal() {
    setConfirm("");
    dialogRef.current?.showModal();
  }
  function closeModal() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40"
      >
        Delete
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setConfirm("")}
        className="m-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 backdrop:bg-black/70"
      >
        <h2 className="text-base font-semibold">Delete exercise?</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This permanently deletes{" "}
          <span className="text-zinc-200">{name}</span>. Type{" "}
          <span className="font-mono text-zinc-200">yes</span> to confirm.
        </p>

        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={id} />
          <input
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => {
              // Require a deliberate click, not Enter.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder='Type "yes"'
            aria-label='Type "yes" to confirm deletion'
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-700"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!armed}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete exercise
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
