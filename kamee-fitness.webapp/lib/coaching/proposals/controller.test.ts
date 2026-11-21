import { describe, expect, it, vi } from "vitest";
import { createCoachProposalsController } from "./controller";
import { createProposalJournal } from "./journal";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = { enrollmentAttemptId: id(1), conversationId: id(2) };
const scope = { expectedControlRevision: "4", expectedEffectiveRevision: "0" };
const occurrence = { scheduleRowId: id(6), planDayId: id(7), dayLineageKey: id(8), scheduledDate: "2026-11-24" };
const operation = { kind: "move_occurrence" as const, selector: occurrence, newDate: "2026-11-25" };
function fixture() {
  let current = true, targetCurrent = true, accepted = false, nextRequest = 20;
  const storage = new Map<string, string>();
  const actor = { accountId: id(3), revision: 1, assertCurrent() { if (!current) throw Error("account changed"); } };
  const journal = createProposalJournal({ actor, target, storage: {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); },
  } });
  const consent = () => ({ ...target, accountId: id(3), participant: "coach" as const, grantId: id(4), consentGeneration: "2", consentActive: accepted,
    disclosure: { policyVersion: "reviewed-v1", policyHash: "a".repeat(64), text: "Actual separate proposal disclosure", disclosureWitness: "b".repeat(64) } });
  const preview = { ...target, previewId: id(10), previewHash: "c".repeat(64), note: null,
    changes: [{ kind: "move_occurrence", selector: occurrence, before: { scheduledDate: "2026-11-24", scheduledTime: null }, after: { scheduledDate: "2026-11-25", scheduledTime: null } }] };
  const api = {
    consent: vi.fn(async () => consent()), list: vi.fn(async () => ({ ...target, proposals: [], nextCursor: null, editorScope: accepted ? scope : null })),
    setConsent: vi.fn(async () => { accepted = true; return { action: "consent_accept", outcome: "accepted" }; }),
    editTargets: vi.fn(async () => ({ ...target, occurrence, scheduledTime: null, strength: [], outdoor: null })),
    preview: vi.fn(async () => ({ action: "preview", outcome: "previewed", previewId: id(10) })), getPreview: vi.fn(async () => preview),
    send: vi.fn(async () => ({ action: "send", outcome: "sent", proposalId: id(11) })),
    withdraw: vi.fn(async () => ({ action: "withdraw", outcome: "withdrawn", proposalId: id(11) })),
    getProposal: vi.fn(async () => ({ ...target, proposalId: id(11), proposalRevision: "0", state: "pending", createdAt: "2026-11-21T00:00:00Z", resolvedAt: null,
      appliedRevision: null, note: null, operationLabels: ["move_occurrence"], previewHash: preview.previewHash, reviewScope: scope, changes: preview.changes,
      actions: { canApply: false, canDecline: false, canWithdraw: true } })),
  };
  const capture = vi.fn(async () => api);
  const make = () => createCoachProposalsController({ actor, target, journal, capture: capture as never, isCurrent: () => current && targetCurrent, newRequestId: () => id(nextRequest++) });
  return { actor, target, api, journal, storage, capture, make, consent, replaceAccount: () => { current = false; }, replaceTarget: () => { targetCurrent = false; }, accept: () => { accepted = true; } };
}
describe("coach proposal participant flow", () => {
  it("requires the actual displayed disclosure and separate consent before editing", async () => {
    const f = fixture(), c = f.make(); await c.initialize();
    await c.choose(occurrence.scheduleRowId); expect(f.api.editTargets).not.toHaveBeenCalled();
    await c.consentTo("accept", { ...f.consent().disclosure, disclosureWitness: "d".repeat(64) });
    expect(f.api.setConsent).not.toHaveBeenCalled();
    await c.consentTo("accept", f.consent().disclosure);
    expect(f.api.setConsent).toHaveBeenCalledWith(expect.objectContaining({ ...target, grantId: id(4), expectedConsentGeneration: "2", policyVersion: "reviewed-v1", policyHash: "a".repeat(64), disclosureWitness: "b".repeat(64) }));
    await c.choose(occurrence.scheduleRowId); expect(c.getSnapshot().targets?.occurrence).toEqual(occurrence);
  });
  it("shows the server preview before sending, then reads and withdraws the pending proposal", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    await c.sendPreview(); expect(f.api.send).not.toHaveBeenCalled();
    await c.createPreview([operation], null); expect(c.getSnapshot().preview?.changes[0].kind).toBe("move_occurrence");
    await c.sendPreview(); expect(f.api.send).toHaveBeenCalledWith({ ...target, ...scope, previewId: id(10), previewHash: "c".repeat(64), requestId: id(21) });
    await c.review(id(11)); await c.withdraw(); expect(f.api.withdraw).toHaveBeenCalledWith({ ...target, proposalId: id(11), expectedProposalRevision: "0", requestId: id(22) });
  });
  it("persists before dispatch and retries the frozen request after lost response and controller recovery", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    f.api.preview.mockImplementationOnce(async () => { expect(f.storage.size).toBe(1); throw new TypeError("lost response"); });
    const changes = [structuredClone(operation)]; await c.createPreview(changes, "Original");
    changes[0].newDate = "2026-12-01"; expect(c.getSnapshot().pending).toBe(true);
    await c.initialize({ background: true });
    expect(c.getSnapshot().message).toBe("The result is unconfirmed. Check the same request.");
    expect(f.api.preview).toHaveBeenCalledTimes(1);
    await c.createPreview([operation], "Different"); expect(f.api.preview).toHaveBeenCalledTimes(1);
    c.dispose(); const recovered = f.make(); await recovered.initialize(); await recovered.retry();
    expect(f.api.preview).toHaveBeenCalledTimes(2); expect(f.api.preview.mock.calls[1]).toEqual(f.api.preview.mock.calls[0]);
    expect(recovered.getSnapshot().pending).toBe(false); expect(f.storage.size).toBe(0);
  });
  it("retains an uncertain PT503 retry but releases a definitive stale-authority refusal", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    f.api.preview.mockRejectedValueOnce(new TypeError("lost")).mockRejectedValueOnce({ code: "PT503" }).mockRejectedValueOnce({ code: "PT409" });
    await c.createPreview([operation], null); await c.retry(); expect(c.getSnapshot().pending).toBe(true);
    await c.retry(); expect(c.getSnapshot().pending).toBe(false); expect(f.storage.size).toBe(0);
  });
  it("never follows a late account-changed capture with a mutation or private publication", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    let release!: (value: typeof f.api) => void; f.capture.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const work = c.createPreview([operation], null); f.replaceAccount(); release(f.api); await work;
    expect(f.api.preview).not.toHaveBeenCalled(); expect(c.getSnapshot().consent).toBeNull(); expect(c.getSnapshot().preview).toBeNull();
  });
  it("hides private state on inactivity, rejects stale handlers, and retains exact uncertain recovery", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    f.api.preview.mockRejectedValueOnce(new TypeError("lost")); await c.createPreview([operation], null);
    c.setActive(false); expect(c.getSnapshot().page).toBeNull(); await c.retry(); expect(f.api.preview).toHaveBeenCalledTimes(1);
    c.setActive(true); await c.retry(); expect(f.api.preview).toHaveBeenCalledTimes(2);
  });
  it("does not dispatch when durable recovery cannot be written", async () => {
    const f = fixture(); f.accept(); const c = createCoachProposalsController({ actor: f.actor, target, capture: f.capture as never,
      journal: { load: () => null, save() { throw Error("storage unavailable"); }, clear() {} }, isCurrent: () => true, newRequestId: () => id(20) });
    await c.initialize(); await c.createPreview([operation], null); expect(f.api.preview).not.toHaveBeenCalled();
  });
  it("retains a reviewed preview across a same-authority refresh but drops it when the consent generation changes", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize(); await c.createPreview([operation], null);
    await c.initialize(); expect(c.getSnapshot().preview?.previewHash).toBe("c".repeat(64));
    f.api.consent.mockResolvedValueOnce({ ...f.consent(), consentGeneration: "3" });
    await c.initialize(); expect(c.getSnapshot().preview).toBeNull(); await c.sendPreview(); expect(f.api.send).not.toHaveBeenCalled();
  });
  it("never follows an old-attempt acknowledgement with a private preview read", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    let finish!: (value: never) => void;
    f.api.preview.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const work = c.createPreview([operation], null); await Promise.resolve(); f.replaceTarget(); finish({ action: "preview", outcome: "previewed", previewId: id(10) } as never); await work;
    expect(f.api.getPreview).not.toHaveBeenCalled(); expect(c.getSnapshot().preview).toBeNull(); expect(f.storage.size).toBe(1);
  });
  it("does not report success when an acknowledged request cannot be cleared durably", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    const clear = vi.spyOn(f.journal, "clear").mockImplementationOnce(() => { throw Error("storage denied"); });
    await c.createPreview([operation], null); expect(c.getSnapshot().pending).toBe(true); expect(c.getSnapshot().preview).toBeNull();
    await c.retry(); expect(f.api.preview.mock.calls[1]).toEqual(f.api.preview.mock.calls[0]); expect(c.getSnapshot().pending).toBe(false); clear.mockRestore();
  });
  it("clears a prior failed refresh only on a new current operation and preserves consent feedback", async () => {
    const f = fixture(), c = f.make();
    f.api.consent.mockRejectedValueOnce(new Error("SYNTHETIC-LOAD-FAILURE"));
    await c.initialize(); expect(c.getSnapshot().message).toBe("Proposals are unavailable. Check your account and retry.");
    await c.initialize(); expect(c.getSnapshot().ready).toBe(true); expect(c.getSnapshot().message).toBeNull();
    await c.consentTo("accept", f.consent().disclosure);
    expect(c.getSnapshot().message).toBe("Proposal consent saved.");
    c.dispose();
  });
  it("keeps a definitive preview refusal through background refresh, then clears it on successful manual retry", async () => {
    const f = fixture(); f.accept(); const c = f.make(); await c.initialize();
    f.api.preview.mockRejectedValueOnce({ code: "PT409" });
    await c.createPreview([operation], null);
    expect(c.getSnapshot().pending).toBe(false); expect(f.storage.size).toBe(0);
    expect(c.getSnapshot().message).toBe("That request is no longer available. Review current proposals.");
    await c.initialize({ background: true });
    expect(c.getSnapshot().ready).toBe(true);
    expect(c.getSnapshot().message).toBe("That request is no longer available. Review current proposals.");
    expect(f.api.preview).toHaveBeenCalledTimes(1);
    await c.retry(); expect(c.getSnapshot().message).toBeNull();
    expect(f.api.preview).toHaveBeenCalledTimes(1);
  });
  it("keeps successful mutation feedback during background refresh but not manual refresh or activity reset", async () => {
    const f = fixture(), c = f.make(); await c.initialize();
    await c.consentTo("accept", f.consent().disclosure);
    await c.initialize({ background: true });
    expect(c.getSnapshot().message).toBe("Proposal consent saved.");
    await c.initialize(); expect(c.getSnapshot().message).toBeNull();
    await c.createPreview([operation], null); expect(c.getSnapshot().message).toBe("Preview ready.");
    c.setActive(false); expect(c.getSnapshot().message).toBeNull();
    c.setActive(true); await c.initialize({ background: true });
    expect(c.getSnapshot().message).toBeNull();
  });
});
