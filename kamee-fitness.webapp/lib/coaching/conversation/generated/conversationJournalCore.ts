// Generated from src/lib/coaching/conversationJournalCore.ts; run the app sync-coaching-conversation-client script. Do not edit.
import { z } from 'zod';
import type { ConversationActor, ConversationIdTarget } from './conversationApi';
import { enrollmentUuid } from './enrollmentTypes';
import { parseSendConversationInput, type SendConversationInput } from './conversationTypes';
import {
  parseConversationReportInput,
  type ConversationReportInput,
} from './conversationBackendTypes';

export const CONVERSATION_JOURNAL_ROOT = '@kamee/coaching-conversation/v1/';
export interface ConversationStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}
export type PendingConversationSend = { conversationId: string; input: SendConversationInput };
export type PendingConversationReport = { conversationId: string; input: ConversationReportInput };
export interface ConversationJournalState {
  draft: string;
  pendingSend: PendingConversationSend | null;
  pendingReport: PendingConversationReport | null;
  failedSendBody: string | null;
  unknownSendBody: string | null;
}
export interface ConversationJournal {
  read(attemptId: string): Promise<ConversationJournalState>;
  saveDraft(attemptId: string, body: string): Promise<void>;
  prepareSend(
    target: ConversationIdTarget,
    input: SendConversationInput,
  ): Promise<PendingConversationSend>;
  prepareReport(
    target: ConversationIdTarget,
    input: ConversationReportInput,
  ): Promise<PendingConversationReport>;
  resolve(
    attemptId: string,
    kind: 'send' | 'report',
    requestId: string,
    outcome?: 'sent' | 'not_sent',
    options?: { keepFailedCopy?: boolean; restoreEmptyDraft?: boolean },
  ): Promise<void>;
  abandonSend(attemptId: string, requestId: string): Promise<void>;
  dismissSendCopy(attemptId: string, kind: 'failed' | 'unknown'): Promise<void>;
}
export interface ConversationJournalManager {
  bind(actor: ConversationActor): ConversationJournal;
  subscribeFence(accountId: string, listener: () => void): () => void;
  fenceAccount(accountId: string): void;
  clearAccount(accountId: string): Promise<void>;
}
type Dependencies = {
  storage: ConversationStorage;
  restoreFence(accountId: string): Promise<void>;
  /** Own the complete mutation lifetime, including external-writer coordination when needed. */
  runWrite<T>(accountId: string, write: () => Promise<T>): Promise<T>;
};
const empty = (): ConversationJournalState => ({
  draft: '',
  pendingSend: null,
  pendingReport: null,
  failedSendBody: null,
  unknownSendBody: null,
});
const draftSchema = z.string().max(16000, 'draft_too_large');
const envelopeSchema = z
  .object({
    schema: z.literal(1),
    ownerId: enrollmentUuid,
    attemptId: enrollmentUuid,
    draft: draftSchema,
    pendingSend: z.unknown(),
    pendingReport: z.unknown(),
    failedSendBody: z.string().nullable(),
    unknownSendBody: z.string().nullable().default(null),
  })
  .strict();
const pendingSchema = z.object({ conversationId: enrollmentUuid, input: z.unknown() }).strict();
function immutableSend(pending: PendingConversationSend): PendingConversationSend {
  Object.freeze(pending.input);
  return Object.freeze(pending);
}
function immutableReport(pending: PendingConversationReport): PendingConversationReport {
  Object.freeze(pending.input.messageIds);
  Object.freeze(pending.input);
  return Object.freeze(pending);
}

export function createConversationJournalManager(deps: Dependencies): ConversationJournalManager {
  const fenced = new Set<string>();
  const tails = new Map<string, Promise<unknown>>();
  const listeners = new Map<string, Set<() => void>>();
  const owner = (id: string) => enrollmentUuid.parse(id);
  const prefix = (id: string) => CONVERSATION_JOURNAL_ROOT + owner(id) + '/';
  function serial<T>(uid: string, work: () => Promise<T>): Promise<T> {
    const result = (tails.get(uid) ?? Promise.resolve()).catch(() => {}).then(work);
    tails.set(uid, result);
    void result
      .finally(() => {
        if (tails.get(uid) === result) tails.delete(uid);
      })
      .catch(() => {});
    return result;
  }
  function parse(raw: string | null, uid: string, attemptId: string): ConversationJournalState {
    if (raw === null) return empty();
    try {
      const envelope = envelopeSchema.parse(JSON.parse(raw));
      if (envelope.ownerId !== uid || envelope.attemptId !== attemptId) throw new Error();
      const send = envelope.pendingSend === null ? null : pendingSchema.parse(envelope.pendingSend);
      const report =
        envelope.pendingReport === null ? null : pendingSchema.parse(envelope.pendingReport);
      const state = {
        draft: envelope.draft,
        failedSendBody: envelope.failedSendBody,
        unknownSendBody: envelope.unknownSendBody,
        pendingSend: send
          ? immutableSend({
              conversationId: send.conversationId,
              input: parseSendConversationInput(send.input),
            })
          : null,
        pendingReport: report
          ? immutableReport({
              conversationId: report.conversationId,
              input: parseConversationReportInput(report.input),
            })
          : null,
      };
      if (
        state.pendingSend?.input.enrollmentAttemptId &&
        state.pendingSend.input.enrollmentAttemptId !== attemptId
      )
        throw new Error();
      if (
        state.pendingReport?.input.enrollmentAttemptId &&
        state.pendingReport.input.enrollmentAttemptId !== attemptId
      )
        throw new Error();
      // Failed text came from a validated send; do not permit an unbounded foreign payload.
      for (const body of [state.failedSendBody, state.unknownSendBody])
        if (body !== null)
          parseSendConversationInput({
            enrollmentAttemptId: attemptId,
            requestId: uid,
            expectedControlRevision: '0',
            body,
          });
      return state;
    } catch {
      throw new Error('invalid_journal');
    }
  }
  const manager: ConversationJournalManager = {
    bind(actor) {
      const uid = owner(actor.accountId);
      const revision = actor.revision;
      function check() {
        actor.assertCurrent();
        if (actor.accountId !== uid || actor.revision !== revision || fenced.has(uid))
          throw new Error('account_changed');
      }
      async function checked<T>(promise: Promise<T>): Promise<T> {
        try {
          const value = await promise;
          check();
          return value;
        } catch (error) {
          check();
          throw error;
        }
      }
      async function access<T>(
        attempt: string,
        mutate: ((state: ConversationJournalState) => T) | null,
      ): Promise<T | ConversationJournalState> {
        const attemptId = enrollmentUuid.parse(attempt);
        check();
        return serial(uid, async () => {
          check();
          await checked(deps.restoreFence(uid));
          const work = async () => {
            check();
            const state = parse(
              await checked(deps.storage.getItem(prefix(uid) + attemptId)),
              uid,
              attemptId,
            );
            if (!mutate) return state;
            const result = mutate(state);
            check();
            await checked(
              deps.storage.setItem(
                prefix(uid) + attemptId,
                JSON.stringify({ schema: 1, ownerId: uid, attemptId, ...state }),
              ),
            );
            return result;
          };
          return mutate ? checked(deps.runWrite(uid, work)) : work();
        });
      }
      return {
        read: (attempt) => access(attempt, null) as Promise<ConversationJournalState>,
        async saveDraft(attempt, body) {
          if (typeof body !== 'string' || body.length > 16000) throw new Error('draft_too_large');
          await access(attempt, (state) => {
            state.draft = body;
          });
        },
        async prepareSend(target, value) {
          const conversationId = enrollmentUuid.parse(target.conversationId);
          const input = parseSendConversationInput(value);
          if (input.enrollmentAttemptId !== target.enrollmentAttemptId)
            throw new Error('mismatched_attempt');
          return access(target.enrollmentAttemptId, (state) => {
            const pending = immutableSend({ conversationId, input });
            if (state.pendingSend && JSON.stringify(state.pendingSend) !== JSON.stringify(pending))
              throw new Error('unresolved_request');
            if (state.failedSendBody !== null && state.failedSendBody !== input.body)
              throw new Error('failed_copy_requires_dismissal');
            state.pendingSend = pending;
            return pending;
          }) as Promise<PendingConversationSend>;
        },
        async prepareReport(target, value) {
          const conversationId = enrollmentUuid.parse(target.conversationId);
          const input = parseConversationReportInput(value);
          if (input.enrollmentAttemptId !== target.enrollmentAttemptId)
            throw new Error('mismatched_attempt');
          return access(target.enrollmentAttemptId, (state) => {
            const pending = immutableReport({ conversationId, input });
            if (
              state.pendingReport &&
              JSON.stringify(state.pendingReport) !== JSON.stringify(pending)
            )
              throw new Error('unresolved_request');
            state.pendingReport = pending;
            return pending;
          }) as Promise<PendingConversationReport>;
        },
        async resolve(attempt, kind, request, outcome = 'sent', options) {
          enrollmentUuid.parse(request);
          await access(attempt, (state) => {
            const pending = kind === 'send' ? state.pendingSend : state.pendingReport;
            if (!pending || pending.input.requestId !== request) return;
            if (kind === 'send' && state.pendingSend) {
              const body = state.pendingSend.input.body;
              if (outcome === 'sent' && state.draft === body) state.draft = '';
              if (outcome === 'sent' && state.failedSendBody === body) state.failedSendBody = null;
              if (outcome === 'not_sent') {
                if (state.draft === '' || options?.restoreEmptyDraft === true) state.draft = body;
                if (state.draft !== body || options?.keepFailedCopy === true) {
                  if (state.failedSendBody !== null && state.failedSendBody !== body)
                    throw new Error('failed_copy_requires_dismissal');
                  state.failedSendBody = body;
                } else if (state.failedSendBody === body) state.failedSendBody = null;
              }
              state.pendingSend = null;
            } else state.pendingReport = null;
          });
        },
        async abandonSend(attempt, requestId) {
          enrollmentUuid.parse(requestId);
          await access(attempt, (state) => {
            if (!state.pendingSend || state.pendingSend.input.requestId !== requestId) return;
            if (state.unknownSendBody !== null) throw new Error('unknown_copy_requires_dismissal');
            state.unknownSendBody = state.pendingSend.input.body;
            if (state.failedSendBody === state.unknownSendBody) state.failedSendBody = null;
            state.pendingSend = null;
          });
        },
        async dismissSendCopy(attempt, kind) {
          await access(attempt, (state) => {
            if (kind === 'failed') state.failedSendBody = null;
            else state.unknownSendBody = null;
          });
        },
      };
    },
    subscribeFence(accountId, listener) {
      const uid = owner(accountId);
      let set = listeners.get(uid);
      if (!set) listeners.set(uid, (set = new Set()));
      set.add(listener);
      if (fenced.has(uid)) listener();
      return () => {
        set!.delete(listener);
      };
    },
    fenceAccount(accountId) {
      const uid = owner(accountId);
      fenced.add(uid);
      listeners.get(uid)?.forEach((listener) => {
        try {
          listener();
        } catch {
          /* A broken view cannot prevent other views or cleanup from being fenced. */
        }
      });
    },
    async clearAccount(accountId) {
      const uid = owner(accountId);
      manager.fenceAccount(uid);
      await serial(uid, async () => {
        for (const key of await deps.storage.getAllKeys())
          if (key.startsWith(prefix(uid))) await deps.storage.removeItem(key);
      });
    },
  };
  return manager;
}
