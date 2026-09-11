"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  coerceCredentialEvidence,
  credentialEvidenceMatches,
  credentialRowToEvidence,
  CREDENTIAL_EVIDENCE_CHANGED_MESSAGE,
  describeRpcError,
  isCoachStatusAction,
  isReviewDecision,
  isUuid,
  validateNote,
} from "@/lib/coaching/admin";
import { buildInviteEmail, inviteUrl } from "@/lib/coaching/invite";
import { sendInviteEmail } from "@/lib/coaching/invite-send";
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
 * I1: narrows the TOCTOU window between an admin loading the coach detail
 * page and clicking Verify. `expected` is the evidence the page actually
 * rendered (document_path, title, issuer, issued_year, expires_on). The row
 * is read fresh with the service role and compared against `expected`
 * BEFORE the document download, then read and compared IN FULL again AFTER
 * the download -- the download can take seconds, and a coach could edit
 * any evidence field (not only the document) while it is in flight. Any
 * mismatch refuses with the reload message.
 *
 * What remains is the gap between that final re-read and the RPC call (one
 * round trip, no download in between). admin_verify_coaching_credential
 * computes the evidence hash from the row it sees at that moment, so an
 * edit landing inside that gap would be attested unseen; closing it needs
 * the RPC to take an expected evidence hash (deferred DB change, R24).
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
  const { data: row, error: fetchError } = await db
    .from("coaching_credentials")
    .select("document_path, title, issuer, issued_year, expires_on, coach_id")
    .eq("id", credentialId)
    .single();
  if (fetchError || !row) return { ok: false, error: "That credential could not be found." };

  const actualEvidence = credentialRowToEvidence(row);
  if (!credentialEvidenceMatches(expectedEvidence, actualEvidence)) {
    return { ok: false, error: CREDENTIAL_EVIDENCE_CHANGED_MESSAGE };
  }

  let sha: string | null = null;
  if (actualEvidence.documentPath) {
    const { data: blob, error: dlError } = await db.storage
      .from("coaching-documents")
      .download(actualEvidence.documentPath);
    if (dlError || !blob) return { ok: false, error: "Document download failed." };
    const buf = Buffer.from(await blob.arrayBuffer());
    sha = createHash("sha256").update(buf).digest("hex");

    // Re-read the FULL evidence once more after the download completes --
    // the (slow, network-bound) download is a window of seconds in which a
    // coach could replace the document or edit title/issuer/dates, which
    // would otherwise let evidence the admin never saw be attested.
    const { data: recheck, error: recheckError } = await db
      .from("coaching_credentials")
      .select("document_path, title, issuer, issued_year, expires_on")
      .eq("id", credentialId)
      .single();
    if (
      recheckError ||
      !recheck ||
      !credentialEvidenceMatches(expectedEvidence, credentialRowToEvidence(recheck))
    ) {
      return { ok: false, error: CREDENTIAL_EVIDENCE_CHANGED_MESSAGE };
    }
  }

  const { error } = await db.rpc("admin_verify_coaching_credential", {
    p_id: credentialId,
    p_actor: admin.id,
    p_document_sha256: sha,
  });
  if (error) return { ok: false, error: describeRpcError(error.message, "verify") };

  revalidatePath(`/admin/coaches/${row.coach_id}`);
  return { ok: true };
}
