import { proposalInputs, type ProposalInputs, type ProposalTarget } from "./types";
import type { ConversationActor } from "../conversation/generated/conversationApi";
import { CONVERSATION_JOURNAL_ROOT } from "../conversation/generated/conversationJournalCore";
export type MutationName = "setConsent" | "preview" | "send" | "withdraw";
export type Mutation = { [K in MutationName]: { name: K; input: ProposalInputs[K] } }[MutationName];
export type Pending = { mutation: Mutation; uncertain: boolean };
export type ProposalJournal = { load(): Pending | null; save(value: Pending): void; clear(): void };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export function createProposalJournal({ actor, target, storage }: { actor: ConversationActor; target: ProposalTarget; storage: Storage }): ProposalJournal {
  // Existing verified-owner deletion cleanup covers this distinct subpartition.
  // Sign-out hides recovery; it does not discard an uncertain request.
  const key = `${CONVERSATION_JOURNAL_ROOT}${actor.accountId}/proposals/${target.enrollmentAttemptId}/${target.conversationId}`;
  function parse(raw: unknown): Pending {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("proposal_recovery_invalid");
    const row = raw as Record<string, unknown>;
    if (Object.keys(row).sort().join() !== "accountId,mutation,schema,uncertain" || row.schema !== 1 || row.accountId !== actor.accountId || typeof row.uncertain !== "boolean") throw Error("proposal_recovery_invalid");
    const m = row.mutation as Record<string, unknown>;
    if (!m || typeof m !== "object" || Array.isArray(m) || Object.keys(m).sort().join() !== "input,name" || typeof m.name !== "string" || !["setConsent", "preview", "send", "withdraw"].includes(m.name)) throw Error("proposal_recovery_invalid");
    const name = m.name as MutationName, input = proposalInputs[name].parse(m.input);
    if (input.enrollmentAttemptId !== target.enrollmentAttemptId || input.conversationId !== target.conversationId) throw Error("proposal_recovery_scope");
    return { mutation: { name, input } as Mutation, uncertain: row.uncertain };
  }
  return {
    load() { actor.assertCurrent(); const raw = storage.getItem(key); actor.assertCurrent(); if (raw !== null && raw.length > 524288) throw Error("proposal_recovery_too_large"); return raw === null ? null : parse(JSON.parse(raw)); },
    save(value) {
      actor.assertCurrent(); const parsed = parse({ schema: 1, accountId: actor.accountId, ...value });
      const raw = JSON.stringify({ schema: 1, accountId: actor.accountId, ...parsed });
      if (raw.length > 524288) throw Error("proposal_recovery_too_large");
      storage.setItem(key, raw); actor.assertCurrent();
    },
    clear() { actor.assertCurrent(); storage.removeItem(key); actor.assertCurrent(); },
  };
}
