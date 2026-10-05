/**
 * Pure helpers for the web account-deletion page. The request itself goes
 * through the signed-in user's own session (account_deletion_requests RLS:
 * insert/select/delete own row), exactly like the app.
 */

/** The confirmation the user types, matching the app's type-to-confirm. */
export function isDeleteConfirmation(value: unknown): boolean {
  return typeof value === "string" && value.trim() === "DELETE";
}

/** "November 4, 2026", always in UTC so the server render and the browser agree. */
export function formatPurgeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
