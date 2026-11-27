import "server-only";
import { getPortalSession } from "./portal-session";
import { resolvePortalDestination, safePortalNext } from "./portal-access";

/** Both OTP and PKCE finish through this server-verified role resolver. */
export async function getSignInDestination(next?: string | null, origin = "https://kamee.fit"): Promise<string> {
  const session = await getPortalSession();
  if (session) return resolvePortalDestination(session, next, origin);
  const continuation = safePortalNext(next, origin);
  return `/login${continuation ? `?next=${encodeURIComponent(continuation)}` : ""}`;
}
