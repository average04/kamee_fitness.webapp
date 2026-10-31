import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), rpc: vi.fn(), publicDb: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coaching/auth", () => ({ requireCoach: m.auth }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: m.db }));
vi.mock("@/lib/supabase", () => ({ createSupabaseServerClient: m.publicDb }));
import { EarningsReconciliationError, loadCoachEarnings, loadEarningsPlanTitles } from "./earnings-query";
import { parseEarningsWorkspace } from "./earnings";
const query = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z", cursor: null, limit: 25 };
const workspace = () => ({ mode: "estimates", asOf: "2026-10-29T00:00:00Z", accountRevision: "0", period: { from: query.from, to: query.to }, productionSalesCount: "0", refundedSalesCount: "0", reversedSalesCount: "0", reviewRequiredCount: "0", referenceSales: [], estimatedCoachNet: null, estimateBasis: "unavailable", balances: [], activity: [], nextCursor: null });
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ user: { id: "owner" }, status: "approved" }); m.db.mockResolvedValue({ rpc: m.rpc }); m.rpc.mockResolvedValue({ data: workspace(), error: null }); });
describe("owner-bound earnings loader", () => {
  it("uses the authenticated cookie client and sends only validated p_input", async () => {
    expect(await loadCoachEarnings(query)).toMatchObject({ productionSalesCount: "0", estimatedCoachNet: null });
    expect(m.auth).toHaveBeenCalledOnce();
    expect(m.rpc).toHaveBeenCalledWith("get_coaching_earnings", { p_input: query });
  });
  it("permits a suspended seller statement without reading authoring tables", async () => {
    m.auth.mockResolvedValue({ user: { id: "owner" }, status: "suspended" });
    expect(await loadCoachEarnings(query)).toMatchObject({ mode: "estimates" });
    expect(m.rpc).toHaveBeenCalledOnce();
  });
  it("preserves sign-in redirects and makes no RPC for a missing session", async () => {
    m.auth.mockRejectedValue(new Error("REDIRECT:/login?next=/coaching"));
    await expect(loadCoachEarnings(query)).rejects.toThrow("REDIRECT:");
    expect(m.db).not.toHaveBeenCalled();
  });
  it("rejects invalid ranges and actor overrides before querying", async () => {
    await expect(loadCoachEarnings({ ...query, sellerId: "other" } as typeof query)).rejects.toThrow();
    expect(m.db).not.toHaveBeenCalled();
  });
  it.each([{ data: null, error: { code: "PGRST202" } }, { data: { error: { code: "forbidden" } }, error: null }, { data: { productionSalesCount: "0" }, error: null }])("reports inaccessible/malformed responses as unavailable, never an empty zero", async (response) => {
    m.rpc.mockResolvedValue(response);
    await expect(loadCoachEarnings(query)).rejects.toThrow("Earnings are unavailable");
  });
  it("distinguishes required reconciliation from a retryable backend outage", async () => {
    m.rpc.mockResolvedValue({ data: { error: { code: "reconciliation_required", privateEvidence: "secret" } }, error: null });
    await expect(loadCoachEarnings(query)).rejects.toBeInstanceOf(EarningsReconciliationError);
    await expect(loadCoachEarnings(query)).rejects.toThrow("review");
    m.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(loadCoachEarnings(query)).rejects.not.toBeInstanceOf(EarningsReconciliationError);
    await expect(loadCoachEarnings(query)).rejects.toThrow("Earnings are unavailable");
  });
  it("retains an all-time review count when cursor and period select no activity", async () => {
    m.rpc.mockResolvedValue({ data: { ...workspace(), reviewRequiredCount: "3" }, error: null });
    expect((await loadCoachEarnings(query)).reviewRequiredCount).toBe("3");
    expect((await loadCoachEarnings({ ...query, cursor: { at: "2026-10-20T00:00:00.123456Z", id: "a".repeat(64) } })).reviewRequiredCount).toBe("3");
    const otherPeriod = { ...query, from: "2026-09-01T00:00:00Z", to: query.from };
    m.rpc.mockResolvedValue({ data: { ...workspace(), period: { from: otherPeriod.from, to: otherPeriod.to }, reviewRequiredCount: "3" }, error: null });
    expect((await loadCoachEarnings(otherPeriod)).reviewRequiredCount).toBe("3");
  });
  it("rejects a valid statement for a different period", async () => {
    m.rpc.mockResolvedValue({ data: { ...workspace(), period: { from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z" } }, error: null });
    await expect(loadCoachEarnings(query)).rejects.toThrow("Earnings are unavailable");
  });
  it("handles transport failure without exposing backend evidence", async () => {
    m.rpc.mockRejectedValue(new Error("sensitive provider response"));
    await expect(loadCoachEarnings(query)).rejects.toThrow(/^Earnings are unavailable/);
  });
  it("rejects activity repeated at or ahead of the requested cursor", async () => {
    const cursor = { at: "2026-10-20T10:11:12.123456Z", id: "a".repeat(64) };
    const row = { ...cursor, kind: "sale", listingId: null, sourceClass: "reference_value", money: { currency: "PHP", exponent: 2, minor: "99900" }, status: "provisional" };
    m.rpc.mockResolvedValue({ data: { ...workspace(), activity: [row] }, error: null });
    await expect(loadCoachEarnings({ ...query, cursor })).rejects.toThrow("Earnings are unavailable");
    m.rpc.mockResolvedValue({ data: { ...workspace(), activity: [{ ...row, at: "2026-10-20T10:11:12.123455Z" }] }, error: null });
    expect((await loadCoachEarnings({ ...query, cursor })).activity[0].at).toBe("2026-10-20T10:11:12.123455Z");
  });
});

describe("optional public activity titles", () => {
  const listingId = "10000000-0000-0000-0000-000000000001";
  const data = () => parseEarningsWorkspace({ ...workspace(), activity: [{ id: "a".repeat(64), at: "2026-10-20T00:00:00Z", kind: "sale", sourceClass: "reference_value", money: { currency: "PHP", exponent: 2, minor: "99900" }, status: "provisional", listingId }] });
  beforeEach(() => {
    const chain = { select: m.select, eq: m.eq, in: m.in, order: m.order };
    m.from.mockReturnValue(chain); m.select.mockReturnValue(chain); m.eq.mockReturnValue(chain); m.in.mockReturnValue(chain);
    m.order.mockResolvedValue({ data: [{ listing_id: listingId, title: "Current public plan", version_no: 2 }, { listing_id: listingId, title: "Old title", version_no: 1 }, { listing_id: "other", title: "Unrelated" }], error: null });
    m.publicDb.mockReturnValue({ from: m.from });
    m.db.mockResolvedValue({ from: m.from });
  });
  it("loads only published approved current-page coach titles through the owner cookie client", async () => {
    expect(await loadEarningsPlanTitles(data())).toEqual({ [listingId]: "Current public plan" });
    expect(m.from).toHaveBeenCalledWith("plans");
    expect(m.select).toHaveBeenCalledWith("listing_id,title,version_no");
    expect(m.in).toHaveBeenCalledWith("listing_id", [listingId]);
    expect(m.eq.mock.calls).toEqual([["kind", "coach"], ["is_published", true], ["review_status", "approved"]]);
    expect(m.db).toHaveBeenCalledOnce();
    expect(m.publicDb).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("reads suspended-owner listing titles through unchanged RLS without an approved-authoring gate", async () => {
    m.auth.mockResolvedValue({ user: { id: "owner" }, status: "suspended" });
    expect(await loadEarningsPlanTitles(data())).toEqual({ [listingId]: "Current public plan" });
    expect(m.db).toHaveBeenCalledOnce();
    expect(m.publicDb).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("preserves the statement when public titles are unavailable or plans are retired", async () => {
    m.order.mockResolvedValue({ data: null, error: { code: "unavailable" } });
    expect(await loadEarningsPlanTitles(data())).toEqual({});
    m.db.mockRejectedValue(new Error("offline"));
    expect(await loadEarningsPlanTitles(data())).toEqual({});
    expect(await loadEarningsPlanTitles({ ...data(), activity: [] })).toEqual({});
  });
});
