// Generated from src/lib/coaching/conversationTypes.ts; run the app sync-coaching-conversation-client script. Do not edit.
/** C1 wire validation only. Parsed capabilities are not an authorization decision. */
import { z } from 'zod';
import { utf8ByteLength } from './utf8ByteLength';
import { enrollmentUuid } from './enrollmentTypes';
import { parseTimestamp } from './utcTimestamp';

const MAX_INT64 = BigInt('9223372036854775807');
const counter = z
  .string()
  .refine(
    (value) =>
      value.length <= 19 &&
      /^(?:0|[1-9][0-9]*)$/.exec(value)?.[0] === value &&
      BigInt(value) <= MAX_INT64,
    'Expected a canonical nonnegative int64 string',
  );

function validText(value: string): boolean {
  // ECMAScript whitespace is intentional; preserve the accepted text without trimming it.
  if (value.length > 4000 || !/\S/u.test(value) || value.includes('\0')) return false;
  let points = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if ((point >= 0xd800 && point <= 0xdfff) || ++points > 2000) return false;
  }
  return utf8ByteLength(value) <= 8000;
}
const messageBody = z.string().refine(validText, 'Invalid conversation text');

const conversationTargetSchema = z
  .object({ accountId: enrollmentUuid, enrollmentAttemptId: enrollmentUuid })
  .strict();
export type ConversationTarget = z.infer<typeof conversationTargetSchema>;

const sendSchema = z
  .object({
    enrollmentAttemptId: enrollmentUuid,
    requestId: enrollmentUuid,
    expectedControlRevision: counter,
    body: messageBody,
  })
  .strict();
export type SendConversationInput = z.infer<typeof sendSchema>;

export function parseSendConversationInput(value: unknown): SendConversationInput {
  return sendSchema.parse(value);
}

const capabilitiesSchema = z
  .object({
    canReadHistory: z.boolean(),
    canSend: z.boolean(),
    canRequestKamy: z.literal(false),
    canCreateProposal: z.literal(false),
    canApplyProposal: z.literal(false),
  })
  .strict();
export type ConversationCapabilities = z.infer<typeof capabilitiesSchema>;

const reasonSchema = z.enum([
  'active',
  'not_enabled',
  'not_eligible',
  'consent_required',
  'suspended',
  'coach_unavailable',
  'completed',
  'restarted',
  'stopped',
  'refunded',
  'access_expired',
  'blocked',
  'coach_deleted',
  'restricted',
]);
export type ConversationReason = z.infer<typeof reasonSchema>;

const availabilitySchema = conversationTargetSchema
  .extend({
    conversationId: enrollmentUuid.nullable(),
    controlRevision: counter.nullable(),
    viewerRole: z.enum(['buyer', 'coach']),
    reason: reasonSchema,
    capabilities: capabilitiesSchema,
  })
  .strict()
  .refine((value) => {
    const exists = value.conversationId !== null;
    const { canReadHistory, canSend } = value.capabilities;
    return (
      exists === (value.controlRevision !== null) &&
      (!canReadHistory || exists) &&
      (value.reason === 'active' ? exists && canReadHistory && canSend : !canSend)
    );
  }, 'Inconsistent conversation availability');
export type ConversationAvailability = z.infer<typeof availabilitySchema>;

function assertTarget(value: ConversationTarget, target: ConversationTarget): void {
  if (
    value.accountId !== target.accountId ||
    value.enrollmentAttemptId !== target.enrollmentAttemptId
  )
    throw new Error('Mismatched conversation target');
}

export function parseConversationAvailability(
  value: unknown,
  target: ConversationTarget,
): ConversationAvailability {
  const expected = conversationTargetSchema.parse(target);
  const result = availabilitySchema.parse(value);
  assertTarget(result, expected);
  return result;
}

const sequence = counter.refine((value) => value !== '0', 'Message sequence must be positive');
const timestamp = z
  .string()
  .refine((value) => parseTimestamp(value) !== null, 'Invalid UTC timestamp');
const messageIdentity = { id: enrollmentUuid, sequence, createdAt: timestamp };
const messageSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...messageIdentity,
      kind: z.literal('text'),
      author: z.enum(['buyer', 'coach']),
      body: messageBody,
    })
    .strict(),
  z
    .object({
      ...messageIdentity,
      kind: z.literal('system'),
      event: z.enum(['opened', 'suspended', 'resumed', 'closed']),
    })
    .strict(),
  z.object({ ...messageIdentity, kind: z.literal('removed') }).strict(),
]);
export type ConversationMessage = z.infer<typeof messageSchema>;

const ackTargetSchema = conversationTargetSchema
  .extend({ conversationId: enrollmentUuid })
  .strict();
const pageTargetSchema = ackTargetSchema.extend({ beforeSequence: counter.nullable() }).strict();
export type ConversationPageTarget = z.infer<typeof pageTargetSchema>;
const pageSchema = ackTargetSchema
  .extend({ messages: z.array(messageSchema).max(50), nextBeforeSequence: sequence.nullable() })
  .strict();
export type ConversationPage = z.infer<typeof pageSchema>;

export function parseConversationPage(
  value: unknown,
  target: ConversationPageTarget,
): ConversationPage {
  const expected = pageTargetSchema.parse(target);
  const result = pageSchema.parse(value);
  assertTarget(result, expected);
  if (result.conversationId !== expected.conversationId)
    throw new Error('Mismatched conversation target');

  const before = expected.beforeSequence === null ? null : BigInt(expected.beforeSequence);
  const ids = new Set<string>();
  let previous = BigInt(0);
  for (const message of result.messages) {
    const current = BigInt(message.sequence);
    if (ids.has(message.id) || current <= previous || (before !== null && current >= before))
      throw new Error('Invalid conversation page order or identity');
    ids.add(message.id);
    previous = current;
  }
  if (
    result.nextBeforeSequence !== null &&
    result.nextBeforeSequence !== result.messages[0]?.sequence
  )
    throw new Error('Invalid conversation continuation cursor');
  return result;
}

const ackSchema = ackTargetSchema
  .extend({ requestId: enrollmentUuid, messageId: enrollmentUuid, sequence, createdAt: timestamp })
  .strict();
export type ConversationSendAck = z.infer<typeof ackSchema>;

export function parseConversationSendAck(
  value: unknown,
  target: ConversationTarget & { conversationId: string },
  input: SendConversationInput,
): ConversationSendAck {
  const expected = ackTargetSchema.parse(target);
  const request = parseSendConversationInput(input);
  const result = ackSchema.parse(value);
  assertTarget(result, expected);
  if (
    request.enrollmentAttemptId !== expected.enrollmentAttemptId ||
    result.conversationId !== expected.conversationId ||
    result.requestId !== request.requestId
  )
    throw new Error('Mismatched conversation acknowledgement');
  return result;
}
