import type { ConversationActor } from "../conversation/generated/conversationApi";
import type { CoachingProposalsApi } from "./api";
import { proposalInputs, type ProposalAck, type ProposalConsent, type ProposalDetail, type ProposalEditTarget, type ProposalOperation, type ProposalPage, type ProposalPreview, type ProposalTarget } from "./types";
import type { Mutation, Pending, ProposalJournal } from "./journal";
export type CoachProposalsSnapshot = { consent: ProposalConsent | null; page: ProposalPage | null; detail: ProposalDetail | null; targets: ProposalEditTarget | null;
  preview: ProposalPreview | null; pending: boolean; busy: boolean; message: string | null; ready: boolean };
const empty: CoachProposalsSnapshot = { consent: null, page: null, detail: null, targets: null, preview: null, pending: false, busy: false, message: null, ready: false };
const definitive = new Set(["PT400", "PT401", "PT403", "PT404", "PT409", "PT503"]);
const feedback: Record<ProposalAck["outcome"], string> = { accepted: "Proposal consent saved.", revoked: "Proposal consent withdrawn.", previewed: "Preview ready.", sent: "Proposal sent.", withdrawn: "Proposal withdrawn.", applied: "Plan updated.", conflict: "The schedule changed.", declined: "Current plan kept." };
export function createCoachProposalsController(ports: { actor: ConversationActor; target: ProposalTarget; journal: ProposalJournal;
  capture(): Promise<CoachingProposalsApi>; isCurrent(): boolean; newRequestId(): string }) {
  const target = proposalInputs.consent.parse(ports.target);
  let state = empty, active = true, disposed = false, running = false, generation = 0, recovered = false, pending: Pending | null = null, recoveryFailed = false;
  const listeners = new Set<() => void>();
  const current = () => { try { ports.actor.assertCurrent(); return !disposed && active && ports.isCurrent(); } catch { return false; } };
  const check = (g = generation) => { if (!current() || g !== generation) throw Error("proposal_scope_changed"); };
  const publish = (next: Partial<CoachProposalsSnapshot>) => { if (!current()) return; state = { ...state, ...next }; for (const listener of listeners) listener(); };
  const resetPrivate = () => { state = { ...empty, pending: !!pending, message: recoveryFailed ? "Proposal recovery could not be read. Keep this tab and retry." : null }; for (const listener of listeners) listener(); };
  async function run(work: (api: CoachingProposalsApi, g: number) => Promise<void>) {
    if (!current() || running) return;
    running = true; const g = generation; publish({ busy: true });
    try { const api = await ports.capture(); check(g); await work(api, g); }
    catch { if (current() && g === generation) publish({ consent: null, page: null, detail: null, targets: null, preview: null, message: "Proposals are unavailable. Check your account and retry." }); }
    finally { running = false; if (g === generation) publish({ busy: false }); }
  }
  function recover() {
    if (recovered) return;
    try { pending = ports.journal.load(); recovered = true; recoveryFailed = false; publish({ pending: !!pending }); }
    catch { recoveryFailed = true; throw Error("proposal_recovery_unavailable"); }
  }
  async function load(api: CoachingProposalsApi, g: number) {
    const before = state;
    const consent = await api.consent(target); check(g);
    if (consent.participant !== "coach") throw Error("proposal_role_changed");
    const page = await api.list({ ...target, cursor: null, limit: 20 }).catch(error => {
      if (["PT403", "PT404"].includes(String(error?.code))) return null; throw error;
    }); check(g);
    const sameAuthority = !pending && consent.consentActive && consent.grantId === before.consent?.grantId && consent.consentGeneration === before.consent?.consentGeneration &&
      page?.editorScope != null && JSON.stringify(page.editorScope) === JSON.stringify(before.page?.editorScope);
    const preview = sameAuthority && before.preview && page?.editorScope
      ? await api.getPreview({ ...target, ...page.editorScope, previewId: before.preview.previewId }).catch(() => null) : null;
    check(g);
    const targets = sameAuthority && before.targets && page?.editorScope
      ? await api.editTargets({ ...target, ...page.editorScope, scheduleRowId: before.targets.occurrence.scheduleRowId }).catch(() => null) : null;
    check(g);
    publish({ consent, page, detail: null, preview: preview?.previewHash === before.preview?.previewHash ? preview : null, targets, ready: true });
  }
  async function execute() {
    if (!pending || recoveryFailed || !current() || running) return;
    const saved = pending;
    await run(async (api, g) => {
      check(g); if (pending !== saved) return;
      const wasUncertain = saved.uncertain;
      // Durable immutable request precedes every possible HTTP mutation.
      const sent = { mutation: saved.mutation, uncertain: true };
      ports.journal.save(sent); check(g); pending = sent;
      let ack: ProposalAck;
      try {
        const mutation = sent.mutation;
        switch (mutation.name) {
          case "setConsent": ack = await api.setConsent(mutation.input); break;
          case "preview": ack = await api.preview(mutation.input); break;
          case "send": ack = await api.send(mutation.input); break;
          case "withdraw": ack = await api.withdraw(mutation.input); break;
        }
      } catch (error) {
        check(g);
        const code = String(error && typeof error === "object" && "code" in error ? error.code : "");
        if (definitive.has(code) && (!wasUncertain || code !== "PT503")) {
          ports.journal.clear(); pending = null;
          publish({ pending: false, detail: null, preview: null, targets: null, consent: null, page: null, message: "That request is no longer available. Review current proposals." });
          await load(api, g);
        } else publish({ pending: true, detail: null, preview: null, targets: null, message: "The result is unconfirmed. Check the same request." });
        return;
      }
      check(g); ports.journal.clear(); check(g); pending = null;
      publish({ pending: false, message: feedback[ack.outcome] });
      if (ack.action === "preview" && sent.mutation.name === "preview") {
        const { expectedControlRevision, expectedEffectiveRevision } = sent.mutation.input;
        const preview = await api.getPreview({ ...target, expectedControlRevision, expectedEffectiveRevision, previewId: ack.previewId }); check(g);
        publish({ preview, targets: null });
      } else await load(api, g);
    });
    if (pending) publish({ pending: true });
  }
  async function submit(mutation: Mutation) {
    if (!current() || running || recoveryFailed) return;
    try {
      recover(); if (pending) return;
      const parsed = proposalInputs[mutation.name].parse(mutation.input);
      const saved = { mutation: { name: mutation.name, input: parsed } as Mutation, uncertain: false };
      ports.journal.save(saved); pending = saved; publish({ pending: true });
    } catch { publish({ message: "The request could not be saved. No change was sent." }); return; }
    await execute();
  }
  const controller = {
    getSnapshot: () => current() ? state : empty,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setActive(value: boolean) { if (active === value) return; active = value; generation++; resetPrivate(); },
    async initialize() { if (!current()) return; try { recover(); } catch { publish({ message: "Proposal recovery could not be read. Keep this tab and retry." }); return; } await run(load); },
    async retry() { if (!current()) return; try { recover(); } catch { return; } if (pending) await execute(); else await run(load); },
    async consentTo(action: "accept" | "revoke", displayed?: NonNullable<ProposalConsent["disclosure"]>) {
      const consent = state.consent; if (!current() || !consent?.grantId) return;
      const common = { ...target, grantId: consent.grantId, expectedConsentGeneration: consent.consentGeneration, requestId: ports.newRequestId() };
      if (action === "accept") {
        if (!consent.disclosure || JSON.stringify(displayed) !== JSON.stringify(consent.disclosure)) return;
        const { policyVersion, policyHash, disclosureWitness } = consent.disclosure;
        await submit({ name: "setConsent", input: { ...common, action, policyVersion, policyHash, disclosureWitness } });
      } else await submit({ name: "setConsent", input: { ...common, action } });
    },
    async choose(scheduleRowId: string) {
      const scope = state.page?.editorScope; if (!current() || pending || !scope || !state.consent?.consentActive) return;
      await run(async (api, g) => { const targets = await api.editTargets({ ...target, ...scope, scheduleRowId }); check(g); publish({ targets }); });
    },
    async createPreview(changes: ProposalOperation[], note: string | null) {
      const scope = state.page?.editorScope;
      if (!current() || !scope || !state.consent?.consentActive || state.page?.proposals.some(row => row.state === "pending")) return;
      await submit({ name: "preview", input: { ...target, ...scope, requestId: ports.newRequestId(), changes, note } });
    },
    discardPreview() { if (!running && !pending) publish({ preview: null }); },
    async sendPreview() {
      const preview = state.preview, scope = state.page?.editorScope;
      if (!preview || !scope || !state.consent?.consentActive) return;
      await submit({ name: "send", input: { ...target, ...scope, requestId: ports.newRequestId(), previewId: preview.previewId, previewHash: preview.previewHash } });
    },
    async review(proposalId: string) { if (pending) return; await run(async (api, g) => { const detail = await api.getProposal({ ...target, proposalId }); check(g); publish({ detail }); }); },
    closeReview() { if (!running) publish({ detail: null }); },
    async withdraw() {
      const detail = state.detail; if (!detail?.actions.canWithdraw) return;
      await submit({ name: "withdraw", input: { ...target, proposalId: detail.proposalId, expectedProposalRevision: detail.proposalRevision, requestId: ports.newRequestId() } });
    },
    async more() {
      const page = state.page; if (!page?.nextCursor || pending) return;
      await run(async (api, g) => { const next = await api.list({ ...target, cursor: page.nextCursor, limit: 20 }); check(g);
        const known = new Set(page.proposals.map(row => row.proposalId)); publish({ page: { ...next, proposals: [...page.proposals, ...next.proposals.filter(row => !known.has(row.proposalId))] } }); });
    },
    dispose() { disposed = true; generation++; state = empty; for (const listener of listeners) listener(); listeners.clear(); },
  };
  return controller;
}
export type CoachProposalsController = ReturnType<typeof createCoachProposalsController>;
