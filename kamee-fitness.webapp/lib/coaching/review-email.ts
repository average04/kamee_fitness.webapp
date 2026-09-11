/**
 * Pure builder for the operator email sent when a coach submits their profile
 * for review (spec 4.3, ruling R27). No I/O and no `server-only` guard, so
 * vitest can import it; the send lives in `./review-send`.
 */
import { escapeHtml, type InviteEmail } from "./invite";

export function adminCoachUrl(userId: string): string {
  return `https://kamee.fit/admin/coaches/${userId}`;
}

const SUBJECT = "Coach profile ready for review";

export function buildReviewReadyEmail(displayName: string | null, userId: string): InviteEmail {
  const name = displayName && displayName.trim() ? displayName.trim() : "A coach";
  const url = adminCoachUrl(userId);

  const text =
    `${name} submitted their coach profile for review.\n\n` +
    "Review it here:\n" +
    `${url}\n`;

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const html =
    `<p>${safeName} submitted their coach profile for review.</p>` +
    `<p>Review it here: <a href="${safeUrl}">${safeUrl}</a></p>`;

  return { subject: SUBJECT, text, html };
}
