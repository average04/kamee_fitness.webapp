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
  // Inline styles and presentation tables keep the invitation usable in
  // email clients that strip stylesheets. No images are needed to act on it.
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${SUBJECT}</title></head>
<body style="margin:0;padding:0;background-color:#07090a;color:#eef4f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your invitation to Kamee Coaching. Set up your profile with your invited email address.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#07090a" style="width:100%;background-color:#07090a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
        <tr><td style="padding:0 8px 24px;color:#eef4f0;font-size:28px;font-weight:700;letter-spacing:-1px;">Kamee<span style="color:#7dbe8d;font-size:14px;font-weight:400;letter-spacing:0;"> &nbsp; Coaching</span></td></tr>
        <tr><td bgcolor="#0b1012" style="padding:32px 24px;background-color:#0b1012;border:1px solid #1a2225;border-radius:24px;">
          <h1 style="margin:0 0 24px;color:#eef4f0;font-size:32px;font-weight:600;line-height:1.2;letter-spacing:-1px;">You're invited to coach<br>on Kamee.</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#eef4f0;">Hi ${safeName},</p>
          <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#aab8b9;">You've been invited to publish coaching plans on Kamee. Start by setting up your coach profile.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#7dbe8d" style="border-radius:10px;background-color:#7dbe8d;mso-padding-alt:16px 24px;">
            <a href="${safeUrl}" style="display:inline-block;padding:16px 24px;border:1px solid #7dbe8d;border-radius:10px;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;color:#07090a;">Set up your coach profile</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.65;color:#aab8b9;">Sign in with the email address that received this invitation. Your link works for <strong style="color:#eef4f0;">14 days</strong> and only for that account.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-top:28px;"><div style="border-top:1px solid #1a2225;font-size:1px;line-height:1px;">&nbsp;</div></td></tr></table>
          <p style="margin:24px 0 8px;color:#aab8b9;font-size:12px;line-height:1.6;">If the button doesn't work, copy this link into your browser:</p>
          <p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;overflow-wrap:anywhere;"><a href="${safeUrl}" style="color:#7dbe8d;text-decoration:underline;word-break:break-all;">${safeUrl}</a></p>
        </td></tr>
        <tr><td style="padding:24px 8px;color:#aab8b9;font-size:13px;line-height:1.7;">STRONG and steady wins the race.<br><span style="color:#7dbe8d;">Kamee</span></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: SUBJECT, text, html };
}
