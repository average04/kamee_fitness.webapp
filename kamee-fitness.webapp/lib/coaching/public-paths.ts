/**
 * Coaching pages a signed-out visitor may open; everything else under
 * /coaching is sent to /login by the proxy. The Coach Terms, so anyone can
 * read them first, and the two invite pages (the emailed link and the one the
 * app's invite notification opens), which show their own sign-in form so a
 * coach is never bounced to a generic page.
 */
export function isPublicCoachingPath(pathname: string): boolean {
  return (
    pathname === "/coaching/terms" ||
    pathname === "/coaching/invite" ||
    /^\/coaching\/invite\/[^/]+$/.test(pathname)
  );
}
