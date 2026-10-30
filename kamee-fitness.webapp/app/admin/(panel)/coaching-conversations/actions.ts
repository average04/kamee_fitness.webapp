"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { validAdminUuid } from "@/lib/coaching/commerce-admin";
import { parseRevision } from "@/lib/coaching/commerce";
import { withDatabaseBusyRetry } from "@/lib/coaching/retry-busy";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type ConversationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
export type ConversationGrantResult = {
  grantId: string;
  enrollmentAttemptId: string;
  revision: string;
};
export type ConversationRevokeResult = { grantId: string; revision: string };

function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  ) {
    throw new Error("Invalid conversation input");
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown): string {
  if (!validAdminUuid(value)) throw new Error("Invalid conversation identity");
  return value.toLowerCase();
}

function revision(value: unknown): string {
  if (typeof value !== "string" || value.length > 19)
    throw new Error("Invalid conversation revision");
  return parseRevision(value);
}

function parseGrantInput(input: unknown) {
  const value = exact(input, [
    "enrollmentAttemptId",
    "policyVersion",
    "contentHash",
  ]);
  const enrollmentAttemptId = uuid(value.enrollmentAttemptId);
  if (
    typeof value.policyVersion !== "string" ||
    value.policyVersion.length > 80 ||
    /^[A-Za-z0-9._-]+$/.exec(value.policyVersion)?.[0] !==
      value.policyVersion ||
    typeof value.contentHash !== "string" ||
    value.contentHash.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(value.contentHash)
  )
    throw new Error("Invalid conversation policy");
  return {
    enrollmentAttemptId,
    policyVersion: value.policyVersion,
    contentHash: value.contentHash,
  };
}

function parseRevokeInput(input: unknown) {
  const value = exact(input, ["grantId", "expectedRevision"]);
  return {
    grantId: uuid(value.grantId),
    expectedRevision: revision(value.expectedRevision),
  };
}

function parseGrantResult(
  input: unknown,
  attemptId: string,
): ConversationGrantResult {
  const value = exact(input, ["grantId", "enrollmentAttemptId", "revision"]);
  const enrollmentAttemptId = uuid(value.enrollmentAttemptId);
  if (enrollmentAttemptId !== attemptId)
    throw new Error("Mismatched conversation attempt");
  return {
    grantId: uuid(value.grantId),
    enrollmentAttemptId,
    revision: revision(value.revision),
  };
}

function parseRevokeResult(
  input: unknown,
  grantId: string,
): ConversationRevokeResult {
  const value = exact(input, ["grantId", "revision"]);
  if (uuid(value.grantId) !== grantId)
    throw new Error("Mismatched conversation grant");
  return { grantId, revision: revision(value.revision) };
}

function actionError(error: unknown): string {
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? error.code
      : null;
  switch (code) {
    case "PT401":
      return "Admin sign-in is required.";
    case "PT403":
    case "42501":
      return "Conversation action is not permitted.";
    case "PT404":
      return "Conversation unavailable.";
    case "PT400":
    case "22023":
      return "Invalid conversation input.";
    case "PT409":
      return "Conversation changed. Refresh and try again.";
    case "PT503":
    case "55P03":
      return "Conversation busy. Retry the same request.";
    default:
      return "Conversation action could not be confirmed.";
  }
}

async function mutate(
  actorId: string,
  rpc: string,
  args: Record<string, string>,
): Promise<unknown> {
  // Callers have already passed requireAdmin. No client, actor or role comes from input.
  const db = createAdminSupabase();
  return withDatabaseBusyRetry(
    async () => {
      const result = await db.rpc(rpc, args);
      if (result.error) throw result.error;
      return result.data;
    },
    async () => {
      const current = await requireAdmin();
      if (current.id !== actorId) throw new Error("Admin account changed");
    },
  );
}

export async function grantConversation(
  input: unknown,
): Promise<ConversationActionResult<ConversationGrantResult>> {
  const actor = await requireAdmin();
  let value;
  try {
    value = parseGrantInput(input);
  } catch {
    return { ok: false, error: "Invalid conversation input." };
  }
  try {
    const data = await mutate(actor.id, "admin_grant_coaching_conversation", {
      p_actor_id: actor.id,
      p_attempt_id: value.enrollmentAttemptId,
      p_policy_version: value.policyVersion,
      p_policy_hash: value.contentHash,
    });
    return {
      ok: true,
      data: parseGrantResult(data, value.enrollmentAttemptId),
    };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function revokeConversation(
  input: unknown,
): Promise<ConversationActionResult<ConversationRevokeResult>> {
  const actor = await requireAdmin();
  let value;
  try {
    value = parseRevokeInput(input);
  } catch {
    return { ok: false, error: "Invalid conversation input." };
  }
  try {
    const data = await mutate(actor.id, "admin_revoke_coaching_conversation", {
      p_actor_id: actor.id,
      p_grant_id: value.grantId,
      p_expected_revision: value.expectedRevision,
    });
    return { ok: true, data: parseRevokeResult(data, value.grantId) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
