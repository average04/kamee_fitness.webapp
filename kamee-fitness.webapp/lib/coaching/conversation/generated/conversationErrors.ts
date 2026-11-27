// Generated from src/lib/coaching/conversationErrors.ts; run the app sync-coaching-conversation-client script. Do not edit.
/** Only an adapter's known activity/epoch cancellation before an RPC port is captured. */
export class ConversationActivityCancelledError extends Error {
  constructor() {
    super('Conversation operation was cancelled before capture.');
    this.name = 'ConversationActivityCancelledError';
  }
}

/** Error evidence from the participant HTTP port; never render backend details. */
export class ConversationRpcError extends Error {
  readonly code: string | null;
  readonly rpcMessage: string | null;
  readonly status: number;
  constructor(body: unknown, status: number) {
    super('Conversation request failed.');
    this.name = 'ConversationRpcError';
    const value =
      body !== null && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    this.code = typeof value.code === 'string' && value.code.length <= 80 ? value.code : null;
    this.rpcMessage = typeof value.message === 'string' ? value.message.slice(0, 256) : null;
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 0;
  }
}

export type ConversationFailureDisposition = 'not_sent' | 'checking' | 'unconfirmed';
export function classifyConversationFailure(
  error: unknown,
  action: 'send' | 'report',
  wasUncertain: boolean,
): ConversationFailureDisposition {
  if (error instanceof ConversationActivityCancelledError)
    return wasUncertain ? 'checking' : 'not_sent';
  if (!(error instanceof ConversationRpcError)) return 'checking';
  const { code, rpcMessage } = error;
  if (
    !wasUncertain &&
    ((action === 'send' &&
      (code === 'PT400' ||
        code === 'PT403' ||
        (code === 'PT409' && rpcMessage === 'Conversation revision conflict'))) ||
      (action === 'report' && (code === 'PT400' || code === 'PT429')))
  )
    return 'not_sent';
  if (code === 'PT404' || code === 'PT409' || (action === 'report' && code === 'PT403'))
    return 'unconfirmed';
  return 'checking';
}
