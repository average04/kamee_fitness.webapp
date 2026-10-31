import { COACHING_CONVERSATIONS_ENABLED } from "./flags";
import { subscribeAuthBoundary } from "@/lib/auth-boundary";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { createConversationApi } from "./generated/conversationApi";
import { createConversationHttpRequest } from "./generated/conversationHttp";
import { ConversationActivityCancelledError } from "./generated/conversationErrors";

type Session = { user: { id: string }; access_token: string };
export type BrowserAuth = {
  getSession(): Promise<{ data: { session: Session | null }; error?: unknown }>;
  getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }>;
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe(): void } } };
};
type RuntimeOptions = { auth: BrowserAuth; enabled?: boolean; fetch?: typeof fetch; url?: string; anonKey?: string };
let nextGeneration = 0;
export function createBrowserConversationRuntime(expectedAccountId: string, options: RuntimeOptions = {
  auth: createBrowserSupabase().auth, url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}) {
  const revision = ++nextGeneration; let retired = false, active = true, verified = false, verificationKnown = false, paused = false, verificationEpoch = 0;
  let verificationFlight: Promise<Session> | null = null;
  const listeners = new Set<() => void>(), verificationListeners = new Set<(verified: boolean) => void>();
  const publishVerified = (value: boolean) => { if (verificationKnown && verified === value) return; verificationKnown = true; verified = value; for (const listener of [...verificationListeners]) listener(value); };
  const pause = () => { paused = true; verificationEpoch++; verificationFlight = null; publishVerified(false); };
  const retire = () => {
    if (retired) return; retired = true; ++nextGeneration;
    // Permanent boundaries notify the retirement port, not the reversible pause port.
    paused = true; verified = false; verificationEpoch++; verificationFlight = null;
    for (const listener of [...listeners]) listener();
  };
  const actor = { accountId: expectedAccountId, revision, assertCurrent() { if (retired) throw Error("Conversation account changed."); } };
  const subscription = options.auth.onAuthStateChange((event, session) => {
    // Never await getUser here: Supabase auth callbacks hold an internal lock.
    if (event === "SIGNED_OUT" || (session && session.user.id !== expectedAccountId) || (event === "INITIAL_SESSION" && !session)) retire();
    else if (!session) pause();
  }).data.subscription;
  const stopBoundary = subscribeAuthBoundary(retire);
  function verifiedSession(): Promise<Session> {
    actor.assertCurrent();
    if (verificationFlight) return verificationFlight;
    const epoch = verificationEpoch;
    const check = () => { actor.assertCurrent(); if (epoch !== verificationEpoch || !active) throw new ConversationActivityCancelledError(); };
    const flight = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Your sign-in could not be verified. Retry when your connection returns.")), 15_000); });
      const work = async () => {
        const session = await options.auth.getSession(); actor.assertCurrent();
        if (session.data.session && session.data.session.user.id !== expectedAccountId) retire();
        if (!session.error && !session.data.session) retire();
        check(); if (session.error) throw session.error;
        const result = await options.auth.getUser(); actor.assertCurrent();
        if (result.data.user && result.data.user.id !== expectedAccountId) retire();
        if (!result.error && !result.data.user) retire();
        check(); if (result.error) throw result.error;
        return session.data.session!;
      };
      const result = await Promise.race([work(), deadline]); check(); paused = false; publishVerified(true); return result;
      } catch (error) {
        actor.assertCurrent();
        // This entire scope precedes HTTP creation; activity cancellation is not an Auth failure.
        if (error instanceof ConversationActivityCancelledError || epoch !== verificationEpoch || !active) throw new ConversationActivityCancelledError();
        pause(); throw error;
      }
      finally { clearTimeout(timer); if (epoch === verificationEpoch) verificationFlight = null; }
    })();
    verificationFlight = flight; return flight;
  }
  const assertVerified = () => { actor.assertCurrent(); if (paused || !verified) throw Error("Your sign-in could not be verified. Retry when your connection returns."); };
  return {
    actor, retire,
    setActive(value: boolean) { active = value; if (!value) { verificationEpoch++; verificationFlight = null; } },
    subscribeVerification(listener: (verified: boolean) => void) { if (retired) return () => {}; verificationListeners.add(listener); if (verificationKnown) listener(verified && !paused); return () => { verificationListeners.delete(listener); }; },
    subscribeBoundary(listener: () => void) { listeners.add(listener); if (retired) listener(); return () => { listeners.delete(listener); }; },
    async verify() { await verifiedSession(); actor.assertCurrent(); },
    async capture() {
      if (!(options.enabled ?? COACHING_CONVERSATIONS_ENABLED)) throw Error("Conversations are unavailable.");
      actor.assertCurrent();
      if (paused) throw Error("Your sign-in could not be verified. Retry when your connection returns.");
      if (!active) throw new ConversationActivityCancelledError();
      const session = await verifiedSession(); assertVerified();
      if (!active) throw new ConversationActivityCancelledError();
      const request = createConversationHttpRequest({ actor, baseUrl: options.url ?? "", anonKey: options.anonKey ?? "", authorization: `Bearer ${session.access_token}`, fetchImpl: options.fetch });
      return { actor, token: session.access_token, request: async (...args: Parameters<typeof request>) => { assertVerified(); const result = await request(...args); assertVerified(); return result; } };
    },
    dispose() { retire(); stopBoundary(); subscription.unsubscribe(); },
  };
}

export async function captureBrowserConversationApi(runtime: ReturnType<typeof createBrowserConversationRuntime>) {
  const captured = await runtime.capture(); runtime.actor.assertCurrent();
  return createConversationApi(captured);
}
