import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoachClientsView } from "@/components/coaching/conversation/CoachClients";
import { createCoachClientsController } from "./clients";
import type { ConversationApi } from "./generated/conversationApi";
import type { ConversationRosterItem } from "./generated/conversationBackendTypes";
import { ConversationActivityCancelledError } from "./generated/conversationErrors";
const accountId = "00000000-0000-4000-8000-000000000001";
const policy = { accountId, policyVersion: "v1", contentHash: "a".repeat(64), body: "Service terms" };
function rosterItem(available: boolean): ConversationRosterItem {
  const enrollmentAttemptId = "00000000-0000-4000-8000-000000000002", conversationId = "00000000-0000-4000-8000-000000000020";
  return { enrollmentAttemptId, conversationId, unreadCount: "3", availability: {
    accountId, enrollmentAttemptId, conversationId, viewerRole: "coach", controlRevision: available ? "4" : "5", reason: available ? "active" : "coach_unavailable",
    capabilities: { canReadHistory: true, canSend: available, canRequestKamy: false, canCreateProposal: false, canApplyProposal: false },
  } };
}
function fixture() {
  let valid = true; let boundary = () => {};
  const actor = { accountId, revision: 1, assertCurrent() { if (!valid) throw Error("account changed"); } };
  const api: Pick<ConversationApi, "roster" | "servicePolicy" | "acceptPolicy" | "setService"> = { roster: async () => ({ accountId, items: [], nextAfterId: null }), servicePolicy: async () => policy,
    acceptPolicy: async () => ({ ...policy, acceptedAt: "2026-10-31T00:00:00Z" }),
    setService: async (available: boolean) => ({ accountId, available, revision: "1" }) };
  let capture = async () => api;
  const controller = createCoachClientsController({ actor, api: () => capture(), subscribeBoundary: listener => { boundary = listener; return () => {}; } });
  return { api, controller, captureWith(value: () => Promise<typeof api>) { capture = value; }, retire() { valid = false; boundary(); } };
}
describe("real coach clients", () => {
  it("keeps genuine empty results empty and service acceptance separate from commands", async () => {
    const f = fixture(); await f.controller.initialize();
    expect(f.controller.getSnapshot()).toMatchObject({ items: [], error: null, policy, serviceFeedback: null, accepted: false });
    await f.controller.acceptPolicy(); expect(f.controller.getSnapshot()).toMatchObject({ accepted: true, serviceFeedback: null });
    await f.controller.setService(false); expect(f.controller.getSnapshot().serviceFeedback).toBe("Availability paused.");
    f.controller.dispose();
  });
  it("hides a late roster response after an account boundary", async () => {
    const f = fixture(); let finish!: (value: Awaited<ReturnType<typeof f.api.roster>>) => void;
    f.api.roster = () => new Promise(resolve => { finish = resolve; });
    const loading = f.controller.initialize(); await Promise.resolve(); await Promise.resolve(); f.retire();
    finish({ accountId, items: [], nextAfterId: null }); await loading;
    expect(f.controller.getSnapshot()).toMatchObject({ retired: true, items: [], policy: null });
  });
  it("shows a real error without substituting sample clients", async () => {
    const f = fixture(); f.api.roster = async () => { throw Error("network"); };
    await f.controller.initialize(); expect(f.controller.getSnapshot().items).toEqual([]);
    expect(f.controller.getSnapshot().error).toBeTruthy(); f.controller.dispose();
  });
  it("filters buyer rows from a dual-role coach roster while retaining coach rows and the server cursor", async () => {
    const f = fixture(); const nextAfterId = "00000000-0000-4000-8000-000000000020";
    f.api.roster = async () => ({ accountId, nextAfterId, items: [{ enrollmentAttemptId: "00000000-0000-4000-8000-000000000002", conversationId: "00000000-0000-4000-8000-000000000003", unreadCount: "3", availability: {
      accountId, enrollmentAttemptId: "00000000-0000-4000-8000-000000000002", conversationId: "00000000-0000-4000-8000-000000000003", viewerRole: "buyer", controlRevision: "4", reason: "active",
      capabilities: { canReadHistory: true, canSend: true, canRequestKamy: false, canCreateProposal: false, canApplyProposal: false },
    } }, rosterItem(true)] });
    await f.controller.initialize(); expect(f.controller.getSnapshot()).toMatchObject({ items: [rosterItem(true)], nextAfterId, error: null }); f.controller.dispose();
  });
  it("retains the same row objects during a current-page poll and clears them on cursor navigation", async () => {
    const f = fixture(); f.api.roster = async () => ({ accountId, items: [rosterItem(true)], nextAfterId: null }); await f.controller.page();
    const rows = f.controller.getSnapshot().items;
    let finish!: (value: Awaited<ReturnType<typeof f.api.roster>>) => void;
    f.api.roster = () => new Promise(resolve => { finish = resolve; });
    const poll = f.controller.initialize(); await Promise.resolve(); await Promise.resolve();
    expect(f.controller.getSnapshot().items).toBe(rows);
    finish({ accountId, items: [rosterItem(false)], nextAfterId: null }); await poll;
    const navigation = f.controller.page("00000000-0000-4000-8000-000000000010"); await Promise.resolve(); await Promise.resolve();
    expect(f.controller.getSnapshot().items).toEqual([]);
    finish({ accountId, items: [], nextAfterId: null }); await navigation; f.controller.dispose();
  });
  it("hides unverified roster data, denies commands and recovers without a permanent account retirement", async () => {
    const f = fixture(); f.api.roster = async () => ({ accountId, items: [rosterItem(true)], nextAfterId: null }); await f.controller.initialize();
    let serviceCalls = 0; f.api.setService = async available => { serviceCalls++; return { accountId, available, revision: "4" }; };
    f.controller.setAuthorityPaused(true); await f.controller.setService(false);
    expect(f.controller.getSnapshot()).toMatchObject({ authorityPaused: true, retired: false, items: [], policy: null }); expect(serviceCalls).toBe(0);
    f.controller.setAuthorityPaused(false); await f.controller.initialize(); expect(f.controller.getSnapshot()).toMatchObject({ authorityPaused: false, retired: false, items: [rosterItem(true)], policy }); f.controller.dispose();
  });
  it("shows neutral initial verification and keeps loading announcements and paging stable during a current-page poll", async () => {
    const f = fixture(); const html = () => renderToStaticMarkup(createElement(CoachClientsView, { controller: f.controller }));
    expect(html()).toContain("Checking your account…"); expect(html()).not.toContain("could not be verified");
    f.api.roster = async () => ({ accountId, items: [rosterItem(true)], nextAfterId: "00000000-0000-4000-8000-000000000020" }); await f.controller.initialize();
    let finish!: (value: Awaited<ReturnType<typeof f.api.roster>>) => void;
    f.api.roster = () => new Promise(resolve => { finish = resolve; }); const polling = f.controller.initialize(); await Promise.resolve(); await Promise.resolve();
    const markup = html(); expect(markup).toContain("Conversation</strong>"); expect(markup).not.toContain("Loading conversations…"); expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Next conversations/);
    finish({ accountId, items: [rosterItem(true)], nextAfterId: null }); await polling; f.controller.dispose();
  });
  it("keeps rows and policy acceptance when a service acknowledgement arrives during inactivity", async () => {
    const f = fixture(); f.api.roster = async () => ({ accountId, items: [rosterItem(true)], nextAfterId: null }); await f.controller.initialize(); await f.controller.acceptPolicy();
    let acknowledge!: (value: Awaited<ReturnType<typeof f.api.setService>>) => void;
    f.api.setService = () => new Promise(resolve => { acknowledge = resolve; }); const command = f.controller.setService(false); await Promise.resolve(); await Promise.resolve();
    f.controller.setActive(false); acknowledge({ accountId, available: false, revision: "5" }); await command;
    expect(f.controller.getSnapshot()).toMatchObject({ authorityPaused: false, items: [rosterItem(true)], accepted: true, serviceFeedback: "Availability paused." }); f.controller.dispose();
  });
  it("restores the exact cached page and cursor on typed pre-capture cancellation without treating lookalike errors as cancellation", async () => {
    const f = fixture(), after = "00000000-0000-4000-8000-000000000010", next = "00000000-0000-4000-8000-000000000020";
    const cursors: (string | null)[] = [];
    f.api.roster = async cursor => { cursors.push(cursor ?? null); return { accountId, items: [rosterItem(true)], nextAfterId: next }; };
    await f.controller.page(after); const cached = f.controller.getSnapshot();
    f.captureWith(async () => { throw new ConversationActivityCancelledError(); }); await f.controller.page(next);
    expect(f.controller.getSnapshot()).toMatchObject({ items: cached.items, nextAfterId: next, ready: true, error: null, loading: false });
    f.captureWith(async () => f.api); await f.controller.initialize();
    expect(cursors).toEqual([after, after]);
    f.captureWith(async () => { throw { name: "ConversationActivityCancelledError", message: "Conversation operation was cancelled before capture." }; }); await f.controller.page(after);
    expect(f.controller.getSnapshot().items).toEqual([]); expect(f.controller.getSnapshot().error).toBeTruthy(); f.controller.dispose();
  });
  it.each([
    { policyVersion: "v2", contentHash: policy.contentHash },
    { policyVersion: policy.policyVersion, contentHash: "b".repeat(64) },
  ])("does not label a replacement policy accepted after an older acknowledgement: %j", async replacement => {
    const f = fixture(); await f.controller.initialize();
    let acknowledge!: (value: Awaited<ReturnType<typeof f.api.acceptPolicy>>) => void;
    let dispatch!: () => void;
    const dispatched = new Promise<void>(resolve => { dispatch = resolve; });
    f.api.acceptPolicy = () => { dispatch(); return new Promise(resolve => { acknowledge = resolve; }); };
    const accepting = f.controller.acceptPolicy(); await dispatched;
    const nextPolicy = { ...policy, ...replacement, body: "Replacement service terms" };
    f.api.servicePolicy = async () => nextPolicy; await f.controller.initialize();
    expect(f.controller.getSnapshot()).toMatchObject({ policy: nextPolicy, accepted: false });
    acknowledge({ accountId, policyVersion: policy.policyVersion, contentHash: policy.contentHash, acceptedAt: "2026-10-31T00:00:00Z" });
    await accepting;
    expect(f.controller.getSnapshot()).toMatchObject({ policy: nextPolicy, accepted: false });
    f.controller.dispose();
  });
  it("immediately replaces current-page availability after a successful service command", async () => {
    const f = fixture(); const cursor = "00000000-0000-4000-8000-000000000010";
    let available = true; const cursors: (string | null)[] = [];
    f.api.roster = async afterId => { cursors.push(afterId ?? null); return { accountId, items: [rosterItem(available)], nextAfterId: null }; };
    f.api.setService = async desired => { available = desired; return { accountId, available: desired, revision: "5" }; };
    await f.controller.page(cursor); expect(f.controller.getSnapshot().items[0]?.availability.reason).toBe("active");
    await f.controller.setService(false);
    expect(f.controller.getSnapshot().items[0]?.availability).toMatchObject({ reason: "coach_unavailable", capabilities: { canSend: false } });
    expect(cursors).toEqual([cursor, cursor]); expect(f.controller.getSnapshot().serviceFeedback).toBe("Availability paused.");
    f.controller.dispose();
  });
  it("hides stale roster rows when the post-service refresh fails while preserving the confirmed command", async () => {
    const f = fixture(); f.api.roster = async () => ({ accountId, items: [rosterItem(true)], nextAfterId: null });
    await f.controller.page(); f.api.roster = async () => { throw Error("refresh failed"); };
    await f.controller.setService(false);
    expect(f.controller.getSnapshot()).toMatchObject({ items: [], serviceFeedback: "Availability paused.", loading: false, busy: false });
    expect(f.controller.getSnapshot().error).toBeTruthy(); f.controller.dispose();
  });
  it("never publishes the post-service refresh after the account boundary retires it", async () => {
    const f = fixture(); f.api.roster = async () => ({ accountId, items: [rosterItem(true)], nextAfterId: null }); await f.controller.page();
    let finish!: (value: Awaited<ReturnType<typeof f.api.roster>>) => void; let dispatched!: () => void;
    const refreshing = new Promise<void>(resolve => { dispatched = resolve; });
    f.api.roster = () => { dispatched(); return new Promise(resolve => { finish = resolve; }); };
    const command = f.controller.setService(false); await refreshing; f.retire();
    finish({ accountId, items: [rosterItem(false)], nextAfterId: null }); await command;
    expect(f.controller.getSnapshot()).toMatchObject({ retired: true, items: [], policy: null, serviceFeedback: null });
    f.controller.dispose();
  });
});
