/**
 * Friendlier copy for Supabase Auth's email-code errors on our sign-in forms.
 * Unknown messages pass through unchanged, so nothing is ever hidden.
 */
export function signInErrorMessage(raw: string | null | undefined): string {
  const m = raw ?? "";
  if (/signups? not allowed|user not found/i.test(m)) {
    return "There's no Kamee account with that email. Use the email you sign in with in the Kamee app.";
  }
  if (/rate limit|too many|security purposes/i.test(m)) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  if (/expired|invalid.*(token|otp)|token.*invalid/i.test(m)) {
    return "That code is wrong or has expired. Send a new one and try again.";
  }
  if (/captcha/i.test(m)) {
    return "We couldn't confirm you're human. Reload the page and try again.";
  }
  return m || "Something went wrong. Please try again.";
}
