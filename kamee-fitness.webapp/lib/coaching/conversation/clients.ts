import type { ConversationActor, ConversationApi } from "./generated/conversationApi";
import type { ConversationRosterItem, ConversationServicePolicy } from "./generated/conversationBackendTypes";
import { ConversationActivityCancelledError } from "./generated/conversationErrors";
type ClientsApi = Pick<ConversationApi, "roster" | "servicePolicy" | "acceptPolicy" | "setService">;
export type CoachClientsSnapshot = { items: ConversationRosterItem[]; nextAfterId: string | null; policy: ConversationServicePolicy | null;
  accepted: boolean; serviceFeedback: string | null; error: string | null; loading: boolean; busy: boolean; ready: boolean; retired: boolean; authorityPaused: boolean };
export function createCoachClientsController(ports: { actor: ConversationActor; api(): Promise<ClientsApi>; subscribeBoundary(listener: () => void): () => void }) {
  let snapshot: CoachClientsSnapshot = { items: [], nextAfterId: null, policy: null, accepted: false, serviceFeedback: null, error: null, loading: false, busy: false, ready: false, retired: false, authorityPaused: false };
  const listeners = new Set<() => void>(); let generation = 0; let flight = 0; let active = true; let currentAfterId: string | null = null;
  const publish = (patch: Partial<CoachClientsSnapshot>) => { snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener(); };
  const check = (captured: number) => { ports.actor.assertCurrent(); if (snapshot.retired || captured !== generation) throw Error("account changed"); if (snapshot.authorityPaused) throw Error("verification paused"); };
  const retire = () => { if (snapshot.retired) return; generation++; publish({ items: [], policy: null, accepted: false, serviceFeedback: null, nextAfterId: null, retired: true, loading: false, busy: false, error: null }); };
  const stop = ports.subscribeBoundary(retire);
  async function page(afterId: string | null = null) {
    const previousAfterId = currentAfterId;
    const previous = { items: snapshot.items, nextAfterId: snapshot.nextAfterId, ready: snapshot.ready, error: snapshot.error };
    const changedPage = afterId !== currentAfterId;
    currentAfterId = afterId;
    const captured = generation, request = ++flight; publish({ loading: true, error: null, ...(changedPage ? { items: [] } : {}) });
    try {
      check(captured); const api = await ports.api(); check(captured);
      const result = await api.roster(afterId); check(captured); if (request !== flight) return;
      publish({ items: result.items.filter(item => item.availability.viewerRole === "coach"), nextAfterId: result.nextAfterId, ready: true });
    } catch (error) {
      if (!snapshot.retired && !snapshot.authorityPaused && captured === generation && request === flight) {
        if (error instanceof ConversationActivityCancelledError) { currentAfterId = previousAfterId; publish(previous); }
        else publish({ items: [], nextAfterId: null, error: "Conversations could not be loaded. Please retry.", ready: true });
      }
    }
    finally { if (!snapshot.retired && captured === generation && request === flight) publish({ loading: false }); }
  }
  async function command(work: (api: ClientsApi, captured: number) => Promise<void>) {
    if (snapshot.busy || snapshot.retired || snapshot.authorityPaused) return; const captured = generation;
    publish({ busy: true, error: null });
    try { check(captured); const api = await ports.api(); check(captured); await work(api, captured); check(captured); }
    catch { if (!snapshot.retired && captured === generation) publish({ error: "This change could not be confirmed. Review and try the command again." }); }
    finally { if (!snapshot.retired && captured === generation) publish({ busy: false }); }
  }
  return {
    getSnapshot: () => snapshot, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setActive(value: boolean) { active = value; },
    setAuthorityPaused(paused: boolean) {
      if (snapshot.retired || paused === snapshot.authorityPaused) return;
      generation++; flight++;
      publish({ authorityPaused: paused, ...(paused ? { items: [], policy: null, accepted: false, loading: false, busy: false, ready: false, error: null } : {}) });
    },
    async initialize() {
      const captured = generation;
      await Promise.all([page(currentAfterId), (async () => {
        try { check(captured); const api = await ports.api(); check(captured); const policy = await api.servicePolicy(); check(captured);
          const same = policy.policyVersion === snapshot.policy?.policyVersion && policy.contentHash === snapshot.policy?.contentHash;
          publish({ policy, accepted: same && snapshot.accepted }); }
        catch (error) { if (!(error instanceof ConversationActivityCancelledError) && !snapshot.retired && !snapshot.authorityPaused && captured === generation) publish({ policy: null, error: "Service policy could not be loaded. Please retry." }); }
      })()]);
    },
    page,
    acceptPolicy() {
      const policy = snapshot.policy;
      return command(async (api, captured) => {
        if (!policy) throw Error("policy unavailable");
        await api.acceptPolicy({ policyVersion: policy.policyVersion, contentHash: policy.contentHash }); check(captured);
        if (snapshot.policy?.policyVersion === policy.policyVersion && snapshot.policy.contentHash === policy.contentHash) publish({ accepted: true });
      });
    },
    setService(available: boolean) { return command(async (api, captured) => {
      await api.setService(available); check(captured); publish({ serviceFeedback: available ? "Availability made available." : "Availability paused." });
      if (active) await page(currentAfterId); check(captured);
    }); },
    dispose() { retire(); stop(); listeners.clear(); },
  };
}
