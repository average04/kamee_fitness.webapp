import type { User } from "@supabase/supabase-js";
import { isPublicCoachingPath } from "@/lib/coaching/public-paths";
import { isHubState, type CoachStatus } from "@/lib/coaching/states";
import { safeNextPath } from "@/lib/safe-next";

export type ProfileRole = "user" | "coach" | "admin";

/** Server-verified capabilities. Pass only the navigation fields to clients. */
export type PortalSession = {
  user: User;
  profileRole: ProfileRole | null;
  coachStatus: CoachStatus;
  isAdmin: boolean;
  canUseCoachHub: boolean;
  defaultDestination: string;
};

type PortalAccess = Pick<PortalSession, "isAdmin" | "canUseCoachHub" | "coachStatus" | "defaultDestination">;

function under(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function isAuthPath(pathname: string): boolean {
  return under(pathname, "/auth") || under(pathname, "/login") || under(pathname, "/admin/login");
}

/** Keep untrusted continuation values local and out of sign-in loops. */
export function safePortalNext(next: string | null | undefined, origin: string): string | null {
  const path = safeNextPath(next, origin, "");
  if (!path || isAuthPath(new URL(path, origin).pathname)) return null;
  return path;
}

/** Every destination still has its own DAL/action authorization gate. */
export function resolvePortalDestination(access: PortalAccess, next: string | null | undefined, origin: string): string {
  const path = safePortalNext(next, origin);
  if (!path) return access.defaultDestination;
  const { pathname } = new URL(path, origin);
  if (under(pathname, "/admin")) return access.isAdmin ? path : access.defaultDestination;
  if (under(pathname, "/coaching") && !isPublicCoachingPath(pathname)) {
    if (!access.canUseCoachHub) return access.defaultDestination;
    // Unapproved coaches continue setup; business pages require approval.
    const setupPath = ["/coaching/profile", "/coaching/onboarding", "/coaching/credentials", "/coaching/gallery", "/coaching/videos", "/coaching/preview"]
      .some((root) => under(pathname, root));
    if (access.coachStatus !== "approved" && pathname !== "/coaching" && !setupPath) return access.defaultDestination;
  }
  return path;
}

export function portalDefaultDestination(isAdmin: boolean, role: ProfileRole | null, status: CoachStatus): string {
  if (isAdmin) return "/admin";
  // Invitations precede role acceptance in the existing lifecycle.
  if (status === "invited") return "/coaching/invite";
  if (role === "coach" && status === "approved") return "/coaching/dashboard";
  if (role === "coach" && isHubState(status)) return "/coaching/profile";
  return "/me";
}
