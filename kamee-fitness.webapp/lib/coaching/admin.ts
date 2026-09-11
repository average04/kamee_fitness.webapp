/**
 * Pure validators and error-copy mapping for the admin Coaches Server
 * Actions (app/admin/(panel)/coaches/actions.ts). Every admin Server Action
 * is a public HTTP endpoint once deployed -- these guard `unknown` inputs
 * (not just TS-typed ones) before any RPC call ever runs, and translate the
 * small set of known RPC error messages into admin-facing copy so a raw
 * Postgres/RPC internal string never reaches the UI.
 */

import { MISSING_LABELS } from "./profile";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a syntactically valid UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Decisions accepted by admin_review_coaching_profile. */
export const REVIEW_DECISIONS = ["approved", "changes_requested"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function isReviewDecision(value: unknown): value is ReviewDecision {
  return (
    typeof value === "string" &&
    (REVIEW_DECISIONS as readonly string[]).includes(value)
  );
}

/** Statuses accepted by admin_set_coach_status -- deliberately NOT every CoachStatus (e.g. "in_review"/"none" are hub-internal, never an admin-issued transition). */
export const COACH_STATUS_ACTIONS = ["suspended", "approved", "revoked"] as const;
export type CoachStatusAction = (typeof COACH_STATUS_ACTIONS)[number];

export function isCoachStatusAction(value: unknown): value is CoachStatusAction {
  return (
    typeof value === "string" &&
    (COACH_STATUS_ACTIONS as readonly string[]).includes(value)
  );
}

const MAX_NOTE_LENGTH = 2000;

/** Trims a note and caps it at 2000 chars (matches coaching_reviews.note's CHECK constraint); a non-string input becomes "". */
export function sanitizeNote(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > MAX_NOTE_LENGTH ? s.slice(0, MAX_NOTE_LENGTH) : s;
}

export type RpcErrorContext = "invite" | "review" | "status" | "verify";

/**
 * Maps a known RPC error message to admin-facing copy.
 * `incomplete:<keys>` (from admin_review_coaching_profile's approve path) is
 * expanded via MISSING_LABELS, same convention as the coach-facing hub.
 * `wrong_state` reads differently depending on which action raised it.
 * Anything unrecognized falls back to a generic message -- never echoes the
 * raw RPC/Postgres error text.
 */
export function describeRpcError(message: string, context?: RpcErrorContext): string {
  if (message.startsWith("incomplete:")) {
    const keys = message
      .slice("incomplete:".length)
      .split(",")
      .filter(Boolean);
    return "Profile incomplete: " + keys.map((k) => MISSING_LABELS[k] ?? k).join("; ");
  }

  if (message === "wrong_state") {
    if (context === "review") return "This coach is not waiting for review.";
    if (context === "status") return "That change is not allowed from the current status.";
    return "That action is not allowed from the coach's current status.";
  }

  switch (message) {
    case "user_not_found":
      return "That user could not be found.";
    case "bad_decision":
      return "Invalid review decision.";
    case "bad_status":
      return "Invalid status change.";
    case "not_found":
      return "That credential could not be found.";
    default:
      return "Something went wrong. Please try again.";
  }
}
