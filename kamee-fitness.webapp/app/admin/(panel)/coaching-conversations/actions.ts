"use server";

import { unstable_rethrow } from "next/navigation";
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
export type ConversationCaseCategory =
  | "harassment"
  | "unsafe_advice"
  | "privacy"
  | "other";
export type ConversationCaseStatus = "open" | "resolved";
type MessageIdentity = { id: string; sequence: string; createdAt: string };
export type ConversationCaseMessage = MessageIdentity &
  (
    | { kind: "text"; author: "buyer" | "coach"; body: string }
    | { kind: "system"; event: "opened" | "suspended" | "resumed" | "closed" }
    | { kind: "removed" }
  );
export type ConversationCaseListResult = {
  items: {
    caseId: string;
    category: ConversationCaseCategory;
    status: ConversationCaseStatus;
    createdAt: string;
  }[];
  nextAfterId: string | null;
};
export type ConversationCaseResult = {
  caseId: string;
  category: ConversationCaseCategory;
  status: ConversationCaseStatus;
  messages: ConversationCaseMessage[];
};
export type ConversationCaseResolution = {
  caseId: string;
  status: ConversationCaseStatus;
};

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

function oneOf<const T extends readonly string[]>(
  value: unknown,
  options: T,
): T[number] {
  if (typeof value !== "string" || !options.includes(value))
    throw new Error("Invalid conversation value");
  return value as T[number];
}
const category = (value: unknown): ConversationCaseCategory =>
  oneOf(value, ["harassment", "unsafe_advice", "privacy", "other"]);
const caseStatus = (value: unknown): ConversationCaseStatus =>
  oneOf(value, ["open", "resolved"]);

// C1a's exact UTC grammar and calendar round trip. Preserve server fractional
// precision; Date.parse alone normalizes impossible dates and 24:00:00.
function timestamp(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Invalid conversation timestamp");
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.[0-9]+)?(?:Z|\+00:00)$/.exec(
      value,
    );
  if (!match || match[0] !== value)
    throw new Error("Invalid conversation timestamp");
  const milliseconds = Date.parse(`${match[1]}Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 19) !== match[1]
  )
    throw new Error("Invalid conversation timestamp");
  return value;
}

function messageText(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4000 ||
    !/\S/u.test(value) ||
    value.includes("\0")
  )
    throw new Error("Invalid conversation text");
  let points = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if ((point >= 0xd800 && point <= 0xdfff) || ++points > 2000)
      throw new Error("Invalid conversation text");
  }
  if (Buffer.byteLength(value, "utf8") > 8000)
    throw new Error("Invalid conversation text");
  return value;
}

function parseCaseMessage(input: unknown): ConversationCaseMessage {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !("kind" in input)
  )
    throw new Error("Invalid conversation message");
  const kind = oneOf(input.kind, ["text", "system", "removed"]);
  const value = exact(input, [
    "id",
    "sequence",
    "createdAt",
    "kind",
    ...(kind === "text"
      ? ["author", "body"]
      : kind === "system"
        ? ["event"]
        : []),
  ]);
  const sequence = revision(value.sequence);
  if (sequence === "0") throw new Error("Invalid conversation sequence");
  const identity = {
    id: uuid(value.id),
    sequence,
    createdAt: timestamp(value.createdAt),
  };
  if (kind === "text")
    return {
      ...identity,
      kind,
      author: oneOf(value.author, ["buyer", "coach"]),
      body: messageText(value.body),
    };
  if (kind === "system")
    return {
      ...identity,
      kind,
      event: oneOf(value.event, ["opened", "suspended", "resumed", "closed"]),
    };
  return { ...identity, kind };
}

function parseCaseListInput(input: unknown) {
  const value = exact(input, ["afterId"]);
  return { afterId: value.afterId === null ? null : uuid(value.afterId) };
}
function parseCaseInput(input: unknown) {
  return { caseId: uuid(exact(input, ["caseId"]).caseId) };
}
function parseResolutionInput(input: unknown) {
  const value = exact(input, ["caseId", "action"]);
  return {
    caseId: uuid(value.caseId),
    action: oneOf(value.action, ["remove", "restrict", "resolve"]),
  };
}

function parseCaseListResult(
  input: unknown,
  afterId: string | null,
): ConversationCaseListResult {
  const value = exact(input, ["items", "nextAfterId"]);
  if (!Array.isArray(value.items) || value.items.length > 50)
    throw new Error("Invalid conversation cases");
  const items = value.items.map((raw) => {
    const item = exact(raw, ["caseId", "category", "status", "createdAt"]);
    return {
      caseId: uuid(item.caseId),
      category: category(item.category),
      status: caseStatus(item.status),
      createdAt: timestamp(item.createdAt),
    };
  });
  let previous = afterId;
  for (const item of items) {
    if (previous !== null && item.caseId <= previous)
      throw new Error("Invalid conversation case order");
    previous = item.caseId;
  }
  const nextAfterId =
    value.nextAfterId === null ? null : uuid(value.nextAfterId);
  if (nextAfterId !== null && nextAfterId !== items.at(-1)?.caseId)
    throw new Error("Invalid conversation case cursor");
  return { items, nextAfterId };
}

function parseCaseResult(
  input: unknown,
  caseId: string,
): ConversationCaseResult {
  const value = exact(input, ["caseId", "category", "status", "messages"]);
  if (uuid(value.caseId) !== caseId)
    throw new Error("Mismatched conversation case");
  if (
    !Array.isArray(value.messages) ||
    value.messages.length < 1 ||
    value.messages.length > 20
  )
    throw new Error("Invalid selected messages");
  const messages = value.messages.map(parseCaseMessage);
  if (
    new Set(messages.map((message) => message.id)).size !== messages.length ||
    new Set(messages.map((message) => message.sequence)).size !==
      messages.length
  )
    throw new Error("Duplicate selected message");
  return {
    caseId,
    category: category(value.category),
    status: caseStatus(value.status),
    messages,
  };
}

function parseCaseResolution(
  input: unknown,
  caseId: string,
): ConversationCaseResolution {
  const value = exact(input, ["caseId", "status"]);
  if (uuid(value.caseId) !== caseId)
    throw new Error("Mismatched conversation case");
  return { caseId, status: caseStatus(value.status) };
}

function actionError(error: unknown): string {
  unstable_rethrow(error);
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
  args: Record<string, string | null>,
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

export async function listConversationCases(
  input: unknown,
): Promise<ConversationActionResult<ConversationCaseListResult>> {
  const actor = await requireAdmin();
  let value;
  try {
    value = parseCaseListInput(input);
  } catch {
    return { ok: false, error: "Invalid conversation input." };
  }
  try {
    const data = await mutate(
      actor.id,
      "admin_list_coaching_conversation_cases",
      { p_actor_id: actor.id, p_after_id: value.afterId },
    );
    return { ok: true, data: parseCaseListResult(data, value.afterId) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function readConversationCase(
  input: unknown,
): Promise<ConversationActionResult<ConversationCaseResult>> {
  const actor = await requireAdmin();
  let value;
  try {
    value = parseCaseInput(input);
  } catch {
    return { ok: false, error: "Invalid conversation input." };
  }
  try {
    // The case RPC owns self-case denial and the atomic read audit. There is no
    // fallback transcript query or client-supplied selected-message projection.
    const data = await mutate(
      actor.id,
      "admin_read_coaching_conversation_case",
      { p_actor_id: actor.id, p_case_id: value.caseId },
    );
    return { ok: true, data: parseCaseResult(data, value.caseId) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function resolveConversationCase(
  input: unknown,
): Promise<ConversationActionResult<ConversationCaseResolution>> {
  const actor = await requireAdmin();
  let value;
  try {
    value = parseResolutionInput(input);
  } catch {
    return { ok: false, error: "Invalid conversation input." };
  }
  try {
    const data = await mutate(
      actor.id,
      "admin_resolve_coaching_conversation_case",
      {
        p_actor_id: actor.id,
        p_case_id: value.caseId,
        p_action: value.action,
      },
    );
    return { ok: true, data: parseCaseResolution(data, value.caseId) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
