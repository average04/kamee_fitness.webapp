/** Synthetic-only actual component/controller QA. No Auth client, secrets or hosted requests. */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { ConversationView } from '@/components/coaching/conversation/ConversationView';
import { CoachClientsView } from '@/components/coaching/conversation/CoachClients';
import { createConversationApi, type ConversationActor, type ConversationRequest } from '@/lib/coaching/conversation/generated/conversationApi';
import { createConversationController } from '@/lib/coaching/conversation/generated/conversationController';
import { createConversationJournalManager } from '@/lib/coaching/conversation/generated/conversationJournalCore';
import { ConversationRpcError } from '@/lib/coaching/conversation/generated/conversationErrors';
import { parseSendConversationInput, type ConversationAvailability, type ConversationMessage, type ConversationReason } from '@/lib/coaching/conversation/generated/conversationTypes';
import { parseConversationReportInput } from '@/lib/coaching/conversation/generated/conversationBackendTypes';
import { createCoachClientsController } from '@/lib/coaching/conversation/clients';
import { createConversationLifecycle } from '@/lib/coaching/conversation/lifecycle';
import '@/app/globals.css';
import '@/app/coaching/workspace.css';
import './style.css';

const id = (family: number, value: number) => `${String(family).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;
const policy = { policyVersion: 'synthetic-c1-v1', contentHash: 'a'.repeat(64), body: 'Synthetic QA sharing policy. Only this plan, its schedule summary and messages deliberately entered here are shared.' };
const created = (value: number) => new Date(Date.UTC(2026, 9, 31, 12, 0, value)).toISOString();
const storage = new Map<string, string>();
const storagePort = { getItem: async (key: string) => storage.get(key) ?? null, setItem: async (key: string, value: string) => { storage.set(key, value); }, removeItem: async (key: string) => { storage.delete(key); }, getAllKeys: async () => [...storage.keys()] };
let generation = 0;

function fixture(coach: number) {
  const accountId = id(100, coach === 1 ? 2 : 4), revision = ++generation;
  let current = true, reason: ConversationReason = 'active', serviceAvailable = true, ownBlock = false;
  let loseNextSend = false, dropNextSend = false, loseNextReport = false, buyerConsent = true, coachConsent = true;
  let policyCoachName = `Synthetic Coach ${coach}`;
  let controlRevision = BigInt(3);
  const listeners = new Set<() => void>(), statsListeners = new Set<() => void>();
  const attempted = id(200, coach === 1 ? 1 : 3), conversationId = id(300, coach === 1 ? 1 : 3);
  const actor: ConversationActor = { accountId, revision, assertCurrent() { if (!current) throw Error('account_changed'); } };
  const subscribeBoundary = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
  let stats = { rpcCount: 0, sends: [] as { requestId: string; body: string; expectedControlRevision: string }[], reports: [] as string[], readSequences: [] as string[] };
  const publish = () => { stats = { ...stats }; for (const fn of statsListeners) fn(); };
  const messages: ConversationMessage[] = Array.from({ length: 115 }, (_, index) => ({
    id: id(500, coach * 1000 + index + 1), sequence: String(index + 1), createdAt: created(index), kind: 'text',
    author: index % 2 ? 'coach' : 'buyer', body: index === 89 ? 'Literal text: <img src=x onerror=alert(1)>\nIntentional second line.' : `Synthetic ${index % 2 ? 'coach' : 'member'} message ${index + 1}.`,
  }));
  const receipts = new Map<string, unknown>(), reportReceipts = new Map<string, unknown>();
  const known = (attemptId = attempted) => ({ accountId, enrollmentAttemptId: attemptId, conversationId: attemptId === attempted ? conversationId : id(300, coach === 1 ? 2 : 4) });
  const availability = (attemptId = attempted): ConversationAvailability => {
    const actualReason = reason !== 'active' ? reason : !serviceAvailable ? 'coach_unavailable' : ownBlock ? 'blocked' : !buyerConsent || !coachConsent ? 'consent_required' : 'active';
    return { ...known(attemptId), controlRevision: String(controlRevision), viewerRole: 'coach', reason: actualReason,
      capabilities: { canReadHistory: true, canSend: actualReason === 'active', canRequestKamy: false, canCreateProposal: false, canApplyProposal: false } };
  };
  const request: ConversationRequest = async (name, args) => {
    actor.assertCurrent(); stats.rpcCount++; publish();
    switch (name) {
      case 'get_coaching_conversation': return availability(String(args.p_attempt_id));
      case 'get_coaching_conversation_policy': return { accountId, enrollmentAttemptId: attempted, ...policy, coachName: policyCoachName };
      case 'get_coaching_conversation_service_policy': return { accountId, ...policy };
      case 'accept_coaching_conversation_policy': return { accountId, policyVersion: args.p_version, contentHash: args.p_content_hash, acceptedAt: created(0) };
      case 'set_coaching_conversation_service': serviceAvailable = args.p_available === true; controlRevision++; return { accountId, available: serviceAvailable, revision: String(controlRevision) };
      case 'list_coaching_conversations': return { accountId, items: [attempted, id(200, coach === 1 ? 2 : 4)].map(attemptId => ({ enrollmentAttemptId: attemptId, conversationId: known(attemptId).conversationId, availability: availability(attemptId), unreadCount: '2' })), nextAfterId: null };
      case 'get_coaching_conversation_context': return { ...known(), controlRevision: String(controlRevision), context: availability().capabilities.canSend ? {
        planTitle: 'Synthetic eight-week plan', buyerName: `Synthetic Member ${coach}`, coachName: `Synthetic Coach ${coach}`,
        days: [{ scheduleRowId: id(700, coach), dayLabel: 'Week 1 · Day 1', scheduledDate: '2026-11-01', state: 'scheduled' }], nextAfterScheduleId: null,
      } : null };
      case 'list_coaching_conversation_messages': {
        const before = args.p_before_sequence === undefined ? null : BigInt(String(args.p_before_sequence));
        const eligible = messages.filter(message => before === null || BigInt(message.sequence) < before), page = eligible.slice(-50);
        return { ...known(), messages: page, nextBeforeSequence: eligible.length > 50 ? page[0]!.sequence : null };
      }
      case 'send_coaching_conversation_message': {
        const input = parseSendConversationInput(args.p_input);
        stats.sends = [...stats.sends, input]; publish();
        if (receipts.has(input.requestId)) return receipts.get(input.requestId);
        if (dropNextSend) { dropNextSend = false; throw new TypeError('Synthetic lost request before commit'); }
        if (!availability().capabilities.canSend) throw new ConversationRpcError({ code: 'PT403', message: reason }, 403);
        if (input.expectedControlRevision !== String(controlRevision)) throw new ConversationRpcError({ code: 'PT409', message: 'Conversation revision conflict' }, 409);
        const sequence = String(BigInt(messages.at(-1)!.sequence) + BigInt(1)), messageId = id(500, coach * 1000 + Number(sequence));
        messages.push({ id: messageId, sequence, createdAt: created(Number(sequence)), kind: 'text', author: 'coach', body: input.body });
        const ack = { ...known(), requestId: input.requestId, messageId, sequence, createdAt: created(Number(sequence)) }; receipts.set(input.requestId, ack);
        if (loseNextSend) { loseNextSend = false; throw new TypeError('Synthetic lost reply after commit'); }
        return ack;
      }
      case 'mark_coaching_conversation_read': {
        const input = args.p_input as { requestId: string; sequence: string };
        stats.readSequences = [...stats.readSequences, input.sequence]; publish(); return { ...known(), requestId: input.requestId, lastReadSequence: input.sequence };
      }
      case 'report_coaching_conversation': {
        const input = parseConversationReportInput(args.p_input); stats.reports = [...stats.reports, input.requestId]; publish();
        if (reportReceipts.has(input.requestId)) return reportReceipts.get(input.requestId);
        const result = { ...known(), requestId: input.requestId, caseId: id(600, reportReceipts.size + 1) }; reportReceipts.set(input.requestId, result);
        if (loseNextReport) { loseNextReport = false; throw new TypeError('Synthetic lost report reply'); } return result;
      }
      case 'set_coaching_conversation_block': ownBlock = args.p_blocked === true; buyerConsent = coachConsent = false; controlRevision++; return { ...known(), blocked: ownBlock };
      case 'set_coaching_conversation_consent': coachConsent = true; return { requestId: (args.p_input as { requestId: string }).requestId, availability: availability() };
      default: throw Error('Synthetic fixture does not implement ' + name);
    }
  };
  const manager = createConversationJournalManager({ storage: storagePort, restoreFence: async () => {}, runWrite: async (_owner, work) => { actor.assertCurrent(); const result = await work(); actor.assertCurrent(); return result; } });
  const api = async () => createConversationApi({ actor, request });
  const controller = createConversationController({ actor, attemptId: attempted, api, journal: manager.bind(actor), newRequestId: () => crypto.randomUUID(), subscribeBoundary, expectedViewerRole: 'coach' });
  const clients = createCoachClientsController({ actor, api, subscribeBoundary });
  return { actor, controller, clients, accountId, revision,
    statsSnapshot: () => stats, subscribeStats(fn: () => void) { statsListeners.add(fn); return () => { statsListeners.delete(fn); }; },
    loseSend() { loseNextSend = true; }, dropSend() { dropNextSend = true; }, loseReport() { loseNextReport = true; },
    renamePolicyCoach() { policyCoachName = `Synthetic Coach ${coach} renamed`; },
    pauseAuthority() { controller.setAuthorityPaused(true); clients.setAuthorityPaused(true); },
    async restoreAuthority() { controller.setAuthorityPaused(false); clients.setAuthorityPaused(false); controller.setActive(document.hasFocus() && document.visibilityState === 'visible' && navigator.onLine); await Promise.all([controller.refresh(), clients.initialize()]); },
    async close() { reason = 'completed'; controlRevision++; await controller.refresh(); },
    async confirmBuyer() { buyerConsent = true; await controller.refresh(); },
    async add() { const sequence = String(BigInt(messages.at(-1)!.sequence) + BigInt(1)); messages.push({ id: id(500, coach * 1000 + Number(sequence)), sequence, createdAt: created(Number(sequence)), kind: 'text', author: 'buyer', body: 'Synthetic newly arrived message.' }); await controller.refresh(); },
    async removeOld() { const first = controller.getSnapshot().messages.find(message => message.kind === 'text'); if (first) { const index = messages.findIndex(message => message.id === first.id); const previous = messages[index]!; messages[index] = { id: previous.id, sequence: previous.sequence, createdAt: previous.createdAt, kind: 'removed' }; } await controller.refresh(); },
    retire() { current = false; for (const listener of [...listeners]) listener(); },
    dispose() { controller.dispose(); clients.dispose(); current = false; },
  };
}

function Evidence({ value }: { value: ReturnType<typeof fixture> }) {
  const stats = useSyncExternalStore(value.subscribeStats, value.statsSnapshot, value.statsSnapshot);
  return <details className="qa-evidence"><summary>Synthetic request evidence</summary><pre id="qa-evidence">{JSON.stringify(stats, null, 2)}</pre></details>;
}
function App() {
  const [coach, setCoach] = useState(1), [value, setValue] = useState(() => fixture(1));
  const [panel, setPanel] = useState<'conversation' | 'clients'>('conversation');
  const [narrow, setNarrow] = useState(false), [large, setLarge] = useState(false);
  useEffect(() => {
    const lifecycle = createConversationLifecycle({ verify: async () => value.actor.assertCurrent(), refresh: () => panel === 'conversation' ? value.controller.refresh() : value.clients.initialize(), setActive: active => value.controller.setActive(active), schedule: (tick, ms) => { const timer = setInterval(tick, ms); return () => clearInterval(timer); } });
    const signals = () => { void lifecycle.update({ focused: document.hasFocus(), visible: document.visibilityState === 'visible', online: navigator.onLine }); };
    void value.controller.initialize(); void value.clients.initialize(); signals();
    for (const event of ['focus', 'blur', 'online', 'offline']) window.addEventListener(event, signals);
    document.addEventListener('visibilitychange', signals);
    return () => { lifecycle.dispose(); for (const event of ['focus', 'blur', 'online', 'offline']) window.removeEventListener(event, signals); document.removeEventListener('visibilitychange', signals); value.dispose(); };
  }, [value, panel]);
  function reset(nextCoach = coach) { value.retire(); setCoach(nextCoach); setValue(fixture(nextCoach)); }
  return <div className="coaching-workspace qa-shell">
    <aside className="qa-toolbar"><strong>SYNTHETIC LOCAL QA · no hosted data</strong>
      <div><button onClick={() => reset()}>Reset fixture</button><button onClick={() => reset(coach === 1 ? 2 : 1)}>Switch coach</button>
        <button onClick={() => { const next = panel === 'conversation' ? 'clients' : 'conversation'; value.retire(); setValue(fixture(coach)); setPanel(next); }}>Show {panel === 'conversation' ? 'Clients' : 'Conversation'}</button>
        <button onClick={() => setNarrow(v => !v)}>Toggle 320px</button><button onClick={() => setLarge(v => !v)}>Toggle large text</button>
        <button onClick={() => value.loseSend()}>Lose next send reply</button><button onClick={() => value.dropSend()}>Drop next send before commit</button><button onClick={() => value.loseReport()}>Lose next report reply</button>
        <button onClick={() => value.renamePolicyCoach()}>Rename policy coach</button>
        <button onClick={() => value.pauseAuthority()}>Pause synthetic authority</button><button onClick={() => void value.restoreAuthority()}>Restore synthetic authority</button>
        <button onClick={() => void value.close()}>Close conversation</button><button onClick={() => void value.add()}>Add new message</button><button onClick={() => void value.removeOld()}>Tombstone first retained</button>
        <button onClick={() => void value.confirmBuyer()}>Confirm buyer sharing</button><button onClick={() => value.retire()}>Retire account</button></div>
    </aside>
    <main className={`qa-viewport ${large ? 'qa-large' : ''}`} style={{ width: narrow ? 320 : 'min(960px, 100%)' }}>
      <p className="qa-persona">Synthetic Coach {coach} · account generation {value.revision}</p>
      {panel === 'conversation' ? <ConversationView key={value.revision} controller={value.controller} /> : <CoachClientsView key={value.revision} controller={value.clients} />}
    </main><Evidence key={'evidence-' + value.revision} value={value} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
