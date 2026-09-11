/**
 * Pure builders for the coach invite flow: the public invite URL and the
 * invite email's copy (subject/text/html). No I/O here -- kept free of the
 * `server-only` guard (unlike `./invite-send`) so vitest can import this
 * module directly. The actual network call to Resend lives in
 * `./invite-send` (`sendInviteEmail`), which does carry `import "server-only"`.
 */

export function inviteUrl(token: string): string {
  return `https://kamee.fit/coaching/invite/${token}`;
}

export type InviteEmail = { subject: string; text: string; html: string };

/** Minimal HTML entity escaping -- the display name is attacker-controlled (a profile field), so it must never be interpolated raw into the html body. Shared with ./review-email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SUBJECT = "You're invited to coach on Kamee";

export function buildInviteEmail(displayName: string | null, url: string): InviteEmail {
  const name = displayName && displayName.trim() ? displayName.trim() : "there";

  const text =
    `Hi ${name},\n\n` +
    "You've been invited to publish coaching plans on Kamee. Set up your coach profile here:\n" +
    `${url}\n\n` +
    "The link works for 14 days and only for the account with this email.\n\n" +
    "STRONG and steady wins the race.\n" +
    "Kamee";

  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);
  const html =
    `<p>Hi ${safeName},</p>` +
    "<p>You've been invited to publish coaching plans on Kamee. Set up your coach profile here:</p>" +
    `<p><a href="${safeUrl}">${safeUrl}</a></p>` +
    "<p>The link works for 14 days and only for the account with this email.</p>" +
    "<p>STRONG and steady wins the race.<br>Kamee</p>";

  return { subject: SUBJECT, text, html };
}
