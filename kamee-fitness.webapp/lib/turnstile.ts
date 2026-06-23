import "server-only";

/**
 * Verify a Cloudflare Turnstile token server-side. Fails closed.
 * `remoteip` binds the token to the solving IP (optional but recommended —
 * raises the cost of token relay/farming).
 */
export async function verifyTurnstile(
  token: string | null,
  remoteip?: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  const params = new URLSearchParams({ secret, response: token });
  if (remoteip && remoteip !== "unknown") params.set("remoteip", remoteip);
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    },
  );
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}
