import { describe, expect, it, vi } from "vitest";
import { captureBrowserConversationApi, createBrowserConversationRuntime, type BrowserAuth } from "./runtime";
import { createConversationLifecycle } from "./lifecycle";
import { createConversationController } from "./generated/conversationController";
import { createConversationJournalManager } from "./generated/conversationJournalCore";
import type { ConversationApi } from "./generated/conversationApi";
import { createCoachClientsController } from "./clients";

function authFixture(initialId = "A") {
  let id: string | null = initialId; let token = "first";
  let callback: Parameters<BrowserAuth["onAuthStateChange"]>[0] = () => {};
  const auth: BrowserAuth = {
    getSession: async () => ({ data: { session: id ? { user: { id }, access_token: token } : null } }),
    getUser: async () => ({ data: { user: id ? { id } : null } }),
    onAuthStateChange: listener => { callback = listener; return { data: { subscription: { unsubscribe() {} } } }; },
  };
  return { auth, change(next: string | null, event = "SIGNED_IN") { id = next; callback(event, id ? { user: { id }, access_token: token } : null); },
    silently(next: string | null) { id = next; },
    refresh() { token = "second"; callback("TOKEN_REFRESHED", { user: { id: id! }, access_token: token }); } };
}

describe("captured browser account runtime", () => {
  it("rejects a browser identity different from verified SSR identity", async () => {
    const f = authFixture(); f.change("B");
    const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true });
    await expect(r.verify()).rejects.toThrow(); expect(() => r.actor.assertCurrent()).toThrow(); r.dispose();
  });
  it("A to B to A retires the old generation synchronously", async () => {
    const f = authFixture(); const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true });
    await r.verify(); const listener = vi.fn(); r.subscribeBoundary(listener);
    f.change("B"); f.change("A");
    expect(listener).toHaveBeenCalledTimes(1); expect(() => r.actor.assertCurrent()).toThrow(); r.dispose();
  });
  it("same-user token refresh stays usable and getUser never runs in auth callback", async () => {
    const f = authFixture(); const user = vi.spyOn(f.auth, "getUser");
    const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true, url: "https://example.test", anonKey: "anon" });
    await r.verify(); f.refresh(); expect(user).toHaveBeenCalledTimes(1);
    expect((await r.capture()).token).toBe("second"); r.dispose();
  });
  it("fences a deferred getUser across A to B to A", async () => {
    const f = authFixture(); let finish!: (value: Awaited<ReturnType<BrowserAuth["getUser"]>>) => void;
    f.auth.getUser = () => new Promise(resolve => { finish = resolve; });
    const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true });
    const work = r.verify(); await Promise.resolve(); f.change("B"); f.change("A");
    finish({ data: { user: { id: "A" } } }); await expect(work).rejects.toThrow(); r.dispose();
  });
  it("the shipping-disabled runtime cannot capture a C1 request", async () => {
    const f = authFixture(); const r = createBrowserConversationRuntime("A", { auth: f.auth });
    await expect(r.capture()).rejects.toThrow("unavailable"); r.dispose();
  });
  it("checks the current session again for focus/visibility and every explicit operation", async () => {
    const f = authFixture(); const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true, url: "https://example.test", anonKey: "anon" });
    await r.verify(); await r.capture(); f.silently("B");
    await expect(r.verify()).rejects.toThrow(); expect(() => r.actor.assertCurrent()).toThrow(); r.dispose();
  });
  it("pauses a hung auth check without permanently retiring the account", async () => {
    vi.useFakeTimers(); const f = authFixture(); f.auth.getSession = () => new Promise(() => {});
    const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true });
    let outcome = "pending"; void r.verify().then(() => { outcome = "success"; }, () => { outcome = "failed"; });
    await vi.advanceTimersByTimeAsync(15_000); expect(outcome).toBe("failed");
    expect(() => r.actor.assertCurrent()).not.toThrow(); r.dispose(); vi.useRealTimers();
  });
  it("hides unverifiable authority, denies dispatch and recovers only after explicit verification", async () => {
    const f = authFixture(); const fetcher = vi.fn<typeof fetch>(async () => new Response("{}"));
    const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true, url: "https://example.test", anonKey: "anon", fetch: fetcher });
    const verified: boolean[] = []; r.subscribeVerification(value => verified.push(value)); await r.verify(); const captured = await r.capture();
    const getUser = f.auth.getUser; f.auth.getUser = async () => { throw Error("temporary outage"); };
    await expect(r.verify()).rejects.toThrow(); expect(() => r.actor.assertCurrent()).not.toThrow();
    await expect(captured.request("get_coaching_conversation_service_policy", {})).rejects.toThrow();
    await expect(r.capture()).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled(); expect(verified.at(-1)).toBe(false);
    f.auth.getUser = getUser; await r.verify(); await (await r.capture()).request("get_coaching_conversation_service_policy", {});
    expect(fetcher).toHaveBeenCalledTimes(1); expect(verified.at(-1)).toBe(true); r.dispose();
  });
  it("cannot revive authority when a deferred verification completes after going inactive", async () => {
    const f = authFixture(); const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true });
    let finish!: (value: Awaited<ReturnType<BrowserAuth["getUser"]>>) => void;
    f.auth.getUser = () => new Promise(resolve => { finish = resolve; }); const checking = r.verify(); await Promise.resolve();
    r.setActive(false); finish({ data: { user: { id: "A" } } }); await expect(checking).rejects.toThrow();
    expect(() => r.actor.assertCurrent()).not.toThrow(); await expect(r.capture()).rejects.toThrow(); r.dispose();
  });
  it("does not present initial verification or ordinary blur as a failed sign-in", async () => {
    const f = authFixture(), runtime = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true });
    const results: boolean[] = []; runtime.subscribeVerification(value => results.push(value));
    expect(results).toEqual([]); await runtime.verify(); runtime.setActive(false);
    expect(results).toEqual([true]); expect(() => runtime.actor.assertCurrent()).not.toThrow(); runtime.dispose();
  });
  it("immediately retires a controller that subscribes after an initial signed-out event", () => {
    const f = authFixture(); const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true }); f.change(null, "SIGNED_OUT");
    const hidden = vi.fn(); r.subscribeBoundary(hidden); expect(hidden).toHaveBeenCalledTimes(1); r.dispose();
  });
  it("pins the captured bearer through an operation while a same-user refresh occurs", async () => {
    const f = authFixture(); const fetcher = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    const r = createBrowserConversationRuntime("A", { auth: f.auth, enabled: true, url: "https://example.test", anonKey: "anon", fetch: fetcher });
    const captured = await r.capture(); f.refresh();
    await captured.request("get_coaching_conversation_service_policy", {});
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", headers: { apikey: "anon", Authorization: "Bearer first" } });
    expect((await r.capture()).token).toBe("second"); r.dispose();
  });
  it("preserves unsaved draft and exact unresolved delivery through Auth outage and in-place Retry", async () => {
    const accountId = "00000000-0000-4000-8000-000000000001", enrollmentAttemptId = "00000000-0000-4000-8000-000000000002", conversationId = "00000000-0000-4000-8000-000000000003";
    const f = authFixture(accountId), runtime = createBrowserConversationRuntime(accountId, { auth: f.auth, enabled: true, url: "https://example.test", anonKey: "anon" });
    const data = new Map<string, string>();
    const manager = createConversationJournalManager({ storage: { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); }, getAllKeys: async () => [...data.keys()] }, restoreFence: async () => {}, runWrite: async (_owner, write) => write() });
    const journal = manager.bind(runtime.actor), target = { enrollmentAttemptId, conversationId };
    const input = { enrollmentAttemptId, requestId: "00000000-0000-4000-8000-000000000004", expectedControlRevision: "1", body: "original uncertain message" };
    await journal.prepareSend(target, input);
    const unused = async () => { throw Error("Unexpected network mutation"); };
    const send = vi.fn(unused);
    const api: ConversationApi = { availability: async () => ({ accountId, ...target, viewerRole: "coach", controlRevision: "1", reason: "active", capabilities: { canReadHistory: true, canSend: true, canRequestKamy: false, canCreateProposal: false, canApplyProposal: false } }),
      policy: async () => ({ accountId, enrollmentAttemptId, policyVersion: "v1", contentHash: "a".repeat(64), body: "Terms", coachName: "Coach" }),
      history: async () => ({ accountId, ...target, messages: [{ id: "00000000-0000-4000-8000-000000000005", kind: "text", author: "buyer", body: "Private history", sequence: "1", createdAt: "2026-10-31T00:00:00Z" }], nextBeforeSequence: null }),
      context: async () => ({ accountId, ...target, controlRevision: "1", context: { planTitle: "Private context", buyerName: "Client", coachName: "Coach", days: [], nextAfterScheduleId: null } }),
      servicePolicy: unused, acceptPolicy: unused, open: unused, consent: unused, suspend: unused, setService: unused, send, markRead: unused, roster: unused, report: unused, block: unused };
    const controller = createConversationController({ actor: runtime.actor, attemptId: enrollmentAttemptId, api: async () => { await runtime.capture(); return api; }, journal, newRequestId: () => "00000000-0000-4000-8000-000000000006", subscribeBoundary: runtime.subscribeBoundary, expectedViewerRole: "coach" });
    const stop = runtime.subscribeVerification(verified => controller.setAuthorityPaused(!verified));
    await runtime.verify(); await controller.initialize(); await controller.setDraft("x".repeat(16001));
    const getUser = f.auth.getUser; f.auth.getUser = async () => { throw Error("temporary outage"); }; await expect(runtime.verify()).rejects.toThrow();
    expect(controller.getSnapshot()).toMatchObject({ authorityPaused: true, retired: false, messages: [], context: null, draft: "x".repeat(16001), draftSaved: false, pendingSend: { conversationId, input }, delivery: "checking" });
    await controller.sendDraft(); expect(send).not.toHaveBeenCalled();
    f.auth.getUser = getUser; await runtime.verify(); await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ authorityPaused: false, draft: "x".repeat(16001), draftSaved: false, pendingSend: { conversationId, input } });
    expect(controller.getSnapshot().messages[0]?.kind).toBe("text"); expect(send).not.toHaveBeenCalled();
    expect(() => f.change(null, "SIGNED_OUT")).not.toThrow(); expect(controller.getSnapshot().retired).toBe(true);
    stop(); controller.dispose(); runtime.dispose();
  });
});

function liveHarness() {
  const accountId = "00000000-0000-4000-8000-000000000001", enrollmentAttemptId = "00000000-0000-4000-8000-000000000002", conversationId = "00000000-0000-4000-8000-000000000003";
  const target = { accountId, enrollmentAttemptId, conversationId }, auth = authFixture(accountId);
  const requests: string[] = [], handlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  const fetcher: typeof fetch = async (url, options) => {
    const name = String(url).split("/").at(-1)!; requests.push(name); const args = JSON.parse(String(options?.body)); let wire: unknown;
    if (handlers.has(name)) wire = await handlers.get(name)!(args);
    else if (name === "get_coaching_conversation") wire = { ...target, viewerRole: "coach", controlRevision: "1", reason: "active", capabilities: { canReadHistory: true, canSend: true, canRequestKamy: false, canCreateProposal: false, canApplyProposal: false } };
    else if (name === "get_coaching_conversation_policy") wire = { accountId, enrollmentAttemptId, policyVersion: "v1", contentHash: "a".repeat(64), body: "Terms", coachName: "Coach" };
    else if (name === "list_coaching_conversation_messages") wire = { ...target, messages: [{ id: "00000000-0000-4000-8000-000000000004", kind: "text", author: "buyer", body: "Cached private history", sequence: "1", createdAt: "2026-10-31T00:00:00Z" }], nextBeforeSequence: null };
    else if (name === "get_coaching_conversation_context") wire = { ...target, controlRevision: "1", context: { planTitle: "Cached private context", buyerName: "Client", coachName: "Coach", days: [], nextAfterScheduleId: null } };
    else if (name === "get_coaching_conversation_service_policy") wire = { accountId, policyVersion: "v1", contentHash: "a".repeat(64), body: "Service terms" };
    else if (name === "accept_coaching_conversation_policy") wire = { accountId, policyVersion: "v1", contentHash: "a".repeat(64), acceptedAt: "2026-10-31T00:00:00Z" };
    else if (name === "list_coaching_conversations") wire = { accountId, items: [{ enrollmentAttemptId, conversationId, unreadCount: "1", availability: { ...target, viewerRole: "coach", controlRevision: "1", reason: "active", capabilities: { canReadHistory: true, canSend: true, canRequestKamy: false, canCreateProposal: false, canApplyProposal: false } } }], nextAfterId: null };
    else throw Error(`Unexpected RPC ${name}`);
    return wire instanceof Response ? wire : new Response(JSON.stringify(wire), { status: 200 });
  };
  const runtime = createBrowserConversationRuntime(accountId, { auth: auth.auth, enabled: true, url: "https://example.test", anonKey: "anon", fetch: fetcher });
  const data = new Map<string, string>(), manager = createConversationJournalManager({ storage: { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); }, getAllKeys: async () => [...data.keys()] }, restoreFence: async () => {}, runWrite: async (_owner, write) => write() });
  const journal = manager.bind(runtime.actor), controller = createConversationController({ actor: runtime.actor, attemptId: enrollmentAttemptId, api: () => captureBrowserConversationApi(runtime), journal, newRequestId: () => "00000000-0000-4000-8000-000000000005", subscribeBoundary: runtime.subscribeBoundary, expectedViewerRole: "coach" });
  const unsubscribe = runtime.subscribeVerification(verified => controller.setAuthorityPaused(!verified));
  const lifecycle = createConversationLifecycle({ verify: runtime.verify, setAvailable: runtime.setActive, setActive: controller.setActive, refresh: () => controller.initialize(), schedule: () => () => {} });
  return { auth, runtime, controller, journal, lifecycle, handlers, requests, target,
    dispose() { unsubscribe(); lifecycle.dispose(); controller.dispose(); runtime.dispose(); } };
}
const foreground = { focused: true, visible: true, online: true };
describe("actual runtime/lifecycle/controller integration", () => {
  it("keeps cached private state and admits a matching in-flight Send acknowledgement through blur, then hides on a real verification failure", async () => {
    const h = liveHarness(); await h.lifecycle.update(foreground); await h.controller.initialize(); await h.controller.setDraft("Committed while blurred");
    let finish!: (value: unknown) => void, started!: () => void; const sending = new Promise<void>(resolve => { started = resolve; }); let input: Record<string, unknown> = {};
    h.handlers.set("send_coaching_conversation_message", args => { input = args.p_input as Record<string, unknown>; started(); return new Promise(resolve => { finish = resolve; }); });
    const operation = h.controller.sendDraft(); await sending; const before = h.controller.getSnapshot().messages;
    await h.lifecycle.update({ ...foreground, focused: false });
    expect(h.controller.getSnapshot()).toMatchObject({ authorityPaused: false, messages: before }); await expect(h.runtime.capture()).rejects.toThrow();
    finish({ ...h.target, requestId: input.requestId, messageId: "00000000-0000-4000-8000-000000000006", sequence: "2", createdAt: "2026-10-31T00:00:01Z" }); await operation;
    expect(h.controller.getSnapshot()).toMatchObject({ delivery: "sent", pendingSend: null, authorityPaused: false, messages: before });
    h.auth.auth.getUser = async () => { throw Error("actual verification outage"); }; await h.lifecycle.update(foreground);
    expect(h.controller.getSnapshot()).toMatchObject({ authorityPaused: true, messages: [], context: null }); h.dispose();
  });
  it("finishes an already captured multi-RPC refresh through blur without clearing its projection", async () => {
    const h = liveHarness(); await h.lifecycle.update(foreground); await h.controller.initialize();
    let finish!: (value: unknown) => void, started!: () => void; const fetching = new Promise<void>(resolve => { started = resolve; });
    const policy = h.controller.getSnapshot().policy!;
    h.handlers.set("get_coaching_conversation_policy", () => { started(); return new Promise(resolve => { finish = resolve; }); });
    const refresh = h.controller.refresh(); await fetching; await h.lifecycle.update({ ...foreground, focused: false }); finish(policy); await refresh;
    expect(h.controller.getSnapshot()).toMatchObject({ authorityPaused: false, ready: true }); expect(h.controller.getSnapshot().messages).toHaveLength(1); expect(h.controller.getSnapshot().context?.context?.planTitle).toBe("Cached private context"); h.dispose();
  });
  it("does not overwrite a saved draft during delayed or failed first verification and restores it only after success", async () => {
    const h = liveHarness(); await h.journal.saveDraft(h.target.enrollmentAttemptId, "Saved before reload");
    let reject!: (reason: unknown) => void; h.auth.auth.getUser = () => new Promise((_resolve, fail) => { reject = fail; });
    const initial = h.lifecycle.update(foreground); await Promise.resolve(); await Promise.resolve();
    await h.controller.setDraft("Typed too early"); expect((await h.journal.read(h.target.enrollmentAttemptId)).draft).toBe("Saved before reload");
    reject(Error("first verification failed")); await initial; await h.controller.setDraft("Still too early");
    expect((await h.journal.read(h.target.enrollmentAttemptId)).draft).toBe("Saved before reload");
    h.auth.auth.getUser = async () => ({ data: { user: { id: h.target.accountId } } }); await h.lifecycle.update(foreground); await h.controller.initialize();
    expect(h.controller.getSnapshot()).toMatchObject({ draft: "Saved before reload", journalReady: true }); h.dispose();
  });
  it.each([false, true])("preserves cached conversation when blur cancels a poll's deferred pre-capture Auth check (auth rejects=%s)", async rejects => {
    const h = liveHarness(); await h.lifecycle.update(foreground); const cached = h.controller.getSnapshot(); const requests = h.requests.length;
    let finish!: (value: Awaited<ReturnType<BrowserAuth["getUser"]>>) => void, fail!: (reason: unknown) => void, started!: () => void;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    h.auth.auth.getUser = () => { started(); return new Promise((resolve, reject) => { finish = resolve; fail = reject; }); };
    const poll = h.controller.refresh(); await waiting; await h.lifecycle.update({ ...foreground, focused: false });
    if (rejects) fail(Error("cancelled inactive Auth fetch")); else finish({ data: { user: { id: h.target.accountId } } });
    await poll;
    expect(h.controller.getSnapshot()).toMatchObject({ authorityPaused: false, retired: false, ready: true, messages: cached.messages, context: cached.context, policy: cached.policy });
    expect(h.requests).toHaveLength(requests); h.dispose();
  });
  it("preserves Clients rows, policy and acceptance on a pre-capture activity cancellation but hides them after a real active Auth failure", async () => {
    const h = liveHarness();
    const clients = createCoachClientsController({ actor: h.runtime.actor, api: () => captureBrowserConversationApi(h.runtime), subscribeBoundary: h.runtime.subscribeBoundary });
    const stop = h.runtime.subscribeVerification(verified => clients.setAuthorityPaused(!verified));
    const life = createConversationLifecycle({ verify: h.runtime.verify, setAvailable: h.runtime.setActive, setActive: clients.setActive, refresh: () => clients.initialize(), schedule: () => () => {} });
    await life.update(foreground); await clients.acceptPolicy(); const cached = clients.getSnapshot(); expect(cached.accepted).toBe(true);
    let finish!: (value: Awaited<ReturnType<BrowserAuth["getUser"]>>) => void, started!: () => void; const waiting = new Promise<void>(resolve => { started = resolve; });
    h.auth.auth.getUser = () => { started(); return new Promise(resolve => { finish = resolve; }); };
    const poll = clients.initialize(); await waiting; await life.update({ ...foreground, focused: false }); finish({ data: { user: { id: h.target.accountId } } }); await poll;
    expect(clients.getSnapshot()).toMatchObject({ authorityPaused: false, retired: false, items: cached.items, policy: cached.policy, accepted: true });
    h.auth.auth.getUser = async () => { throw Error("real active verification failure"); }; await life.update(foreground);
    expect(clients.getSnapshot()).toMatchObject({ authorityPaused: true, retired: false, items: [], policy: null, accepted: false });
    stop(); life.dispose(); clients.dispose(); h.dispose();
  });
  it("retires on a positively mismatched account even when its Auth result arrives after blur", async () => {
    const h = liveHarness(); await h.lifecycle.update(foreground);
    let finish!: (value: Awaited<ReturnType<BrowserAuth["getUser"]>>) => void, started!: () => void; const waiting = new Promise<void>(resolve => { started = resolve; });
    h.auth.auth.getUser = () => { started(); return new Promise(resolve => { finish = resolve; }); };
    const poll = h.controller.refresh(); await waiting; await h.lifecycle.update({ ...foreground, focused: false });
    finish({ data: { user: { id: "00000000-0000-4000-8000-000000000099" } } }); await poll;
    expect(h.controller.getSnapshot()).toMatchObject({ retired: true, messages: [], context: null }); expect(() => h.runtime.actor.assertCurrent()).toThrow(); h.dispose();
  });
  it("does not preserve private projection for a real RPC denial with activity-cancellation lookalike text", async () => {
    const h = liveHarness(); await h.lifecycle.update(foreground);
    h.handlers.set("get_coaching_conversation", async () => new Response(JSON.stringify({ code: "PT403", name: "ConversationActivityCancelledError", message: "Conversation operation was cancelled before capture." }), { status: 403 }));
    await h.controller.refresh(); expect(h.controller.getSnapshot()).toMatchObject({ authorityPaused: false, retired: false, ready: false, messages: [], context: null }); h.dispose();
  });
});
