// Generated from the canonical app participant contract by proposals/sync.mjs. Do not edit.
import { z } from 'zod';
import { utf8ByteLength } from '../conversation/generated/utf8ByteLength';
import { parseRevision } from '../conversation/generated/commerceTypes';
import { enrollmentDate, enrollmentUuid as uuid } from '../conversation/generated/enrollmentTypes';
import { compareTimestamp, parseTimestamp } from '../conversation/generated/utcTimestamp';

const counter = z.string().max(19).refine(value => {
  try { parseRevision(value); return true; } catch { return false; }
});
const hash = z.string().length(64).regex(/^[0-9a-f]+$/);
const instant = z.string().max(32).refine(value => parseTimestamp(value) !== null);
const time = z.string().refine(value => /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,6})?)?$/.exec(value)?.[0] === value).nullable();
const role = z.enum(['buyer', 'coach']);
const label = z.string().min(1).max(256);
const kind = z.enum(['move_occurrence', 'edit_strength_slot', 'edit_timed_outdoor']);
const state = z.enum(['pending', 'applied', 'declined', 'withdrawn', 'conflict', 'closed', 'superseded']);

function validText(value: string, points: number, bytes: number) {
  if (!/\S/u.test(value) || value.includes('\0')) return false;
  let count = 0;
  for (const symbol of value) {
    const point = symbol.codePointAt(0)!;
    if (++count > points || (point >= 0xd800 && point <= 0xdfff)) return false;
  }
  return utf8ByteLength(value) <= bytes;
}

const note = z.string().max(4000).refine(value => validText(value, 2000, 8000)).nullable();
const disclosure = z.object({
  policyVersion: z.string().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/),
  policyHash: hash,
  text: z.string().max(32768).refine(value => validText(value, 32768, 32768)),
  disclosureWitness: hash,
}).strict();

const target = z.object({ enrollmentAttemptId: uuid, conversationId: uuid }).strict();
const revision = z.object({ expectedControlRevision: counter, expectedEffectiveRevision: counter }).strict();
const reviewed = target.extend(revision.shape).strict();
const request = target.extend({ requestId: uuid }).strict();
const consentCommon = request.extend({ grantId: uuid, expectedConsentGeneration: counter }).strict();
const consentInput = z.discriminatedUnion('action', [
  consentCommon.extend({ action: z.literal('accept'), ...disclosure.omit({ text: true }).shape }).strict(),
  consentCommon.extend({ action: z.literal('revoke') }).strict(),
]);
const consent = target.extend({
  accountId: uuid,
  participant: role,
  grantId: uuid.nullable(),
  consentGeneration: counter,
  consentActive: z.boolean(),
  disclosure: disclosure.nullable(),
}).strict().refine(value => value.grantId !== null || (!value.consentActive && value.disclosure === null));

const occurrence = z.object({
  scheduleRowId: uuid, planDayId: uuid, dayLineageKey: uuid, scheduledDate: enrollmentDate,
}).strict();
const strengthSelector = occurrence.extend({
  blockId: uuid, blockLineageKey: uuid, slotId: uuid, slotLineageKey: uuid,
}).strict();
const outdoorSelector = occurrence.extend({ cardioId: uuid, cardioLineageKey: uuid }).strict();
const leaf = z.object({ kind: z.literal('leaf'), seconds: z.number().int().min(1).max(21600) }).strict();
const repeat = z.object({ kind: z.literal('repeat'), repeat: z.number().int().min(1).max(100), of: z.array(leaf).min(1).max(100) }).strict();

function timingTotals(value: readonly (z.infer<typeof leaf> | z.infer<typeof repeat>)[]) {
  return value.reduce((sum, item) => item.kind === 'leaf'
    ? { seconds: sum.seconds + item.seconds, leaves: sum.leaves + 1 }
    : { seconds: sum.seconds + item.repeat * item.of.reduce((seconds, part) => seconds + part.seconds, 0), leaves: sum.leaves + item.repeat * item.of.length },
  { seconds: 0, leaves: 0 });
}

const timings = z.array(z.discriminatedUnion('kind', [leaf, repeat])).min(1).max(100).refine(value => {
  const total = timingTotals(value);
  return total.seconds <= 86400 && total.leaves <= 10000;
});
const strength = z.object({
  sets: z.number().int().min(1).max(30),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  reps: z.string().min(1).max(128),
}).strict();
const outdoor = z.object({ timings, targetSeconds: z.number().int().min(1).max(86400) }).strict();
const schedule = z.object({ scheduledDate: enrollmentDate, scheduledTime: time }).strict();
const edits = strength.omit({ reps: true }).partial().extend({ repCount: z.number().int().min(1).max(999).optional() }).strict()
  .refine(value => Object.values(value).some(field => field !== undefined));
const operation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move_occurrence'), selector: occurrence, newDate: enrollmentDate }).strict(),
  z.object({ kind: z.literal('edit_strength_slot'), selector: strengthSelector, changes: edits }).strict(),
  z.object({ kind: z.literal('edit_timed_outdoor'), selector: outdoorSelector, timings }).strict(),
]);
const reviewChange = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('move_occurrence'), selector: occurrence, before: schedule, after: schedule }).strict(),
  z.object({ kind: z.literal('edit_strength_slot'), selector: strengthSelector, label, before: strength, after: strength }).strict(),
  z.object({ kind: z.literal('edit_timed_outdoor'), selector: outdoorSelector, before: outdoor, after: outdoor }).strict(),
]);

export function proposalOperationKey(value: z.infer<typeof operation> | z.infer<typeof reviewChange>) {
  const { selector } = value;
  const base = `${selector.scheduleRowId}/${value.kind}`;
  return value.kind === 'edit_strength_slot' ? `${base}/${value.selector.blockId}/${value.selector.slotId}` : base;
}

const uniqueOperations = (values: (z.infer<typeof operation> | z.infer<typeof reviewChange>)[]) =>
  new Set(values.map(proposalOperationKey)).size === values.length;
const changes = z.array(reviewChange).min(1).max(20).refine(uniqueOperations);
const editTarget = target.extend({
  occurrence,
  scheduledTime: time,
  strength: z.array(strength.extend({
    selector: strengthSelector,
    label,
    trackingType: z.enum(['reps', 'weight_reps', 'duration', 'distance']),
  }).strict()).max(360),
  outdoor: outdoor.extend({ selector: outdoorSelector }).strict().nullable(),
}).strict().refine(value => {
  const sameOccurrence = (selector: z.infer<typeof occurrence>) => {
    const actual = value.occurrence;
    return actual.scheduleRowId === selector.scheduleRowId && actual.planDayId === selector.planDayId &&
      actual.dayLineageKey === selector.dayLineageKey && actual.scheduledDate === selector.scheduledDate;
  };
  return value.strength.every(item => sameOccurrence(item.selector)) &&
    (value.outdoor === null || sameOccurrence(value.outdoor.selector));
});
const previewInput = reviewed.extend({
  requestId: uuid,
  note,
  changes: z.array(operation).min(1).max(20).refine(uniqueOperations),
}).strict();
const preview = target.extend({ previewId: uuid, previewHash: hash, note, changes }).strict();
const previewTarget = reviewed.extend({ previewId: uuid }).strict();
const sendInput = previewTarget.extend({ requestId: uuid, previewHash: hash }).strict();
const proposalTarget = target.extend({ proposalId: uuid }).strict();
const decisionInput = proposalTarget.extend({ requestId: uuid, expectedProposalRevision: counter }).strict();
const acceptInput = decisionInput.extend({ ...revision.shape, previewHash: hash }).strict();
const cursor = z.object({ createdAt: instant, proposalId: uuid }).strict();
const listInput = target.extend({ cursor: cursor.nullable(), limit: z.number().int().min(1).max(20) }).strict();
const detail = proposalTarget.extend({
  proposalRevision: counter,
  state,
  createdAt: instant,
  resolvedAt: instant.nullable(),
  appliedRevision: counter.nullable(),
  note,
  operationLabels: z.array(kind).min(1).max(20),
  previewHash: hash.nullable(),
  reviewScope: revision.nullable(),
  changes: changes.nullable(),
  actions: z.object({ canApply: z.boolean(), canDecline: z.boolean(), canWithdraw: z.boolean() }).strict(),
}).strict();
const page = target.extend({ proposals: z.array(detail).max(20), nextCursor: cursor.nullable(), editorScope: revision.nullable() }).strict();
const ack = request.extend({ accountId: uuid }).strict();
const acks = {
  consent_accept: ack.extend({ action: z.literal('consent_accept'), outcome: z.literal('accepted'), consentGeneration: counter }).strict(),
  consent_revoke: ack.extend({ action: z.literal('consent_revoke'), outcome: z.literal('revoked'), consentGeneration: counter }).strict(),
  preview: ack.extend({ action: z.literal('preview'), outcome: z.literal('previewed'), previewId: uuid }).strict(),
  send: ack.extend({ action: z.literal('send'), outcome: z.literal('sent'), proposalId: uuid }).strict(),
  accept: z.union([
    ack.extend({ action: z.literal('accept'), outcome: z.literal('applied'), proposalId: uuid, appliedRevision: counter }).strict(),
    ack.extend({ action: z.literal('accept'), outcome: z.literal('conflict'), proposalId: uuid }).strict(),
  ]),
  decline: ack.extend({ action: z.literal('decline'), outcome: z.literal('declined'), proposalId: uuid }).strict(),
  withdraw: ack.extend({ action: z.literal('withdraw'), outcome: z.literal('withdrawn'), proposalId: uuid }).strict(),
} as const;

export const proposalInputs = {
  consent: target, setConsent: consentInput, editTargets: reviewed.extend({ scheduleRowId: uuid }).strict(),
  preview: previewInput, getPreview: previewTarget, send: sendInput, accept: acceptInput,
  decline: decisionInput, withdraw: decisionInput, getProposal: proposalTarget, list: listInput,
} as const;

export type ProposalTarget = z.infer<typeof target>;
export type ProposalRevision = z.infer<typeof revision>;
export type ProposalOperation = z.infer<typeof operation>;
export type ProposalReviewChange = z.infer<typeof reviewChange>;
export type ProposalEditTarget = z.infer<typeof editTarget>;
export type ProposalTiming = z.infer<typeof timings>[number];
export type ProposalDetail = z.infer<typeof detail>;
export type ProposalConsent = z.infer<typeof consent>;
export type ProposalPreview = z.infer<typeof preview>;
export type ProposalPage = z.infer<typeof page>;
export type ProposalInputs = { [K in keyof typeof proposalInputs]: z.infer<(typeof proposalInputs)[K]> };
export type ProposalAction = keyof typeof acks;
export type ProposalAck<Action extends ProposalAction = ProposalAction> = z.infer<(typeof acks)[Action]>;

function assertTarget(value: ProposalTarget, expected: ProposalTarget) {
  if (value.enrollmentAttemptId !== expected.enrollmentAttemptId || value.conversationId !== expected.conversationId)
    throw new Error('proposal_scope_mismatch');
}

export function parseProposalPreviewInput(raw: unknown) { return previewInput.parse(raw); }

export function parseProposalConsent(raw: unknown, expected: ProposalTarget, accountId: string) {
  const value = consent.parse(raw);
  assertTarget(value, expected);
  if (value.accountId !== accountId) throw new Error('proposal_actor_mismatch');
  return value;
}

export function parseProposalDetail(raw: unknown, expected: ProposalTarget, proposalId?: string) {
  const value = detail.parse(raw);
  assertTarget(value, expected);
  const structured = value.changes !== null;
  if ((proposalId !== undefined && value.proposalId !== proposalId) ||
      (value.previewHash !== null) !== structured || (value.reviewScope !== null) !== structured ||
      (structured && value.state !== 'pending') || ((value.appliedRevision !== null) !== (value.state === 'applied')) ||
      (value.actions.canApply && value.state !== 'pending') || (value.actions.canDecline && value.actions.canWithdraw))
    throw new Error('invalid_proposal_projection');
  return value;
}

export function parseProposalPage(raw: unknown, expected: ProposalInputs['list']) {
  const value = page.parse(raw);
  assertTarget(value, expected);
  const ids = new Set<string>();
  let previous = expected.cursor;
  for (const row of value.proposals) {
    parseProposalDetail(row, expected);
    const order = previous ? compareTimestamp(parseTimestamp(previous.createdAt)!, parseTimestamp(row.createdAt)!) : 1;
    if (row.changes !== null || ids.has(row.proposalId) || order < 0 || (order === 0 && previous!.proposalId <= row.proposalId))
      throw new Error('invalid_proposal_page');
    ids.add(row.proposalId);
    previous = row;
  }
  if (value.proposals.length > expected.limit || (value.nextCursor && (
    value.proposals.length !== expected.limit || value.nextCursor.proposalId !== previous?.proposalId || value.nextCursor.createdAt !== previous?.createdAt
  ))) throw new Error('invalid_proposal_cursor');
  return value;
}

export function parseProposalPreview(raw: unknown, expected: ProposalInputs['getPreview']) {
  const value = preview.parse(raw);
  assertTarget(value, expected);
  if (value.previewId !== expected.previewId) throw new Error('proposal_preview_mismatch');
  return value;
}

export function parseProposalEditTarget(raw: unknown, expected: ProposalInputs['editTargets']) {
  const value = editTarget.parse(raw);
  assertTarget(value, expected);
  if (value.occurrence.scheduleRowId !== expected.scheduleRowId) throw new Error('proposal_occurrence_mismatch');
  return value;
}

export function parseProposalAck<Action extends ProposalAction>(
  raw: unknown, action: Action, accountId: string, expected: ProposalTarget & {
    requestId: string; proposalId?: string; expectedEffectiveRevision?: string; expectedConsentGeneration?: string;
  },
): ProposalAck<Action> {
  const value = acks[action].parse(raw) as ProposalAck<Action>;
  assertTarget(value, expected);
  if (value.accountId !== accountId || value.requestId !== expected.requestId ||
      (expected.proposalId !== undefined && (!('proposalId' in value) || value.proposalId !== expected.proposalId)))
    throw new Error('proposal_receipt_mismatch');
  if (('appliedRevision' in value && (expected.expectedEffectiveRevision === undefined ||
      BigInt(value.appliedRevision) !== BigInt(expected.expectedEffectiveRevision) + BigInt(1))) ||
      ('consentGeneration' in value && (expected.expectedConsentGeneration === undefined ||
        BigInt(value.consentGeneration) !== BigInt(expected.expectedConsentGeneration) + BigInt(1))))
    throw new Error('proposal_receipt_mismatch');
  return value;
}
