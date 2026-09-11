"use client";

import { useRef, useState, useTransition } from "react";
import { setCoachStatus } from "@/app/admin/(panel)/coaches/actions";
import type { CoachStatusAction } from "@/lib/coaching/admin";

const COPY: Record<
  CoachStatusAction,
  { label: string; verb: string; tone: "warn" | "positive" | "danger" }
> = {
  suspended: { label: "Suspend", verb: "suspend", tone: "warn" },
  approved: { label: "Reinstate", verb: "reinstate", tone: "positive" },
  revoked: { label: "Revoke", verb: "revoke", tone: "danger" },
};

const TONE_CLASSES: Record<string, string> = {
  warn: "border-amber-800 text-amber-400 hover:bg-amber-950/40",
  positive: "border-emerald-700 text-emerald-400 hover:bg-emerald-950/40",
  danger: "border-red-900 text-red-400 hover:bg-red-950/40",
};

const CONFIRM_TONE_CLASSES: Record<string, string> = {
  warn: "bg-amber-600 enabled:hover:bg-amber-500",
  positive: "bg-emerald-600 enabled:hover:bg-emerald-500",
  danger: "bg-red-600 enabled:hover:bg-red-500",
};

/**
 * Suspend / Reinstate / Revoke, gated behind a confirm dialog (same
 * click-through-a-dialog pattern as DeleteExerciseForm). The action always
 * carries a note, since `admin_set_coach_status` records every status
 * change into coaching_reviews for the coach to see later.
 */
export function StatusActionButton({
  userId,
  status,
}: {
  userId: string;
  status: CoachStatusAction;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[status];

  function openModal() {
    setNote("");
    setError(null);
    dialogRef.current?.showModal();
  }
  function closeModal() {
    dialogRef.current?.close();
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await setCoachStatus(userId, status, note);
        if (res.ok) {
          closeModal();
        } else {
          setError(res.error ?? "Could not complete that action. Please try again.");
        }
      } catch {
        setError("Could not complete that action. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`rounded-lg border px-3 py-1.5 text-sm ${TONE_CLASSES[copy.tone]}`}
      >
        {copy.label}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setError(null)}
        onCancel={(e) => {
          // M4 (fix round 1): a native <dialog> fires "cancel" on Escape
          // just before closing -- block it while a request is in flight so
          // Escape can't abandon the dialog mid-submit (the button-based
          // Cancel below is disabled for the same reason).
          if (pending) e.preventDefault();
        }}
        className="m-auto w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 backdrop:bg-black/70"
      >
        <h2 className="text-base font-semibold">{copy.label} this coach?</h2>
        <p className="mt-2 text-sm text-zinc-400">
          This will {copy.verb} the account. The coach will see this note on their
          review history.
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Optional note"
          aria-label={`Note for ${copy.verb} decision`}
          className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
        />

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            disabled={pending}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${CONFIRM_TONE_CLASSES[copy.tone]}`}
          >
            {pending ? "Working…" : copy.label}
          </button>
        </div>
      </dialog>
    </>
  );
}
