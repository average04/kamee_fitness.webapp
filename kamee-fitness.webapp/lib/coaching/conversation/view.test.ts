import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationView } from "@/components/coaching/conversation/ConversationView";
import type { ConversationController, ConversationSnapshot } from "./generated/conversationController";
const accountId = "00000000-0000-4000-8000-000000000001", attempt = "00000000-0000-4000-8000-000000000002", conversationId = "00000000-0000-4000-8000-000000000003";
function fixture() {
  const state: ConversationSnapshot = {
    availability: { accountId, enrollmentAttemptId: attempt, conversationId, controlRevision: "4", viewerRole: "coach", reason: "completed",
      capabilities: { canReadHistory: true, canSend: false, canRequestKamy: false, canCreateProposal: false, canApplyProposal: false } },
    policy: null, context: null, messages: [
      { id: "00000000-0000-4000-8000-000000000004", sequence: "1", createdAt: "2026-10-31T00:00:00Z", kind: "text", author: "buyer", body: "  literal <script>\nsecond line  " },
      { id: "00000000-0000-4000-8000-000000000005", sequence: "2", createdAt: "2026-10-31T00:00:01Z", kind: "removed" },
    ], window: { headBeforeSequence: null, pageCount: 1, nextBeforeSequence: null, pinned: false }, newerAvailable: false,
    draft: "editable draft", draftSaved: true, delivery: "checking", pendingSend: { conversationId, input: { enrollmentAttemptId: attempt, requestId: "00000000-0000-4000-8000-000000000006", expectedControlRevision: "3", body: "exact original" } },
    pendingReport: null, reportFeedback: "idle", blockFeedback: "idle", failedSendBody: "copyable failed text", unknownSendBody: null, authorityPaused: false, journalReady: true, roleMismatch: false, loading: false, busy: false, error: null, ready: true, retired: false,
  };
  const noop = async () => {};
  const controller: ConversationController = { getSnapshot: () => state, subscribe: () => () => {}, setActive() {}, setAuthorityPaused() {}, initialize: noop, refresh: noop, pinHistory() {}, loadOlder: noop,
    returnToLatest: noop, setDraft: noop, sendDraft: noop, retryDelivery: noop, stopCheckingDelivery: noop, dismissFailedSend: noop, dismissUnknownSend: noop, open: noop, confirmConsent: noop, suspend: noop, block: noop, report: noop, retryReport: noop, markVisible: noop, dispose() {} };
  return { state, html: () => renderToStaticMarkup(createElement(ConversationView, { controller })) };
}
describe("conversation presentation markup (no DOM interaction claim)", () => {
  it("offers buyer suspension only to the buyer, never to a coach", () => {
    const f = fixture(); expect(f.html()).not.toContain("Suspend sharing");
    f.state.availability!.viewerRole = "buyer";
    expect(f.html()).toContain("Suspend sharing");
  });
  it("preserves and escapes plain text while showing readable closed history and immutable recovery separately", () => {
    const f = fixture(); const html = f.html();
    expect(html).toContain("  literal &lt;script&gt;\nsecond line  "); expect(html).not.toContain("<script>"); expect(html).toContain("Message removed");
    expect(html).toContain("exact original"); expect(html).toContain("copyable failed text"); expect(html).toContain("editable draft");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Send message/);
    expect(html).toContain("Retry delivery check"); expect(html).toContain("Block this person"); expect(html).toContain("Unblock this person");
    expect(html).toContain("across Kamee"); expect(html).toContain("removes follows in both directions");
    for (const category of ["Harassment", "Unsafe advice", "Privacy", "Other"]) expect(html).toContain(category);
  });
  it("renders no private content after synchronous retirement", () => {
    const f = fixture(); f.state.retired = true; const html = f.html();
    expect(html).toContain("account session changed"); expect(html).not.toContain("literal"); expect(html).not.toContain("exact original"); expect(html).not.toContain("editable draft");
  });
  it("disables invalid Unicode/over-limit sends and gives safe inline validation with a code-point counter", () => {
    const f = fixture(); f.state.pendingSend = null; f.state.failedSendBody = null; f.state.availability!.reason = "active"; f.state.availability!.capabilities.canSend = true;
    for (const body of ["x".repeat(2001), "\ud800", " \n "]) {
      f.state.draft = body; const html = f.html(); expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Send message/); expect(html).toContain("Use 1–2,000"); expect(html).not.toContain("ZodError");
    }
    f.state.draft = "😀".repeat(2000); const html = f.html(); expect(html).toContain("2000/2,000 characters"); expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Send message/);
  });
  it("hides unverifiable history while retaining draft and exact pending recovery with Retry", () => {
    const f = fixture(); f.state.authorityPaused = true; const html = f.html();
    expect(html).not.toContain("literal &lt;script&gt;"); expect(html).toContain("editable draft"); expect(html).toContain("exact original"); expect(html).toContain("Conversations are paused"); expect(html).toContain("Retry");
  });
  it("offers consent only in eligible states and identifies the unavailable shared features without naming the coach as their counterpart", () => {
    const f = fixture(); f.state.policy = { accountId, enrollmentAttemptId: attempt, policyVersion: "v1", contentHash: "a".repeat(64), body: "Attempt terms", coachName: "Coach Self" };
    expect(f.html()).not.toContain("Review and confirm sharing"); expect(f.html()).not.toContain("sharing with Coach Self"); expect(f.html()).toContain("Shared Kamy and plan proposals are unavailable");
    f.state.availability!.reason = "consent_required"; expect(f.html()).toContain("Review and confirm sharing");
  });
  it("keeps unknown delivery copyable with duplicate warnings and explicit dismissal", () => {
    const f = fixture(); f.state.pendingSend = null; f.state.delivery = "unknown"; f.state.unknownSendBody = "unknown original";
    const html = f.html(); expect(html).toContain("unknown original"); expect(html).toContain("may already have been delivered"); expect(html).toContain("could create a duplicate"); expect(html).toContain("Dismiss unknown-delivery copy");
  });
  it("requires keeping or dismissing an older failed copy before sending different text", () => {
    const f = fixture(); f.state.pendingSend = null; f.state.availability!.reason = "active"; f.state.availability!.capabilities.canSend = true;
    expect(f.html()).toContain("Keep or dismiss the earlier unsent copy"); expect(f.html()).toMatch(/<button[^>]*disabled=""[^>]*>Send message/);
    f.state.draft = f.state.failedSendBody!; expect(f.html()).not.toMatch(/<button[^>]*disabled=""[^>]*>Send message/);
  });
  it("keeps the composer disabled until authenticated journal recovery completes without falsely claiming recovery is loaded", () => {
    const f = fixture(); f.state.journalReady = false; f.state.ready = false; f.state.availability = null; f.state.messages = []; f.state.pendingSend = null; f.state.failedSendBody = null; f.state.draft = "";
    expect(f.html()).toContain("Checking your account…"); expect(f.html()).toMatch(/<textarea[^>]*disabled=""/); expect(f.html()).not.toContain("Your draft and delivery recovery are kept here");
    f.state.authorityPaused = true; expect(f.html()).toMatch(/<textarea[^>]*disabled=""/); expect(f.html()).toContain("Draft recovery has not loaded yet"); expect(f.html()).not.toContain("Your draft and delivery recovery are kept here");
  });
});
