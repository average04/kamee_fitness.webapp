// Generated from src/lib/coaching/conversationPresentation.ts; run the app sync-coaching-conversation-client script. Do not edit.
import type { ConversationMessage, ConversationReason } from './conversationTypes';
import type { ConversationDelivery } from './conversationController';

const reasons: Record<ConversationReason, string> = {
  active: 'Conversation is open.',
  not_enabled: 'Conversations are not available yet.',
  not_eligible: 'This coaching attempt is not eligible for a conversation.',
  consent_required: 'Conversation consent is required. Review the current policy.',
  suspended: 'This conversation is suspended.',
  coach_unavailable: 'The coach is unavailable for conversations.',
  completed: 'This coaching attempt is complete. You can read its history.',
  restarted: 'This coaching attempt was restarted. You can read its history.',
  stopped: 'This coaching attempt was stopped. You can read its history.',
  refunded: 'This coaching attempt was refunded. You can read its history.',
  access_expired: 'Access to this coaching attempt has expired.',
  blocked: 'This conversation is unavailable because a person block applies.',
  coach_deleted: 'The coach account is no longer available.',
  restricted: 'This conversation is restricted.',
};
export function conversationReasonLabel(reason: ConversationReason): string {
  return reasons[reason];
}
export function conversationMessageLabel(message: ConversationMessage): string {
  if (message.kind === 'removed') return 'Message removed';
  if (message.kind === 'text') return message.author === 'coach' ? 'Coach' : 'Buyer';
  const events: Record<Extract<ConversationMessage, { kind: 'system' }>['event'], string> = {
    opened: 'Conversation opened',
    suspended: 'Conversation suspended',
    resumed: 'Conversation resumed',
    closed: 'Conversation closed',
  };
  return events[message.event];
}
export function deliveryLabel(delivery: ConversationDelivery): string {
  const labels: Record<ConversationDelivery, string> = {
    idle: '',
    sending: 'Sending…',
    sent: 'Sent.',
    not_sent: 'Not sent. Your text is available to edit and send again.',
    checking: 'Checking delivery. The original request is saved. Retry to check it.',
    unknown:
      'Delivery is unknown. The original text is kept below; sending it again could duplicate it.',
  };
  return labels[delivery];
}
