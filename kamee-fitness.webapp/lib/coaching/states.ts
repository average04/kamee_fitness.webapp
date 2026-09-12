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

/** Human label for every coach_status value -- shared by the admin status pill and the coach hub header. */
export const COACH_STATUS_LABEL: Record<CoachStatus, string> = {
  none: "None",
  pending: "Pending",
  rejected: "Rejected",
  invited: "Invited",
  onboarding: "Onboarding",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  suspended: "Suspended",
  revoked: "Revoked",
};
