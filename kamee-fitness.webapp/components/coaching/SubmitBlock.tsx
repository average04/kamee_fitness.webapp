"use client";

import { useState, useTransition } from "react";
import { submitProfile } from "@/app/coaching/(hub)/actions";
import type { CoachStatus } from "@/lib/coaching/states";

/**
 * Mounted below the profile form on the onboarding page. The disabled
 * state (checklist not yet complete) is convenience only -- the RPC
 * (`submit_coaching_profile`) is the real enforcer, and `submitProfile`
 * maps its `incomplete:<keys>` / `wrong_state` errors to friendly copy.
 * Renders nothing once the coach is no longer in a submittable status: the
 * onboarding page already shows its own "Submitted" card for `in_review`,
 * and there is nothing to submit once approved/suspended.
 */
export function SubmitBlock({
  missing,
  status,
}: {
  missing: string[];
  status: CoachStatus;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status !== "onboarding" && status !== "changes_requested") {
    return null;
  }

  const remaining = missing.length;

  function onSubmit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await submitProfile();
        if (result.message) setMessage(result.message);
      } catch {
        setMessage("Could not submit. Please retry.");
      }
    });
  }

  return (
    <div className="space-y-2 coach-panel">
      <button
        type="button"
        onClick={onSubmit}
        disabled={remaining > 0 || pending}
        className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
      >
        {pending
          ? "Submitting…"
          : remaining > 0
            ? `Submit for review (${remaining} left)`
            : "Submit for review"}
      </button>
      {message && (
        <p role="alert" className="text-sm text-red-400">
          {message}
        </p>
      )}
    </div>
  );
}
