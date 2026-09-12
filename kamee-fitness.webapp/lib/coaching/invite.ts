/**
 * Pure builders for the coach invite flow: the public invite URL and the
 * invite email's copy (subject/text/html). No I/O here -- kept free of the
 * `server-only` guard (unlike `./invite-send`) so vitest can import this
 * module directly. The actual network call to Resend lives in
 * `./invite-send` (`sendInviteEmail`), which does carry `import "server-only"`.
 */

export const PRODUCTION_ORIGIN = "https://kamee.fit";

/**
 * Origin for links we hand out. SITE_URL lets a local dev server hand out
 * localhost links (set in .env.development.local); anything missing or not a
 * bare http(s) origin falls back to production, so a typo can never produce
 * a broken or foreign link.
 */
export function siteOrigin(raw: string | undefined): string {
  if (!raw) return PRODUCTION_ORIGIN;
  try {
    const u = new URL(raw);
    const bare = u.pathname === "/" && !u.search && !u.hash && !u.username && !u.password;
    if ((u.protocol === "https:" || u.protocol === "http:") && bare) return u.origin;
  } catch {
    /* fall through */
  }
  return PRODUCTION_ORIGIN;
}

export function inviteUrl(token: string, origin: string = PRODUCTION_ORIGIN): string {
  return `${origin}/coaching/invite/${token}`;
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
