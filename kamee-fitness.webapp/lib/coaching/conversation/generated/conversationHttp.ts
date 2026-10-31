// Generated from src/lib/coaching/conversationHttp.ts; run the app sync-coaching-conversation-client script. Do not edit.
/** A bounded, explicitly authenticated HTTP port shared by native and web. */
import { CONVERSATION_PARTICIPANT_RPCS, type ConversationActor, type ConversationRequest } from './conversationApi';
import { ConversationRpcError } from './conversationErrors';

export const CONVERSATION_REQUEST_TIMEOUT_MS = 15000;
export function createConversationHttpRequest({ actor, baseUrl, anonKey, authorization, fetchImpl = fetch, onSuccess, onFailure }: {
  actor: ConversationActor;
  baseUrl: string;
  anonKey: string;
  authorization: string;
  fetchImpl?: typeof fetch;
  onSuccess?: () => void;
  onFailure?: (error: unknown) => void;
}): ConversationRequest {
  const url = new URL(baseUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password ||
    url.search || url.hash || url.pathname !== '/' || !anonKey || !authorization.startsWith('Bearer ')) throw new Error('invalid_conversation_endpoint');
  const endpoint = url.origin + '/rest/v1/rpc/';
  return async (name, args) => {
    actor.assertCurrent();
    if (!(CONVERSATION_PARTICIPANT_RPCS as readonly string[]).includes(name)) throw new Error('invalid_conversation_rpc');
    const controller = new AbortController();
    let expired = false;
    const timeout = () => { const error = new Error('Conversation response timed out.'); error.name = 'AbortError'; return error; };
    const check = () => { actor.assertCurrent(); if (expired) throw timeout(); };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { expired = true; controller.abort(); reject(timeout()); }, CONVERSATION_REQUEST_TIMEOUT_MS);
    });
    const work = (async () => {
      check();
      const response = await fetchImpl(endpoint + name, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { apikey: anonKey, Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      check();
      const wire: unknown = await response.json();
      check();
      if (!response.ok) throw new ConversationRpcError(wire, response.status);
      return wire;
    })();
    try {
      const wire = await Promise.race([work, deadline]);
      check();
      onSuccess?.();
      check();
      return wire;
    } catch (error) {
      onFailure?.(error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}
