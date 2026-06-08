"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Result = { ok: boolean; error?: string };

/**
 * Wraps a tree-mutation Server Action: runs it in a transition, alerts on
 * failure, and refreshes the server-rendered tree on success. Shared by every
 * builder control.
 */
export function useTreeAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) window.alert(r.error ?? "Action failed.");
      router.refresh();
    });
  return { pending, run };
}
