/**
 * Coach Terms acceptance: pure helpers shared by the hub page, the
 * acceptCoachTerms Server Action and their tests. No I/O.
 *
 * The database is the authority. accept_coaching_terms (migration
 * 20260913100600) stamps now() and the current version server-side, and
 * clients cannot write terms_accepted_at or terms_version directly. These
 * helpers only decide what to show and which version to send.
 */

/** Same shape the database check constraint enforces. */
export const TERMS_VERSION_RE = /^\d{4}-\d{2}-\d{2}(\.\d+)?$/;

export function isTermsVersion(v: unknown): v is string {
  return typeof v === "string" && v.length <= 20 && TERMS_VERSION_RE.test(v);
}

/** The row in coaching_terms_versions with is_current = true, if any. */
export type CurrentCoachTerms = { version: string; url: string; publishedAt: string };

export type CoachTermsState =
  /** Nothing to accept yet: no published version, the deployed text is a
   *  draft, or the deployed text is a different version from the published
   *  one (a deploy and a publish are out of step). */
  | { kind: "unavailable" }
  | { kind: "accepted"; version: string; acceptedAt: string }
  /** Never accepted, or accepted before this version was published. */
  | { kind: "needs_acceptance"; version: string; previous: { version: string | null; acceptedAt: string } | null };

export function coachTermsState(
  row: { terms_accepted_at: string | null; terms_version: string | null },
  current: CurrentCoachTerms | null,
  deployed: { version: string; draft: boolean },
): CoachTermsState {
  if (!current || deployed.draft || current.version !== deployed.version) {
    return { kind: "unavailable" };
  }
  if (row.terms_accepted_at && row.terms_version === current.version) {
    return { kind: "accepted", version: current.version, acceptedAt: row.terms_accepted_at };
  }
  return {
    kind: "needs_acceptance",
    version: current.version,
    previous: row.terms_accepted_at
      ? { version: row.terms_version, acceptedAt: row.terms_accepted_at }
      : null,
  };
}

/** Maps the RPC's raised error text to coach-facing copy. */
export function acceptTermsErrorMessage(dbMessage: string | null | undefined): string {
  const m = dbMessage ?? "";
  if (m.includes("terms_outdated")) {
    return "The coach terms were just updated. Reload the page to read the new version.";
  }
  if (m.includes("terms_unavailable")) {
    return "The coach terms are not open for acceptance yet.";
  }
  if (m.includes("not_editable")) {
    return "Your profile is in review, so changes are paused.";
  }
  return "Could not record your acceptance. Please retry.";
}
