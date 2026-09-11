"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  describeRpcError,
  isCoachStatusAction,
  isReviewDecision,
  isUuid,
  sanitizeNote,
} from "@/lib/coaching/admin";
import { buildInviteEmail, inviteUrl } from "@/lib/coaching/invite";
import { sendInviteEmail } from "@/lib/coaching/invite-send";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type InviteResult = {
  ok: boolean;
  url?: string;
  emailed?: boolean;
  error?: string;
};

/**
 * Invites (or re-invites) a user to coach. Every argument here is `unknown`
 * at the type level even though callers only ever pass a string -- this is
 * a public Server Action endpoint, not just a typed function call, so the
 * shape is checked before anything touches the database.
 */
export async function inviteCoach(userId: unknown): Promise<InviteResult> {
  const admin = await requireAdmin();
  if (!isUuid(userId)) return { ok: false, error: "Invalid user id." };

  const db = createAdminSupabase();
  const { data: token, error } = await db.rpc("admin_invite_coach", {
    p_user: userId,
    p_actor: admin.id,
  });
  if (error) return { ok: false, error: describeRpcError(error.message, "invite") };

  const url = inviteUrl(token as string);

  const [{ data: u }, { data: p }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from("profiles").select("display_name").eq("id", userId).single(),
  ]);

  let emailed = false;
  if (u?.user?.email) {
    try {
      const result = await sendInviteEmail(
        u.user.email,
        buildInviteEmail(p?.display_name ?? null, url),
      );
      emailed = result === "sent";
    } catch {
      // sendInviteEmail's own "skipped" path never throws; a throw here
      // means the Resend call itself failed. Either way the admin still
      // gets the copyable URL -- never fail the whole action over email.
      emailed = false;
    }
  }

  revalidatePath(`/admin/coaches/${userId}`);
  revalidatePath("/admin/coaches");
  return { ok: true, url, emailed };
}

export type ActionResult = { ok: boolean; error?: string };

export async function reviewCoach(
  userId: unknown,
  decision: unknown,
  note: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isUuid(userId)) return { ok: false, error: "Invalid user id." };
  if (!isReviewDecision(decision)) return { ok: false, error: "Invalid review decision." };

  const cleanNote = sanitizeNote(note);
  if (decision === "changes_requested" && !cleanNote) {
    return { ok: false, error: "Add a note telling the coach what to change." };
  }

  const db = createAdminSupabase();
  const { error } = await db.rpc("admin_review_coaching_profile", {
    p_user: userId,
    p_actor: admin.id,
    p_decision: decision,
    p_note: cleanNote,
  });
  if (error) return { ok: false, error: describeRpcError(error.message, "review") };

  revalidatePath(`/admin/coaches/${userId}`);
  revalidatePath("/admin/coaches");
  return { ok: true };
}

export async function setCoachStatus(
  userId: unknown,
  status: unknown,
  note: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isUuid(userId)) return { ok: false, error: "Invalid user id." };
  if (!isCoachStatusAction(status)) return { ok: false, error: "Invalid status." };

  const cleanNote = sanitizeNote(note);
  const db = createAdminSupabase();
  const { error } = await db.rpc("admin_set_coach_status", {
    p_user: userId,
    p_actor: admin.id,
    p_status: status,
    p_note: cleanNote,
  });
  if (error) return { ok: false, error: describeRpcError(error.message, "status") };

  revalidatePath(`/admin/coaches/${userId}`);
  revalidatePath("/admin/coaches");
  return { ok: true };
}

export async function verifyCredential(credentialId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isUuid(credentialId)) return { ok: false, error: "Invalid credential id." };

  const db = createAdminSupabase();
  const { data: c, error: fetchError } = await db
    .from("coaching_credentials")
    .select("document_path, coach_id")
    .eq("id", credentialId)
    .single();
  if (fetchError || !c) return { ok: false, error: "That credential could not be found." };

  let sha: string | null = null;
  if (c.document_path) {
    const { data: blob, error: dlError } = await db.storage
      .from("coaching-documents")
      .download(c.document_path);
    if (dlError || !blob) return { ok: false, error: "Document download failed." };
    const buf = Buffer.from(await blob.arrayBuffer());
    sha = createHash("sha256").update(buf).digest("hex");
  }

  const { error } = await db.rpc("admin_verify_coaching_credential", {
    p_id: credentialId,
    p_actor: admin.id,
    p_document_sha256: sha,
  });
  if (error) return { ok: false, error: describeRpcError(error.message, "verify") };

  revalidatePath(`/admin/coaches/${c.coach_id}`);
  return { ok: true };
}
