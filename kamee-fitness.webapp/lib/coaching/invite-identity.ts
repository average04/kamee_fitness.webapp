import "server-only";
import { createHash } from "node:crypto";
import { createAdminSupabase } from "../supabase/admin";

/** A live 192-bit bearer token permits only this minimal recipient lookup. */
export async function getInviteIdentity(token: string): Promise<{ userId: string; email: string } | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const db = createAdminSupabase();
  const { data: invite, error } = await db.from("coaching_invites")
    .select("user_id, expires_at, revoked_at, accepted_at")
    .eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (error) throw new Error("Could not load this invitation. Please try again.");
  if (!invite || invite.revoked_at || invite.accepted_at || !(Date.parse(invite.expires_at) > Date.now())) return null;
  const { data, error: userError } = await db.auth.admin.getUserById(invite.user_id);
  if (userError) throw new Error("Could not load this invitation. Please try again.");
  return data.user?.email ? { userId: invite.user_id, email: data.user.email } : null;
}
