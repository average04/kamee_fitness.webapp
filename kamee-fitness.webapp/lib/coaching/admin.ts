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

export type NoteValidation = { ok: true; value: string } | { ok: false; error: string };

/**
 * Trims a note and REJECTS (fix round 1, M5 -- rather than silently
 * truncating) anything over 2000 chars, matching coaching_reviews.note's
 * CHECK constraint exactly so a rejected note here can never be accepted
 * and then fail at the RPC anyway. A non-string input (including
 * undefined/null) is treated as an empty, valid note -- notes are always
 * optional except for `changes_requested`, which is enforced by the caller.
 */
export function validateNote(value: unknown): NoteValidation {
  const raw = typeof value === "string" ? value : "";
  const trimmed = raw.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export type CredentialEvidence = {
  documentPath: string | null;
  title: string;
  issuer: string;
  issuedYear: number | null;
  expiresOn: string | null;
};

/** Normalizes a date-ish string to its YYYY-MM-DD prefix so a `date` column value and a full ISO timestamp for the same calendar day compare equal instead of falsely mismatching on formatting alone. */
function normalizeDateOnly(value: string | null): string | null {
  if (value === null) return null;
  return value.length > 10 ? value.slice(0, 10) : value;
}

/**
 * Fix round 1, I1: closes the TOCTOU window between an admin loading the
 * coach detail page and clicking Verify. `expected` is the evidence the
 * page rendered (sent back by the client); `actual` is a fresh service-role
 * read taken immediately before hashing. True only when every field the
 * admin actually looked at -- `document_path` (including its absence),
 * `title`, `issuer`, `issued_year`, and `expires_on` (compared as a date,
 * not a raw string) -- is still identical. `verifyCredential` refuses to
 * attest anything when this returns false.
 */
export function credentialEvidenceMatches(
  expected: CredentialEvidence,
  actual: CredentialEvidence,
): boolean {
  return (
    expected.documentPath === actual.documentPath &&
    expected.title === actual.title &&
    expected.issuer === actual.issuer &&
    expected.issuedYear === actual.issuedYear &&
    normalizeDateOnly(expected.expiresOn) === normalizeDateOnly(actual.expiresOn)
  );
}

/** `null` passes through as `null`; a string passes through as-is; anything else (including `undefined`) signals "wrong shape" via the literal `undefined` return, distinguishable from a legitimate `null`. */
function nullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

/**
 * Server-side shape guard for the `expected` evidence object a client sends
 * to `verifyCredential`. Server Actions are public endpoints -- this is a
 * security-relevant comparison input, so the caller's object shape is never
 * trusted before `credentialEvidenceMatches` runs on it. Returns `null` on
 * any mismatch (wrong type, missing field); the action treats that as
 * "could not verify" without touching the database.
 */
export function coerceCredentialEvidence(raw: unknown): CredentialEvidence | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const documentPath = nullableString(r.documentPath);
  if (documentPath === undefined) return null;
  if (typeof r.title !== "string") return null;
  if (typeof r.issuer !== "string") return null;

  let issuedYear: number | null;
  if (r.issuedYear === null) {
    issuedYear = null;
  } else if (typeof r.issuedYear === "number" && Number.isFinite(r.issuedYear)) {
    issuedYear = r.issuedYear;
  } else {
    return null;
  }

  const expiresOn = nullableString(r.expiresOn);
  if (expiresOn === undefined) return null;

  return { documentPath, title: r.title, issuer: r.issuer, issuedYear, expiresOn };
}

/** Shown to the admin whenever a fresh re-read of a credential's evidence no longer matches what the page rendered -- both the initial mismatch check and the post-download document_path recheck use this exact copy. */
export const CREDENTIAL_EVIDENCE_CHANGED_MESSAGE =
  "This credential changed since you opened the page. Reload and review it again.";

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
