/** Shared email validation for the public, unauthenticated endpoints. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 320 && EMAIL_RE.test(value);
}
