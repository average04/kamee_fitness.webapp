/** Limit editor submissions without changing previously stored account names. */
export function validateDisplayName(raw: unknown): { name: string } | { message: string } {
  if (typeof raw !== "string" || !raw.trim() || raw.includes("\u0000")) {
    return { message: "Enter your display name." };
  }
  const name = raw.trim();
  if (name.length > 120) return { message: "Use 120 characters or fewer for your display name." };
  return { name };
}
