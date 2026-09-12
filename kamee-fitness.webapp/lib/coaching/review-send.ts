import "server-only";

import { parseAllowlist } from "../admin/allowlist";
import type { InviteEmail } from "./invite";
import { sendInviteEmail } from "./invite-send";

/**
 * Best-effort operator notification on profile submit (spec 4.3, ruling
 * R27): one Resend email per address in ADMIN_EMAILS, over the same
 * fetch-based sender and pinned `noreply@` From address as the invite email.
 * NEVER throws -- a submit must not fail over email:
 * - "skipped" when RESEND_API_KEY is unset or ADMIN_EMAILS is empty;
 * - "failed" when at least one send was rejected or errored;
 * - "sent" when every admin was emailed.
 */
export async function sendReviewReadyEmail(
  email: InviteEmail,
): Promise<"sent" | "skipped" | "failed"> {
  if (!process.env.RESEND_API_KEY) return "skipped";
  const admins = parseAllowlist(process.env.ADMIN_EMAILS);
  if (admins.length === 0) return "skipped";

  const results = await Promise.allSettled(admins.map((to) => sendInviteEmail(to, email)));
  return results.every((r) => r.status === "fulfilled" && r.value === "sent") ? "sent" : "failed";
}
