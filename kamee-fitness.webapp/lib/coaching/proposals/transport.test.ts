import { describe, expect, it, vi } from "vitest";
import { createBrowserConversationRuntime } from "../conversation/runtime";
import { captureBrowserProposalsApi } from "./transport";
import { broadcastAuthBoundary } from "@/lib/auth-boundary";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const target = { enrollmentAttemptId: id(1), conversationId: id(2) };
function fixture() {
  let changed = false; let authChange: (event: string, session: { user: { id: string }; access_token: string }) => void = () => {};
  const wire = { ...target, accountId: id(3), participant: "coach", grantId: null, consentGeneration: "0", consentActive: false, disclosure: null };
  const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(wire)));
  const runtime = createBrowserConversationRuntime(id(3), { enabled: true, url: "https://example.test", anonKey: "public-key", fetch: fetcher,
    auth: { getSession: async () => ({ data: { session: { user: { id: changed ? id(4) : id(3) }, access_token: "captured-token" } } }),
      getUser: async () => ({ data: { user: { id: changed ? id(4) : id(3) } } }), onAuthStateChange: callback => { authChange = callback; return { data: { subscription: { unsubscribe() {} } } }; } } });
  return { runtime, wire, fetcher, change: () => { changed = true; authChange("SIGNED_IN", { user: { id: id(4) }, access_token: "different-token" }); }, returnToA: () => { changed = false; authChange("SIGNED_IN", { user: { id: id(3) }, access_token: "new-a-token" }); } };
}
describe("verified browser proposal transport", () => {
  it("uses the captured participant token and rejects foreign-account or malformed DTOs", async () => {
    const f = fixture(), api = await captureBrowserProposalsApi(f.runtime);
    await api.consent(target);
    expect(f.fetcher).toHaveBeenCalledWith("https://example.test/rest/v1/rpc/get_coaching_proposal_consent", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer captured-token", apikey: "public-key" }), body: JSON.stringify({ p_input: JSON.stringify(target) }) }));
    f.wire.accountId = id(4); await expect(api.consent(target)).rejects.toThrow();
    f.runtime.dispose();
  });
  it("denies buyer-only RPCs and account/activity changes before transport", async () => {
    const f = fixture(), api = await captureBrowserProposalsApi(f.runtime);
    await expect(api.accept({ ...target, requestId: id(5), proposalId: id(6), expectedProposalRevision: "0", expectedControlRevision: "1", expectedEffectiveRevision: "0", previewHash: "a".repeat(64) })).rejects.toThrow();
    expect(f.fetcher).not.toHaveBeenCalled();
    f.runtime.setActive(false); await expect(api.consent(target)).rejects.toThrow(); expect(f.fetcher).not.toHaveBeenCalled();
    f.runtime.setActive(true); f.change(); await expect(captureBrowserProposalsApi(f.runtime)).rejects.toThrow(); expect(f.fetcher).not.toHaveBeenCalled(); f.runtime.dispose();
  });
  it("rejects a late response after activity loss and never returns its private projection", async () => {
    const f = fixture(); let release!: (r: Response) => void; f.fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const api = await captureBrowserProposalsApi(f.runtime), request = api.consent(target);
    f.runtime.setActive(false); release(new Response(JSON.stringify(f.wire))); await expect(request).rejects.toThrow(); f.runtime.dispose();
  });
  it("does not revive an old captured activity epoch after blur then focus", async () => {
    const f = fixture(), api = await captureBrowserProposalsApi(f.runtime);
    f.runtime.setActive(false); f.runtime.setActive(true);
    await expect(api.consent(target)).rejects.toThrow(); expect(f.fetcher).not.toHaveBeenCalled(); f.runtime.dispose();
  });
  it("retires proposal captures on the existing cross-tab auth boundary", async () => {
    const first = fixture(), second = fixture();
    const a = await captureBrowserProposalsApi(first.runtime), b = await captureBrowserProposalsApi(second.runtime);
    broadcastAuthBoundary(); await expect(a.consent(target)).rejects.toThrow(); await expect(b.consent(target)).rejects.toThrow();
    expect(first.fetcher).not.toHaveBeenCalled(); expect(second.fetcher).not.toHaveBeenCalled(); first.runtime.dispose(); second.runtime.dispose();
  });
  it("cannot revive a prior proposal capture through account A to B to A", async () => {
    const f = fixture(), api = await captureBrowserProposalsApi(f.runtime); f.change(); f.returnToA();
    await expect(api.consent(target)).rejects.toThrow(); await expect(captureBrowserProposalsApi(f.runtime)).rejects.toThrow(); expect(f.fetcher).not.toHaveBeenCalled(); f.runtime.dispose();
  });
  it("calls a browser-brand-sensitive fetch without binding the participant port", async () => {
    const f = fixture();
    f.fetcher.mockImplementation(function (this: unknown) {
      expect(this).toBeUndefined();
      return Promise.resolve(new Response(JSON.stringify(f.wire)));
    });
    const api = await captureBrowserProposalsApi(f.runtime);
    await expect(api.consent(target)).resolves.toMatchObject({ accountId: f.wire.accountId, participant: "coach" });
    expect(f.fetcher).toHaveBeenCalledTimes(1); f.runtime.dispose();
  });
});
