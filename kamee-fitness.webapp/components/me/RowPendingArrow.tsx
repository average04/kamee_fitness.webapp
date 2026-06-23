"use client";

import { useLinkStatus } from "next/link";

/**
 * Trailing affordance for a clickable row. Shows the usual "→" until its parent
 * <Link> is navigating, then an instant spinner — so a click gives immediate
 * feedback even while a dynamic route is still compiling/fetching (when the
 * route-level loading.tsx fallback can't paint yet). Must render inside a
 * next/link <Link>. Fixed-size slot to avoid layout shift.
 */
export default function RowPendingArrow() {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex size-4 items-center justify-center text-muted">
      {pending ? (
        <span
          aria-label="Loading"
          role="status"
          className="size-3.5 animate-spin rounded-full border-2 border-leaf-400/30 border-t-leaf-400 motion-reduce:animate-none"
        />
      ) : (
        <span aria-hidden>→</span>
      )}
    </span>
  );
}
