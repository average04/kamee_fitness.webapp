export type CoachStatus =
  | "none"
  | "pending"
  | "rejected"
  | "invited"
  | "onboarding"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "suspended"
  | "revoked";

/** Statuses that may access the Coaching Hub itself (post-invite lifecycle). */
export const HUB_STATES: CoachStatus[] = [
  "onboarding",
  "in_review",
  "changes_requested",
  "approved",
  "suspended",
];

export function isHubState(s: string | null | undefined): s is CoachStatus {
  return !!s && (HUB_STATES as string[]).includes(s);
}
