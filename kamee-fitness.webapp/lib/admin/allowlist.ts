/**
 * Pure helpers for the admin email allowlist. Imported by both `proxy.ts`
 * (the request gate) and `lib/admin/auth.ts` (the server-side DAL). Kept
 * dependency-free so the proxy bundle stays lean.
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAllowed(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
