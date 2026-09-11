import "server-only";

import type { InviteEmail } from "./invite";

/**
 * R22: proven in production by the app repo's scripts/gift-premium.mjs --
 * the working Resend sender for kamee.fit mail is noreply@, not hello@.
 */
const FROM = "KAMEE Fitness <noreply@kamee.fit>";

/**
 * Sends the coach invite email via Resend's HTTP API (no SDK dependency --
 * global-constraints forbids new npm deps). Returns "skipped" (never
 * throws) when RESEND_API_KEY is unset, so the caller can fall back to
 * showing the copyable invite URL instead of erroring the whole action. A
 * non-2xx response from Resend throws; `inviteCoach` catches it and reports
 * `emailed: false` without surfacing the raw error.
 */
export async function sendInviteEmail(
  to: string,
  email: InviteEmail,
): Promise<"sent" | "skipped"> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "skipped";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded with ${res.status}`);
  }
  return "sent";
}
