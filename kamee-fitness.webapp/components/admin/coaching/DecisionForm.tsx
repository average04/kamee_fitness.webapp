"use client";

import { useState, useTransition } from "react";
import { reviewCoach } from "@/app/admin/(panel)/coaches/actions";

/**
 * The in_review decision form: a note plus Approve / Request changes.
 * Approve stays disabled while the completeness checklist has open items
 * (the server enforces this too via `incomplete:<keys>`, so this is a UX
 * convenience, not the real gate). Request changes requires a note --
 * enforced here for immediate feedback and again server-side.
 */
export function DecisionForm({
  userId,
  canApprove,
}: {
  userId: string;
  canApprove: boolean;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);

  function submit(decision: "approved" | "changes_requested") {
    setError(null);
    if (decision === "changes_requested" && !note.trim()) {
      setError("Add a note telling the coach what to change.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await reviewCoach(userId, decision, note);
        if (res.ok) {
          setDone(decision);
        } else {
          setError(res.error ?? "Could not record the decision. Please try again.");
        }
      } catch {
        setError("Could not record the decision. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-400">
        {done === "approved" ? "Approved." : "Changes requested."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Note for the coach (required for Request changes)"
        aria-label="Review note"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit("approved")}
          disabled={pending || !canApprove}
          title={canApprove ? undefined : "Complete the checklist before approving"}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => submit("changes_requested")}
          disabled={pending}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 enabled:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Working…" : "Request changes"}
        </button>
      </div>
    </div>
  );
}
