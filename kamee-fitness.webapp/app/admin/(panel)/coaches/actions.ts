"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  coerceCredentialEvidence,
  credentialRowToEvidence,
  describeRpcError,
  isCoachStatusAction,
  isReviewDecision,
  isUuid,
  validateNote,
} from "@/lib/coaching/admin";
import { buildInviteEmail, inviteUrl, siteOrigin } from "@/lib/coaching/invite";
import { sendInviteEmail } from "@/lib/coaching/invite-send";
import { runCredentialVerification } from "@/lib/coaching/verify";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { findUserForInvite, type InviteCandidate } from "./queries";

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

  const url = inviteUrl(token as string, siteOrigin(process.env.SITE_URL));

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

export type SearchResult = {
  ok: boolean;
  candidate?: InviteCandidate | null;
  capped?: boolean;
  error?: string;
};

const MAX_SEARCH_QUERY_LENGTH = 200;

/**
 * M6 (fix round 1): the coaches search moved from a GET `?q=` search param
 * to this POST Server Action so an admin's search-by-email never ends up
 * in the URL (browser history, referrer headers, server access logs), and
 * so a later `revalidatePath("/admin/coaches")` (e.g. after inviting) never
 * silently re-runs the (potentially 4000-user) email scan on page reload --
 * this action only ever runs when an admin explicitly submits the search.
 */
export async function searchCoachCandidate(query: unknown): Promise<SearchResult> {
  await requireAdmin();
  if (typeof query !== "string") return { ok: false, error: "Invalid search query." };
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Enter a username or email to search." };
  if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) {
    return { ok: false, error: "Search query is too long." };
  }

  const { candidate, capped } = await findUserForInvite(trimmed);
  return { ok: true, candidate, capped };
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

  const noteResult = validateNote(note);
  if (!noteResult.ok) return { ok: false, error: noteResult.error };
  const cleanNote = noteResult.value;
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

  const noteResult = validateNote(note);
  if (!noteResult.ok) return { ok: false, error: noteResult.error };
  const cleanNote = noteResult.value;

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

/**
 * Verifies a credential exactly as the admin reviewed it. `expected` is the
 * evidence the page rendered (document_path, title, issuer, issued_year,
 * expires_on), shape-checked here. admin_verify_coaching_credential
 * (migration 20260913100400) receives that evidence and the digest of the
 * document downloaded in this request, locks the credential row, compares,
 * and verifies in one transaction, so an edit at any moment after the page
 * loaded -- before the click, during the download, or just before the call
 * -- is refused with the reload message. The pre-download comparison in
 * runCredentialVerification is only an early exit.
 */
export async function verifyCredential(
  credentialId: unknown,
  expected: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isUuid(credentialId)) return { ok: false, error: "Invalid credential id." };
  const expectedEvidence = coerceCredentialEvidence(expected);
  if (!expectedEvidence) return { ok: false, error: "Invalid credential data." };

  const db = createAdminSupabase();
  // The flow lives in lib/coaching/verify.ts so it can be unit tested. The
  // database function (20260913100400) receives the evidence the admin
  // reviewed plus the digest of the document downloaded here, locks the row,
  // compares, and verifies in one transaction: a coach edit at any moment
  // after the page loaded is refused with evidence_changed.
  const outcome = await runCredentialVerification(
    {
      async readEvidence(id) {
        const { data, error } = await db
          .from("coaching_credentials")
          .select("document_path, title, issuer, issued_year, expires_on, coach_id")
          .eq("id", id)
          .single();
        if (error || !data) return null;
        return { evidence: credentialRowToEvidence(data), coachId: data.coach_id as string };
      },
      async downloadDocument(path) {
        const { data: blob, error } = await db.storage.from("coaching-documents").download(path);
        if (error || !blob) return null;
        return new Uint8Array(await blob.arrayBuffer());
      },
      sha256(bytes) {
        return createHash("sha256").update(bytes).digest("hex");
      },
      async callVerifyRpc(args) {
        const { error } = await db.rpc("admin_verify_coaching_credential", args);
        return { errorMessage: error ? error.message : null };
      },
    },
    { credentialId, actorId: admin.id, expected: expectedEvidence },
  );
  if (!outcome.ok) return { ok: false, error: outcome.error };

  revalidatePath(`/admin/coaches/${outcome.coachId}`);
  return { ok: true };
}
