"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/coaching/invite/actions";
import type { FormState } from "@/lib/coaching/profile";

export function AcceptInvite({ token }: { token?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    acceptInvite,
    {},
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {token && <input type="hidden" name="token" value={token} />}
      {state.message && <p className="text-sm text-red-400">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-leaf-600 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
      >
        {pending ? "Accepting…" : "Accept and start onboarding"}
      </button>
    </form>
  );
}
