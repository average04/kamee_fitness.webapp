/** Shared date formatting for the admin Coaches pages. */

export function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}
