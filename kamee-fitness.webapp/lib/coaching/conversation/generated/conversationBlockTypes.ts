// Generated from src/lib/coaching/conversationBlockTypes.ts; run the app sync-coaching-conversation-client script. Do not edit.
/** C1c wire validation; a block acknowledgement never grants conversation authority. */
import { z } from 'zod';
import { ConversationKnownTarget } from './conversationBackendTypes';
import { enrollmentUuid } from './enrollmentTypes';

const targetSchema = z.object({
  accountId: enrollmentUuid,
  enrollmentAttemptId: enrollmentUuid,
  conversationId: enrollmentUuid,
}).strict();
const ackSchema = targetSchema.extend({ blocked: z.boolean() }).strict();
export type ConversationBlockAck = z.infer<typeof ackSchema>;

export function parseConversationBlockAck(
  value: unknown,
  target: ConversationKnownTarget,
  blocked: boolean,
): ConversationBlockAck {
  const expected = targetSchema.parse(target);
  const desired = z.boolean().parse(blocked);
  const result = ackSchema.parse(value);
  if (
    result.accountId !== expected.accountId ||
    result.enrollmentAttemptId !== expected.enrollmentAttemptId ||
    result.conversationId !== expected.conversationId ||
    result.blocked !== desired
  ) throw new Error('Mismatched conversation block acknowledgement');
  return result;
}
