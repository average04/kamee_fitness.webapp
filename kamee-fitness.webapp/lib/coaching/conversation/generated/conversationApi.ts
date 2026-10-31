// Generated from src/lib/coaching/conversationApi.ts; run the app sync-coaching-conversation-client script. Do not edit.
/** Authenticated participant ports only. Parsed projections never grant authority. */
import { z } from 'zod';
import { withDatabaseBusyRetry } from './retryDatabaseBusy';
import { enrollmentUuid } from './enrollmentTypes';
import { parseRevision } from './commerceTypes';
import {
  parseConversationAvailability, parseConversationPage, parseConversationSendAck,
  parseSendConversationInput, type ConversationAvailability, type ConversationPage,
  type ConversationSendAck, type SendConversationInput,
} from './conversationTypes';
import {
  parseConversationOpenInput, parseConversationConsentInput, parseConversationSuspendInput,
  parseConversationControlAck, parseConversationPolicy, parseConversationServicePolicy,
  parseConversationPolicyAcceptance, parseConversationServiceState, parseConversationReadInput,
  parseConversationReadAck, parseConversationContext, parseConversationRoster,
  parseConversationReportInput, parseConversationReportAck,
  type ConversationOpenInput, type ConversationConsentInput, type ConversationSuspendInput,
  type ConversationControlAck, type ConversationPolicy, type ConversationServicePolicy,
  type ConversationPolicyIdentity, type ConversationPolicyAcceptance, type ConversationServiceState,
  type ConversationReadInput, type ConversationReadAck, type ConversationContext,
  type ConversationRoster, type ConversationReportInput, type ConversationReportAck,
} from './conversationBackendTypes';
import { parseConversationBlockAck, type ConversationBlockAck } from './conversationBlockTypes';

export interface ConversationActor {
  readonly accountId: string;
  readonly revision: number;
  assertCurrent(): void;
}
export interface ConversationIdTarget { enrollmentAttemptId: string; conversationId: string }
export const CONVERSATION_PARTICIPANT_RPCS = [
  'get_coaching_conversation', 'get_coaching_conversation_policy',
  'get_coaching_conversation_service_policy', 'accept_coaching_conversation_policy',
  'open_coaching_conversation', 'set_coaching_conversation_consent',
  'suspend_coaching_conversation', 'set_coaching_conversation_service',
  'list_coaching_conversation_messages', 'send_coaching_conversation_message',
  'mark_coaching_conversation_read', 'get_coaching_conversation_context',
  'list_coaching_conversations', 'report_coaching_conversation',
  'set_coaching_conversation_block',
] as const;
export type ConversationRpcName = typeof CONVERSATION_PARTICIPANT_RPCS[number];
export type ConversationRequest = (name: ConversationRpcName, args: Record<string, unknown>) => Promise<unknown>;
export interface ConversationApi {
  availability(attemptId: string): Promise<ConversationAvailability>;
  policy(attemptId: string): Promise<ConversationPolicy>;
  servicePolicy(): Promise<ConversationServicePolicy>;
  acceptPolicy(identity: ConversationPolicyIdentity): Promise<ConversationPolicyAcceptance>;
  open(input: ConversationOpenInput): Promise<ConversationControlAck>;
  consent(target: ConversationIdTarget, input: ConversationConsentInput): Promise<ConversationControlAck>;
  suspend(target: ConversationIdTarget, input: ConversationSuspendInput): Promise<ConversationControlAck>;
  setService(available: boolean): Promise<ConversationServiceState>;
  history(target: ConversationIdTarget, beforeSequence?: string | null): Promise<ConversationPage>;
  send(target: ConversationIdTarget, input: SendConversationInput): Promise<ConversationSendAck>;
  markRead(target: ConversationIdTarget, input: ConversationReadInput): Promise<ConversationReadAck>;
  context(target: ConversationIdTarget, afterScheduleId?: string | null): Promise<ConversationContext>;
  roster(afterId?: string | null): Promise<ConversationRoster>;
  report(target: ConversationIdTarget, input: ConversationReportInput): Promise<ConversationReportAck>;
  block(target: ConversationIdTarget, blocked: boolean): Promise<ConversationBlockAck>;
}

const idTarget = z.object({ enrollmentAttemptId: enrollmentUuid, conversationId: enrollmentUuid }).strict();
const identity = z.object({
  policyVersion: z.string().min(1).max(80).refine(v => /^[A-Za-z0-9._-]+$/.exec(v)?.[0] === v),
  contentHash: z.string().length(64).regex(/^[0-9a-f]{64}$/),
}).strict();

export function createConversationApi({ actor, request }: {
  actor: ConversationActor; request: ConversationRequest;
}): ConversationApi {
  const capturedId = actor.accountId, capturedRevision = actor.revision;
  const accountId = enrollmentUuid.parse(capturedId);
  if (!Number.isSafeInteger(capturedRevision) || capturedRevision < 0) throw new Error('invalid_account_scope');
  function check() {
    actor.assertCurrent();
    if (actor.accountId !== capturedId || actor.revision !== capturedRevision) throw new Error('account_changed');
  }
  function known(value: ConversationIdTarget) { return { accountId, ...idTarget.parse(value) }; }
  function matchAttempt(target: ConversationIdTarget, input: { enrollmentAttemptId: string }) {
    if (target.enrollmentAttemptId !== input.enrollmentAttemptId) throw new Error('Mismatched conversation attempt');
  }
  async function call<T>(name: ConversationRpcName, args: Record<string, unknown>, parse: (wire: unknown) => T): Promise<T> {
    check();
    return withDatabaseBusyRetry(async () => {
      const wire = await request(name, args);
      check();
      const result = parse(wire);
      check();
      return result;
    }, async () => { check(); });
  }
  return {
    async availability(attemptId) {
      check(); const enrollmentAttemptId = enrollmentUuid.parse(attemptId);
      return call('get_coaching_conversation', { p_attempt_id: enrollmentAttemptId }, v =>
        parseConversationAvailability(v, { accountId, enrollmentAttemptId }));
    },
    async policy(attemptId) {
      check(); const enrollmentAttemptId = enrollmentUuid.parse(attemptId);
      return call('get_coaching_conversation_policy', { p_attempt_id: enrollmentAttemptId }, v =>
        parseConversationPolicy(v, { accountId, enrollmentAttemptId }));
    },
    async servicePolicy() {
      return call('get_coaching_conversation_service_policy', {}, v => parseConversationServicePolicy(v, { accountId }));
    },
    async acceptPolicy(value) {
      check(); const input = identity.parse(value);
      return call('accept_coaching_conversation_policy', { p_version: input.policyVersion, p_content_hash: input.contentHash }, v =>
        parseConversationPolicyAcceptance(v, { accountId }, input));
    },
    async open(value) {
      check(); const input = parseConversationOpenInput(value);
      return call('open_coaching_conversation', { p_input: input }, v =>
        parseConversationControlAck(v, { accountId, enrollmentAttemptId: input.enrollmentAttemptId }, input));
    },
    async consent(value, rawInput) {
      check(); const target = known(value), input = parseConversationConsentInput(rawInput); matchAttempt(target, input);
      return call('set_coaching_conversation_consent', { p_input: input }, v => parseConversationControlAck(v, target, input));
    },
    async suspend(value, rawInput) {
      check(); const target = known(value), input = parseConversationSuspendInput(rawInput); matchAttempt(target, input);
      return call('suspend_coaching_conversation', { p_input: input }, v => parseConversationControlAck(v, target, input));
    },
    async setService(value) {
      check(); const available = z.boolean().parse(value);
      return call('set_coaching_conversation_service', { p_available: available }, v => parseConversationServiceState(v, { accountId }, available));
    },
    async history(value, beforeSequence = null) {
      check(); const target = known(value), before = beforeSequence === null ? null : parseRevision(beforeSequence);
      return call('list_coaching_conversation_messages', {
        p_attempt_id: target.enrollmentAttemptId, ...(before === null ? {} : { p_before_sequence: before }),
      }, v => parseConversationPage(v, { ...target, beforeSequence: before }));
    },
    async send(value, rawInput) {
      check(); const target = known(value), input = parseSendConversationInput(rawInput); matchAttempt(target, input);
      return call('send_coaching_conversation_message', { p_input: input }, v => parseConversationSendAck(v, target, input));
    },
    async markRead(value, rawInput) {
      check(); const target = known(value), input = parseConversationReadInput(rawInput); matchAttempt(target, input);
      return call('mark_coaching_conversation_read', { p_input: input }, v => parseConversationReadAck(v, target, input));
    },
    async context(value, afterScheduleId = null) {
      check(); const target = known(value), after = afterScheduleId === null ? null : enrollmentUuid.parse(afterScheduleId);
      return call('get_coaching_conversation_context', {
        p_attempt_id: target.enrollmentAttemptId, ...(after === null ? {} : { p_after_schedule_id: after }),
      }, v => parseConversationContext(v, { ...target, afterScheduleId: after }));
    },
    async roster(afterId = null) {
      check(); const after = afterId === null ? null : enrollmentUuid.parse(afterId);
      return call('list_coaching_conversations', after === null ? {} : { p_after_id: after }, v =>
        parseConversationRoster(v, { accountId, afterId: after }));
    },
    async report(value, rawInput) {
      check(); const target = known(value), input = parseConversationReportInput(rawInput); matchAttempt(target, input);
      return call('report_coaching_conversation', { p_input: input }, v => parseConversationReportAck(v, target, input));
    },
    async block(value, rawBlocked) {
      check(); const target = known(value), blocked = z.boolean().parse(rawBlocked);
      return call('set_coaching_conversation_block', { p_attempt_id: target.enrollmentAttemptId, p_blocked: blocked }, v =>
        parseConversationBlockAck(v, target, blocked));
    },
  };
}
