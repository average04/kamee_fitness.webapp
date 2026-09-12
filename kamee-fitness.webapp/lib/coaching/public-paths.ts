/**
 * Coaching pages a signed-out visitor may open; everything else under
 * /coaching is sent to /login by the proxy. The Coach Terms, so anyone can
 * read them first, and an invite link, which shows its own sign-in form so a
 * coach who taps the link from an email is never bounced to a generic page.
 */
export function isPublicCoachingPath(pathname: string): boolean {
  return pathname === "/coaching/terms" || /^\/coaching\/invite\/[^/]+$/.test(pathname);
}
