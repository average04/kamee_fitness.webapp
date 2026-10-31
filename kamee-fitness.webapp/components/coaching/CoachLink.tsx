"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

/** Reads Next's actual transition state from inside the corresponding Link. */
function NavigationFeedback() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  const feedback = (
    <span className="coach-navigation-feedback" role="status" aria-live="polite">
      <span className="coach-navigation-trail" aria-hidden="true" />
      <span className="coach-loading-announcement">Loading…</span>
    </span>
  );
  // Dashboard panels use CSS containment; keep the indicator at the viewport.
  return typeof document === "undefined" ? feedback : createPortal(feedback, document.body);
}

/** Preserve normal Link behavior, including prefetch, new tabs and cancellation. */
export function CoachLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationFeedback /></Link>;
}
