/**
 * Shared display copy for coach_status and coaching_reviews.decision values,
 * used by both the coaches list and detail pages (and, since it has no
 * hooks or "use client" directive, safe to import from client components
 * too -- it's just plain data plus a pure function component).
 */

import { COACH_STATUS_LABEL } from "@/lib/coaching/states";

/** The one coach_status label map (lib/coaching/states), also used by the coach hub header. */
export const STATUS_LABEL: Record<string, string> = COACH_STATUS_LABEL;

const STATUS_CLASS: Record<string, string> = {
  none: "bg-zinc-800 text-zinc-400",
  pending: "bg-zinc-800 text-zinc-400",
  rejected: "bg-red-950 text-red-400",
  invited: "bg-sky-950 text-sky-400",
  onboarding: "bg-sky-950 text-sky-400",
  in_review: "bg-amber-950 text-amber-400",
  changes_requested: "bg-amber-950 text-amber-400",
  approved: "bg-emerald-950 text-emerald-400",
  suspended: "bg-orange-950 text-orange-400",
  revoked: "bg-red-950 text-red-400",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status] ?? "bg-zinc-800 text-zinc-400"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** M8 (fix round 1): human labels for coaching_reviews.decision, shown in the review history list instead of the raw enum value. */
export const REVIEW_DECISION_LABEL: Record<string, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  suspended: "Suspended",
  reinstated: "Reinstated",
  revoked: "Revoked",
};
