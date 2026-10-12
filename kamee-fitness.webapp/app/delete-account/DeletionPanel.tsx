"use client";

import { useActionState, useId } from "react";
import { formatPurgeDate } from "@/lib/account-deletion";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  signOutFromDeletion,
  type DeletionActionState,
} from "./actions";

/** Signed-in half of /delete-account: confirm a new request, or show/cancel a pending one. */
export function DeletionPanel({
  email,
  pendingPurgeAfter,
}: {
  email: string;
  pendingPurgeAfter: string | null;
}) {
  const confirmId = useId();
  const [requestState, requestAction, requesting] = useActionState<DeletionActionState, FormData>(
    requestAccountDeletion,
    null,
  );
  const [cancelState, cancelAction, cancelling] = useActionState<DeletionActionState, FormData>(
    cancelAccountDeletion,
    null,
  );

  if (requestState?.ok) {
    const date = formatPurgeDate(requestState.purgeAfter);
    return (
      <div className="rounded-xl border border-leaf-700 bg-leaf-950/30 px-5 py-4 text-leaf-300 text-sm leading-relaxed">
        Your account is scheduled for deletion{date ? ` on ${date}` : " in 30 days"}. You&rsquo;ve been signed
        out. To cancel, sign in again (here or in the app) before then.
      </div>
    );
  }

  const signOut = (
    <form action={signOutFromDeletion}>
      <button type="submit" className="text-sm text-ink-400 underline hover:text-leaf-400">
        Not you? Sign out
      </button>
    </form>
  );

  if (pendingPurgeAfter) {
    const date = formatPurgeDate(pendingPurgeAfter);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm text-ink-300 leading-relaxed">
          Signed in as <span className="text-ink-100 font-medium">{email}</span>. Deletion is already
          scheduled{date ? ` for ${date}` : ""}. Cancel below to keep your account.
        </div>
        {cancelState && !cancelState.ok && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{cancelState.error}</p>
        )}
        <form action={cancelAction}>
          <button
            type="submit"
            disabled={cancelling}
            className="w-full rounded-lg bg-leaf-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-leaf-500 transition-colors"
          >
            {cancelling ? "Cancelling…" : "Cancel deletion and keep my account"}
          </button>
        </form>
        {signOut}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-300">
        Signed in as <span className="text-ink-100 font-medium">{email}</span>.
      </p>
      <form action={requestAction} className="space-y-4">
        {requestState && !requestState.ok && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{requestState.error}</p>
        )}
        <div>
          <label htmlFor={confirmId} className="block text-sm font-medium text-ink-300 mb-1">
            Type <span className="font-mono text-ink-100">DELETE</span> to confirm
          </label>
          <input
            id={confirmId}
            name="confirm"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-leaf-600"
          />
        </div>
        <button
          type="submit"
          disabled={requesting}
          className="w-full rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-red-600 transition-colors"
        >
          {requesting ? "Scheduling…" : "Delete my account"}
        </button>
        <p className="text-xs text-ink-500">
          Your account and all data are permanently deleted 30 days after you confirm.
        </p>
      </form>
      {signOut}
    </div>
  );
}
