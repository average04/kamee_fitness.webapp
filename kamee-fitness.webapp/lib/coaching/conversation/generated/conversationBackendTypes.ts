// Generated from src/lib/coaching/conversationBackendTypes.ts; run the app sync-coaching-conversation-client script. Do not edit.
/** C1b wire validation only. These projections never grant conversation or operator authority. */
import { z } from 'zod';
import { parseRevision } from './commerceTypes';
import {
  ConversationAvailability,
  ConversationMessage,
  ConversationTarget,
  parseConversationAvailability,
  parseConversationPage,
} from './conversationTypes';
import { enrollmentDate, enrollmentUuid } from './enrollmentTypes';
import { parseTimestamp } from './utcTimestamp';

// C1a and commerce revisions share the same canonical, nonnegative signed-int64 wire form.
const counter = z
  .string()
  .max(19)
  .transform((value) => parseRevision(value));
const timestamp = z
  .string()
  .refine((value) => parseTimestamp(value) !== null, 'Invalid UTC timestamp');
const policyVersion = z
  .string()
  .min(1)
  .max(80)
  .refine((value) => /^[A-Za-z0-9._-]+$/.exec(value)?.[0] === value, 'Invalid policy version');
const contentHash = z
  .string()
  .length(64)
  .regex(/^[0-9a-f]{64}$/);

function validUnicode(value: string): boolean {
  if (value.includes('\0')) return false;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) return false;
  }
  return true;
}
const text = z.string().refine(validUnicode, 'Invalid Unicode text');
const displayName = text.refine((value) => /\S/u.test(value), 'Expected a nonblank display name');
const policyBody = text.refine(
  (value) => value.length > 0 && value.length <= 32000 && [...value].length <= 16000,
  'Invalid policy body length',
);
const policyIdentitySchema = z.object({ policyVersion, contentHash }).strict();
export type ConversationPolicyIdentity = z.infer<typeof policyIdentitySchema>;

const accountTargetSchema = z.object({ accountId: enrollmentUuid }).strict();
export type ConversationAccountTarget = z.infer<typeof accountTargetSchema>;
const targetSchema = accountTargetSchema.extend({ enrollmentAttemptId: enrollmentUuid }).strict();
const knownTargetSchema = targetSchema.extend({ conversationId: enrollmentUuid }).strict();
export type ConversationKnownTarget = z.infer<typeof knownTargetSchema>;
const controlTargetSchema = targetSchema
  .extend({ conversationId: enrollmentUuid.optional() })
  .strict();
export type ConversationControlTarget = z.infer<typeof controlTargetSchema>;

function assertAccount(value: ConversationAccountTarget, target: ConversationAccountTarget): void {
  if (value.accountId !== target.accountId) throw new Error('Mismatched conversation account');
}
function assertTarget(value: ConversationTarget, target: ConversationTarget): void {
  assertAccount(value, target);
  if (value.enrollmentAttemptId !== target.enrollmentAttemptId)
    throw new Error('Mismatched conversation attempt');
}
function assertKnownTarget(value: ConversationKnownTarget, target: ConversationKnownTarget): void {
  assertTarget(value, target);
  if (value.conversationId !== target.conversationId) throw new Error('Mismatched conversation');
}
function availabilityTarget(target: ConversationTarget): ConversationTarget {
  return { accountId: target.accountId, enrollmentAttemptId: target.enrollmentAttemptId };
}

const requestSchema = z
  .object({ enrollmentAttemptId: enrollmentUuid, requestId: enrollmentUuid })
  .strict();
const openSchema = requestSchema.extend(policyIdentitySchema.shape).strict();
const consentSchema = openSchema.extend({ expectedControlRevision: counter }).strict();
const suspendSchema = requestSchema.extend({ expectedControlRevision: counter }).strict();
const controlInputSchema = z.union([openSchema, consentSchema, suspendSchema]);
export type ConversationOpenInput = z.infer<typeof openSchema>;
export type ConversationConsentInput = z.infer<typeof consentSchema>;
export type ConversationSuspendInput = z.infer<typeof suspendSchema>;
export type ConversationControlInput = z.infer<typeof controlInputSchema>;

export function parseConversationOpenInput(value: unknown): ConversationOpenInput {
  return openSchema.parse(value);
}
export function parseConversationConsentInput(value: unknown): ConversationConsentInput {
  return consentSchema.parse(value);
}
export function parseConversationSuspendInput(value: unknown): ConversationSuspendInput {
  return suspendSchema.parse(value);
}

const controlAckSchema = z
  .object({ requestId: enrollmentUuid, availability: z.unknown() })
  .strict();
export type ConversationControlAck = { requestId: string; availability: ConversationAvailability };
export function parseConversationControlAck(
  value: unknown,
  target: ConversationControlTarget,
  input: ConversationControlInput,
): ConversationControlAck {
  const expected = controlTargetSchema.parse(target);
  const request = controlInputSchema.parse(input);
  const result = controlAckSchema.parse(value);
  const availability = parseConversationAvailability(
    result.availability,
    availabilityTarget(expected),
  );
  if (
    request.enrollmentAttemptId !== expected.enrollmentAttemptId ||
    result.requestId !== request.requestId ||
    (expected.conversationId !== undefined &&
      availability.conversationId !== expected.conversationId)
  )
    throw new Error('Mismatched conversation acknowledgement');
  return { requestId: result.requestId, availability };
}

const policySchema = targetSchema
  .extend({ ...policyIdentitySchema.shape, body: policyBody, coachName: displayName })
  .strict();
export type ConversationPolicy = z.infer<typeof policySchema>;
export function parseConversationPolicy(
  value: unknown,
  target: ConversationTarget,
): ConversationPolicy {
  const expected = targetSchema.parse(target);
  const result = policySchema.parse(value);
  assertTarget(result, expected);
  return result;
}
const servicePolicySchema = accountTargetSchema
  .extend({ ...policyIdentitySchema.shape, body: policyBody })
  .strict();
export type ConversationServicePolicy = z.infer<typeof servicePolicySchema>;
export function parseConversationServicePolicy(
  value: unknown,
  target: ConversationAccountTarget,
): ConversationServicePolicy {
  const expected = accountTargetSchema.parse(target);
  const result = servicePolicySchema.parse(value);
  assertAccount(result, expected);
  return result;
}
const acceptanceSchema = accountTargetSchema
  .extend({ ...policyIdentitySchema.shape, acceptedAt: timestamp })
  .strict();
export type ConversationPolicyAcceptance = z.infer<typeof acceptanceSchema>;
export function parseConversationPolicyAcceptance(
  value: unknown,
  target: ConversationAccountTarget,
  input: ConversationPolicyIdentity,
): ConversationPolicyAcceptance {
  const expected = accountTargetSchema.parse(target);
  const request = policyIdentitySchema.parse(input);
  const result = acceptanceSchema.parse(value);
  assertAccount(result, expected);
  if (result.policyVersion !== request.policyVersion || result.contentHash !== request.contentHash)
    throw new Error('Mismatched conversation policy acceptance');
  return result;
}
const serviceStateSchema = accountTargetSchema
  .extend({ available: z.boolean(), revision: counter })
  .strict();
export type ConversationServiceState = z.infer<typeof serviceStateSchema>;
export function parseConversationServiceState(
  value: unknown,
  target: ConversationAccountTarget,
  available?: boolean,
): ConversationServiceState {
  const expected = accountTargetSchema.parse(target);
  const result = serviceStateSchema.parse(value);
  assertAccount(result, expected);
  if (available !== undefined && result.available !== z.boolean().parse(available))
    throw new Error('Mismatched conversation service state');
  return result;
}

const readSchema = requestSchema.extend({ sequence: counter }).strict();
export type ConversationReadInput = z.infer<typeof readSchema>;
export function parseConversationReadInput(value: unknown): ConversationReadInput {
  return readSchema.parse(value);
}
const readAckSchema = knownTargetSchema
  .extend({ requestId: enrollmentUuid, lastReadSequence: counter })
  .strict();
export type ConversationReadAck = z.infer<typeof readAckSchema>;
function assertRequest(
  result: ConversationKnownTarget & { requestId: string },
  target: ConversationKnownTarget,
  input: { enrollmentAttemptId: string; requestId: string },
): void {
  assertKnownTarget(result, target);
  if (
    input.enrollmentAttemptId !== target.enrollmentAttemptId ||
    result.requestId !== input.requestId
  )
    throw new Error('Mismatched conversation acknowledgement');
}
export function parseConversationReadAck(
  value: unknown,
  target: ConversationKnownTarget,
  input: ConversationReadInput,
): ConversationReadAck {
  const expected = knownTargetSchema.parse(target);
  const request = parseConversationReadInput(input);
  const result = readAckSchema.parse(value);
  assertRequest(result, expected, request);
  // A previous read may already be ahead of this request; the server cursor is monotonic.
  return result;
}

function assertPageIds(ids: string[], afterId: string | null, nextAfterId: string | null): void {
  let previous = afterId;
  for (const id of ids) {
    if (previous !== null && id <= previous)
      throw new Error('Invalid conversation page order or identity');
    previous = id;
  }
  if (nextAfterId !== null && nextAfterId !== ids[ids.length - 1])
    throw new Error('Invalid conversation continuation cursor');
}
const contextTargetSchema = knownTargetSchema
  .extend({ afterScheduleId: enrollmentUuid.nullable() })
  .strict();
export type ConversationContextTarget = z.infer<typeof contextTargetSchema>;
const dayLabel = text.refine(
  (value) => /^Week (?:0|[1-9][0-9]*) · Day (?:0|[1-9][0-9]*)$/.exec(value)?.[0] === value,
  'Invalid conversation day label',
);
const contextDaySchema = z
  .object({
    scheduleRowId: enrollmentUuid,
    dayLabel,
    scheduledDate: enrollmentDate,
    state: z.enum(['scheduled', 'in_progress', 'completed', 'skipped']),
  })
  .strict();
export type ConversationContextDay = z.infer<typeof contextDaySchema>;
const contextSchema = knownTargetSchema
  .extend({
    controlRevision: counter,
    context: z
      .object({
        planTitle: text,
        buyerName: displayName,
        coachName: displayName,
        days: z.array(contextDaySchema).max(50),
        nextAfterScheduleId: enrollmentUuid.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type ConversationContext = z.infer<typeof contextSchema>;
export function parseConversationContext(
  value: unknown,
  target: ConversationContextTarget,
): ConversationContext {
  const expected = contextTargetSchema.parse(target);
  const result = contextSchema.parse(value);
  assertKnownTarget(result, expected);
  if (result.context !== null)
    assertPageIds(
      result.context.days.map((day) => day.scheduleRowId),
      expected.afterScheduleId,
      result.context.nextAfterScheduleId,
    );
  return result;
}

const cursorTargetSchema = z.object({ afterId: enrollmentUuid.nullable() }).strict();
const rosterTargetSchema = accountTargetSchema.extend(cursorTargetSchema.shape).strict();
export type ConversationRosterTarget = z.infer<typeof rosterTargetSchema>;
const rosterItemSchema = z
  .object({
    enrollmentAttemptId: enrollmentUuid,
    conversationId: enrollmentUuid,
    availability: z.unknown(),
    unreadCount: counter,
  })
  .strict();
const rosterSchema = accountTargetSchema
  .extend({ items: z.array(rosterItemSchema).max(50), nextAfterId: enrollmentUuid.nullable() })
  .strict();
export type ConversationRosterItem = Omit<z.infer<typeof rosterItemSchema>, 'availability'> & {
  availability: ConversationAvailability;
};
export type ConversationRoster = {
  accountId: string;
  items: ConversationRosterItem[];
  nextAfterId: string | null;
};
export function parseConversationRoster(
  value: unknown,
  target: ConversationRosterTarget,
): ConversationRoster {
  const expected = rosterTargetSchema.parse(target);
  const result = rosterSchema.parse(value);
  assertAccount(result, expected);
  const attempts = new Set<string>();
  const items = result.items.map((item) => {
    const availability = parseConversationAvailability(item.availability, {
      accountId: expected.accountId,
      enrollmentAttemptId: item.enrollmentAttemptId,
    });
    if (
      availability.conversationId !== item.conversationId ||
      attempts.has(item.enrollmentAttemptId)
    )
      throw new Error('Invalid conversation roster identity');
    attempts.add(item.enrollmentAttemptId);
    return { ...item, availability };
  });
  assertPageIds(
    items.map((item) => item.conversationId),
    expected.afterId,
    result.nextAfterId,
  );
  return { ...result, items };
}

const categorySchema = z.enum(['harassment', 'unsafe_advice', 'privacy', 'other']);
export type ConversationReportCategory = z.infer<typeof categorySchema>;
const reportSchema = requestSchema
  .extend({
    messageIds: z
      .array(enrollmentUuid)
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, 'Duplicate report message'),
    category: categorySchema,
  })
  .strict();
export type ConversationReportInput = z.infer<typeof reportSchema>;
export function parseConversationReportInput(value: unknown): ConversationReportInput {
  return reportSchema.parse(value);
}
const reportAckSchema = knownTargetSchema
  .extend({ requestId: enrollmentUuid, caseId: enrollmentUuid })
  .strict();
export type ConversationReportAck = z.infer<typeof reportAckSchema>;
export function parseConversationReportAck(
  value: unknown,
  target: ConversationKnownTarget,
  input: ConversationReportInput,
): ConversationReportAck {
  const expected = knownTargetSchema.parse(target);
  const request = parseConversationReportInput(input);
  const result = reportAckSchema.parse(value);
  assertRequest(result, expected, request);
  return result;
}

const grantTargetSchema = z.object({ enrollmentAttemptId: enrollmentUuid }).strict();
const grantAckSchema = grantTargetSchema
  .extend({ grantId: enrollmentUuid, revision: counter })
  .strict();
export type ConversationGrantAck = z.infer<typeof grantAckSchema>;
export function parseConversationGrantAck(
  value: unknown,
  target: { enrollmentAttemptId: string },
): ConversationGrantAck {
  const expected = grantTargetSchema.parse(target);
  const result = grantAckSchema.parse(value);
  if (result.enrollmentAttemptId !== expected.enrollmentAttemptId)
    throw new Error('Mismatched conversation grant');
  return result;
}
const revokeTargetSchema = z.object({ grantId: enrollmentUuid }).strict();
const revokeAckSchema = revokeTargetSchema.extend({ revision: counter }).strict();
export type ConversationRevokeAck = z.infer<typeof revokeAckSchema>;
export function parseConversationRevokeAck(
  value: unknown,
  target: { grantId: string },
): ConversationRevokeAck {
  const expected = revokeTargetSchema.parse(target);
  const result = revokeAckSchema.parse(value);
  if (result.grantId !== expected.grantId) throw new Error('Mismatched conversation grant');
  return result;
}

const caseTargetSchema = z.object({ caseId: enrollmentUuid }).strict();
const caseStatusSchema = z.enum(['open', 'resolved']);
export type ConversationCaseStatus = z.infer<typeof caseStatusSchema>;
const caseItemSchema = caseTargetSchema
  .extend({ category: categorySchema, status: caseStatusSchema, createdAt: timestamp })
  .strict();
const caseListSchema = z
  .object({ items: z.array(caseItemSchema).max(50), nextAfterId: enrollmentUuid.nullable() })
  .strict();
export type ConversationCaseList = z.infer<typeof caseListSchema>;
export type ConversationCaseListTarget = z.infer<typeof cursorTargetSchema>;
export function parseConversationCaseList(
  value: unknown,
  target: ConversationCaseListTarget,
): ConversationCaseList {
  const expected = cursorTargetSchema.parse(target);
  const result = caseListSchema.parse(value);
  assertPageIds(
    result.items.map((item) => item.caseId),
    expected.afterId,
    result.nextAfterId,
  );
  return result;
}
const caseSchema = caseTargetSchema
  .extend({
    category: categorySchema,
    status: caseStatusSchema,
    messages: z.array(z.unknown()).min(1).max(20),
  })
  .strict();
export type ConversationCase = Omit<z.infer<typeof caseSchema>, 'messages'> & {
  messages: ConversationMessage[];
};
export function parseConversationCase(
  value: unknown,
  target: { caseId: string },
): ConversationCase {
  const expected = caseTargetSchema.parse(target);
  const result = caseSchema.parse(value);
  if (result.caseId !== expected.caseId) throw new Error('Mismatched conversation case');
  // C1a exposes message validation through its page parser only. This inert envelope
  // validates one selected message at a time; it supplies no actor or access authority.
  // Case projections do not promise transcript ordering, so preserve the supplied order.
  const envelope = {
    accountId: result.caseId,
    enrollmentAttemptId: result.caseId,
    conversationId: result.caseId,
  };
  const messages = result.messages.map(
    (message) =>
      parseConversationPage(
        { ...envelope, messages: [message], nextBeforeSequence: null },
        { ...envelope, beforeSequence: null },
      ).messages[0]!,
  );
  if (
    new Set(messages.map((message) => message.id)).size !== messages.length ||
    new Set(messages.map((message) => message.sequence)).size !== messages.length
  )
    throw new Error('Duplicate conversation case message');
  return { ...result, messages };
}
const caseAckSchema = caseTargetSchema.extend({ status: caseStatusSchema }).strict();
export type ConversationCaseAck = z.infer<typeof caseAckSchema>;
export function parseConversationCaseAck(
  value: unknown,
  target: { caseId: string },
): ConversationCaseAck {
  const expected = caseTargetSchema.parse(target);
  const result = caseAckSchema.parse(value);
  if (result.caseId !== expected.caseId) throw new Error('Mismatched conversation case');
  return result;
}
