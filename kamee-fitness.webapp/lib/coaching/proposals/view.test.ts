import { createElement, act } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationView } from "@/components/coaching/conversation/ConversationView";
import { CoachProposals, CoachProposalView } from "@/components/coaching/proposals/CoachProposals";
import { createCoachProposalsController } from "./controller";
import * as transport from "./transport";
import { createBrowserConversationRuntime } from "../conversation/runtime";
import type { ConversationController, ConversationSnapshot } from "../conversation/generated/conversationController";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = { enrollmentAttemptId: id(1), conversationId: id(2) }, scope = { expectedControlRevision: "4", expectedEffectiveRevision: "0" };
const occurrence = { scheduleRowId: id(6), planDayId: id(7), dayLineageKey: id(8), scheduledDate: "2026-11-24" };
let root: Root, dom: InstanceType<typeof JSDOM>;
afterEach(async () => { if (root) await act(async () => root.unmount()); dom?.window.close(); vi.restoreAllMocks(); });
async function mount(accepted = false, editorAvailable = true) {
  let consented = accepted;
  const actor = { accountId: id(3), revision: 1, assertCurrent() {} };
  const consent = { ...target, accountId: id(3), participant: "coach", grantId: id(4), consentGeneration: "2", consentActive: false,
    disclosure: { policyVersion: "reviewed-v1", policyHash: "a".repeat(64), text: "Actual separate proposal disclosure", disclosureWitness: "b".repeat(64) } };
  const api = { consent: vi.fn(async () => ({ ...consent, consentActive: consented })), list: vi.fn(async () => ({ ...target, nextCursor: null, proposals: [], editorScope: consented && editorAvailable ? scope : null })),
    setConsent: vi.fn(async () => { consented = true; return { action: "consent_accept", outcome: "accepted" }; }),
    editTargets: vi.fn(async () => ({ ...target, occurrence, scheduledTime: null, strength: [], outdoor: null })),
    preview: vi.fn(async () => ({ action: "preview", outcome: "previewed", previewId: id(10) })),
    getPreview: vi.fn(async () => ({ ...target, previewId: id(10), previewHash: "c".repeat(64), note: null,
      changes: [{ kind: "move_occurrence", selector: occurrence, before: { scheduledDate: "2026-11-24", scheduledTime: null }, after: { scheduledDate: "2026-11-25", scheduledTime: null } }] })),
    send: vi.fn(async () => ({ action: "send", outcome: "sent", proposalId: id(11) })),
  };
  const c = createCoachProposalsController({ actor, target, capture: async () => api as never, isCurrent: () => true, newRequestId: () => id(20), journal: { load: () => null, save() {}, clear() {} } });
  await c.initialize();
  dom = new JSDOM('<div id="root"></div>'); Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  await act(async () => root.render(createElement(CoachProposalView, { controller: c, days: [{ scheduleRowId: id(6), dayLabel: "Day 1", state: "scheduled" }] })));
  const button = (name: string) => Array.from(document.querySelectorAll("button")).find(b => b.textContent === name)!;
  return { c, api, button, click: async (name: string) => { await act(async () => button(name).click()); } };
}
async function input(label: string, value: string) {
  const field = Array.from(document.querySelectorAll("label")).find(l => l.textContent?.startsWith(label))!.querySelector("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(field, value); field.dispatchEvent(new dom.window.Event("input", { bubbles: true })); field.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
}
describe("rendered coach proposal form", () => {
  it("explains an unavailable editor without attributing it to the other participant", async () => {
    const f = await mount(true, false);
    expect(document.body.textContent).toContain("New proposals are unavailable for this enrollment.");
    expect(document.body.textContent).not.toMatch(/client hasn't agreed|waiting for (?:the |your )?(?:client|buyer)/i);
    expect(f.button("Day 1")).toBeUndefined();
  });
  it("shows the real disclosure, requires explicit proposal consent and offers no buyer Apply", async () => {
    const f = await mount(); expect(document.body.textContent).toContain("Actual separate proposal disclosure");
    expect(f.api.setConsent).not.toHaveBeenCalled(); expect(f.button("Day 1")).toBeUndefined();
    await f.click("Allow plan proposals"); expect(f.api.setConsent).toHaveBeenCalledTimes(1); expect(f.button("Day 1")).toBeDefined();
    expect(document.body.textContent).not.toContain("Apply changes");
  });
  it("edits an actual authorized day and displays server before/after before explicit Send", async () => {
    const f = await mount(true); await f.click("Day 1");
    const date = document.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(document.body.textContent).toContain("Choose a future date in this enrollment’s time zone. Today and past dates aren’t available.");
    expect(date.getAttribute("min")).toBeNull();
    await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(date, "2026-11-25"); date.dispatchEvent(new dom.window.Event("input", { bubbles: true })); date.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    await f.click("Add date change"); await f.click("Preview changes");
    expect(document.body.textContent).toContain("Before"); expect(document.body.textContent).toContain("After"); expect(document.body.textContent).toContain("2026-11-25");
    expect(f.api.send).not.toHaveBeenCalled(); await f.click("Send proposal"); expect(f.api.send).toHaveBeenCalledTimes(1);
  });
  it("keeps an uncertain mutation frozen and exposes its explicit same-request retry", async () => {
    const f = await mount(); f.api.setConsent.mockRejectedValueOnce(new TypeError("lost"));
    await f.click("Allow plan proposals"); expect(document.body.textContent).toContain("unconfirmed");
    expect(f.button("Allow plan proposals").disabled).toBe(true);
    await f.click("Check previous request"); expect(f.api.setConsent).toHaveBeenCalledTimes(2); expect(f.api.setConsent.mock.calls[1]).toEqual(f.api.setConsent.mock.calls[0]);
  });
  it("bounds actual strength fields and sends only the selected authorized slot changes", async () => {
    const f = await mount(true), selector = { ...occurrence, blockId: id(31), blockLineageKey: id(32), slotId: id(33), slotLineageKey: id(34) };
    f.api.editTargets.mockResolvedValueOnce({ ...target, occurrence, scheduledTime: null, strength: [{ selector, label: "Squat", trackingType: "weight_reps", sets: 2, reps: "8", restSeconds: 30 }], outdoor: null } as never);
    await f.click("Day 1"); await f.click("Edit Squat"); await input("Sets", "31"); expect(f.button("Add strength change").disabled).toBe(true);
    await input("Sets", "3"); await input("Repetitions", "12"); await input("Rest seconds", "60"); await f.click("Add strength change"); await f.click("Preview changes");
    expect(f.api.preview).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ kind: "edit_strength_slot", selector, changes: { sets: 3, repCount: 12, restSeconds: 60 } }] }));
  });
  it("keeps interval structure and rejects zero seconds before an actual preview request", async () => {
    const f = await mount(true), selector = { ...occurrence, cardioId: id(35), cardioLineageKey: id(36) };
    f.api.editTargets.mockResolvedValueOnce({ ...target, occurrence, scheduledTime: null, strength: [], outdoor: { selector, targetSeconds: 120, timings: [{ kind: "leaf", seconds: 60 }, { kind: "repeat", repeat: 2, of: [{ kind: "leaf", seconds: 30 }] }] } } as never);
    await f.click("Day 1"); await f.click("Edit outdoor intervals"); await input("Interval seconds", "0"); expect(f.button("Add interval changes").disabled).toBe(true);
    await input("Interval seconds", "90"); await f.click("Add interval changes"); await f.click("Preview changes");
    expect(f.api.preview).toHaveBeenCalledWith(expect.objectContaining({ changes: [{ kind: "edit_timed_outdoor", selector, timings: [{ kind: "leaf", seconds: 90 }, { kind: "repeat", repeat: 2, of: [{ kind: "leaf", seconds: 30 }] }] }] }));
  });
});

async function mountParticipant(inWorkspace = false) {
  dom = new JSDOM('<div id="root"></div>', { url: "https://preview.test", pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  document.hasFocus = () => true;
  const runtime = createBrowserConversationRuntime(id(3), { enabled: true, url: "https://example.test", anonKey: "public-key", auth: {
    getSession: async () => ({ data: { session: { user: { id: id(3) }, access_token: "captured-token" } } }), getUser: async () => ({ data: { user: { id: id(3) } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } });
  const snapshot: ConversationSnapshot = {
    availability: { ...target, accountId: id(3), viewerRole: "coach", reason: "active", controlRevision: "1",
      capabilities: { canReadHistory: true, canSend: true, canApplyProposal: false, canRequestKamy: false, canCreateProposal: false } },
    policy: null, context: null, messages: [], window: { headBeforeSequence: null, pageCount: 1, nextBeforeSequence: null, pinned: false },
    newerAvailable: false, draft: "", draftSaved: true, journalReady: true, roleMismatch: false, delivery: "idle",
    pendingSend: null, pendingReport: null, reportFeedback: "idle", blockFeedback: "idle", failedSendBody: null, unknownSendBody: null,
    authorityPaused: false, loading: false, busy: false, error: null, ready: true, retired: false,
  };
  const conversation = { subscribe: () => () => {}, getSnapshot: () => snapshot } as unknown as ConversationController;
  const api = { consent: async () => ({ ...target, accountId: id(3), participant: "coach", grantId: id(4), consentGeneration: "2", consentActive: false,
    disclosure: { policyVersion: "reviewed-v1", policyHash: "a".repeat(64), text: "Separate disclosure", disclosureWitness: "b".repeat(64) } }),
    list: async () => ({ ...target, proposals: [], editorScope: null, nextCursor: null }), setConsent: vi.fn(async () => ({ action: "consent_accept", outcome: "accepted" })) };
  const capture = vi.spyOn(transport, "captureBrowserProposalsApi").mockResolvedValue(api as never);
  root = (await import("react-dom/client")).createRoot(document.getElementById("root")!);
  const proposals = createElement(CoachProposals, { accountId: id(3), attemptId: id(1), runtime, conversation });
  await act(async () => root.render(inWorkspace ? createElement(ConversationView, { controller: conversation, planUpdates: proposals }) : proposals));
  const button = () => Array.from(document.querySelectorAll("button")).find(b => b.textContent === "Allow plan proposals")!;
  return { runtime, snapshot, api, capture, button };
}
describe("actual proposal mount scope fences", () => {
  it("recovers the exact uncertain request after visiting Messages and Safety on a narrow workspace", async () => {
    const f = await mountParticipant(true);
    const click = async (label: string) => {
      const button = [...document.querySelectorAll("button")].find(b => b.textContent === label && !b.closest("[hidden]"));
      expect(button).toBeDefined(); await act(async () => button!.click());
    };
    try {
      await click("Plan updates");
      f.api.setConsent.mockRejectedValueOnce(new TypeError("response lost"));
      await click("Allow plan proposals");
      expect(document.body.textContent).toContain("unconfirmed");
      await click("Messages"); await click("Safety"); await click("Plan updates");
      await click("Check previous request");
      expect(f.api.setConsent).toHaveBeenCalledTimes(2);
      expect(f.api.setConsent.mock.calls[1]).toEqual(f.api.setConsent.mock.calls[0]);
    } finally { await act(async () => f.runtime.dispose()); }
  });
  it("keeps mutation feedback when the actual automatic focus refresh runs", async () => {
    const f = await mountParticipant();
    try {
      await act(async () => f.button().click());
      expect(document.body.textContent).toContain("Proposal consent saved.");
      await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
      expect(document.body.textContent).toContain("Proposal consent saved.");
    } finally { await act(async () => f.runtime.dispose()); }
  });
  it("denies a rendered consent handler immediately when C1 authority changes before React rerenders", async () => {
    const f = await mountParticipant(); expect(f.button()).toBeDefined();
    f.snapshot.availability!.controlRevision = "2";
    await act(async () => f.button().click()); expect(f.api.setConsent).not.toHaveBeenCalled(); await act(async () => f.runtime.dispose());
  });
  it("retires in layout cleanup so a late capture after unmount cannot submit consent", async () => {
    const f = await mountParticipant(); let finish!: (value: unknown) => void;
    f.capture.mockImplementationOnce(() => new Promise(resolve => { finish = resolve as (value: unknown) => void; }));
    await act(async () => f.button().click()); await act(async () => root.render(null));
    await act(async () => finish(f.api)); expect(f.api.setConsent).not.toHaveBeenCalled(); await act(async () => f.runtime.dispose());
  });
});
