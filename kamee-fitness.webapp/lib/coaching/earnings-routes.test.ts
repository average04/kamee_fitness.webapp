import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ load: vi.fn(), titles: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coaching/earnings-query", async importOriginal => ({ ...await importOriginal<typeof import("./earnings-query")>(), loadCoachEarnings: m.load, loadEarningsPlanTitles: m.titles }));
import { EarningsReconciliationError } from "./earnings-query";
import CoachEarningsPage from "@/app/coaching/(hub)/earnings/page";
import { CoachEarnings } from "@/components/coaching/earnings/CoachEarnings";
import { parseEarningsWorkspace } from "./earnings";
const query = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z", cursor: null, limit: 25 };
const id = "a".repeat(64);
const at = "2026-10-20T10:11:12.123456Z";
const workspace = () => parseEarningsWorkspace({ mode: "estimates", asOf: "2026-10-29T00:00:00Z", accountRevision: "0", period: { from: query.from, to: query.to }, productionSalesCount: "18", refundedSalesCount: "2", reversedSalesCount: "1", reviewRequiredCount: "0", referenceSales: [{ currency: "PHP", exponent: 2, minor: "9007199254740993" }], estimatedCoachNet: null, estimateBasis: "unavailable", balances: [], activity: [{ id, at, kind: "sale", listingId: null, sourceClass: "reference_value", money: { currency: "PHP", exponent: 2, minor: "99900" }, status: "provisional" }], nextCursor: { at, id } });
beforeEach(() => { vi.clearAllMocks(); m.load.mockResolvedValue(workspace()); m.titles.mockResolvedValue({}); });
describe("real earnings route", () => {
  it("loads the real selected date range rather than a fictional dashboard report", async () => {
    const page = await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) });
    const html = renderToStaticMarkup(page);
    expect(m.load).toHaveBeenCalledWith(query);
    expect(html).toContain("Reference sales value");
    expect(html).toContain("PHP 90,071,992,547,409.93");
    expect(html).toContain("Estimated earnings unavailable");
    expect(html).toContain("Final earnings follow store settlement");
    expect(html).toContain("Retired plan");
    expect(html).not.toContain(">" + id + "<");
    expect(html).not.toContain("Sample data");
    expect(html).not.toMatch(/Withdraw|Transfer|Pay now/);
    expect(html.match(/Not enabled/g)).toHaveLength(3);
  });
  it("retains whole-period totals and exact microseconds in pagination", () => {
    const html = renderToStaticMarkup(createElement(CoachEarnings, { query, data: workspace(), error: null }));
    expect(html).toContain("Whole-period totals");
    expect(html).toContain(">18<");
    expect(html).toContain("cursorAt=2026-10-20T10%3A11%3A12.123456Z");
    expect(html).toContain("cursorId=" + id);
    expect(html).toContain("from=2026-10-01T00%3A00%3A00Z");
    expect(html).toContain('type="date"');
    expect(html).toContain('for="earnings-from"');
    expect(html).toContain('for="earnings-to"');
  });
  it("shows a verified empty period without fabricating an available balance", async () => {
    m.load.mockResolvedValue({ ...workspace(), productionSalesCount: "0", refundedSalesCount: "0", reversedSalesCount: "0", referenceSales: [], activity: [], nextCursor: null });
    const html = renderToStaticMarkup(await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) }));
    expect(html).toContain("No verified production activity in this period");
    expect(html).toContain("No reference sales value in this period");
    expect(html).not.toContain("PHP 0");
  });
  it("shows a recoverable unavailable state with no fabricated zero totals", async () => {
    m.load.mockRejectedValue(new Error("Earnings are unavailable"));
    const html = renderToStaticMarkup(await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn’t load your earnings");
    expect(html).toContain("Try again");
    expect(html).not.toContain("Whole-period totals");
    expect(html).not.toContain("PHP 0");
  });
  it("shows permanent reconciliation as a needs-review alert without retrying", async () => {
    m.load.mockRejectedValue(new EarningsReconciliationError());
    const html = renderToStaticMarkup(await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Your earnings need review");
    expect(html).toContain("reconciliation");
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("Whole-period totals");
    expect(html).not.toContain("PHP 0");
  });
  it("keeps original sales visible with held activity and qualified known-effect counts", async () => {
    m.load.mockResolvedValue({ ...workspace(), reviewRequiredCount: "3", activity: [{ ...workspace().activity[0], status: "held" }] });
    const html = renderToStaticMarkup(await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("3 transactions across your sales history need review");
    expect(html).toContain("Verified original sales and their reference values remain counted");
    expect(html).toContain("Known refund and reversal counts may be incomplete");
    expect(html).toContain("Known refunds");
    expect(html).toContain("Known reversals");
    expect(html).toContain("Activity needs review");
    expect(html).toContain("PHP 999.00");
    expect(html).toContain(">18<");
    expect(html).not.toContain("Whole-period totals");
    expect(html).not.toContain("Reference value · provisional");
  });
  it("keeps the all-time needs-review notice on another activity page", () => {
    const data = { ...workspace(), reviewRequiredCount: "3", activity: [], nextCursor: null };
    const html = renderToStaticMarkup(createElement(CoachEarnings, { query: { ...query, cursor: { at, id } }, data, error: null }));
    expect(html).toContain("3 transactions across your sales history need review");
    expect(html).toContain("Known refund and reversal counts may be incomplete");
    expect(html).toContain(">18<");
    expect(html).toContain("Back to newest");
    expect(html).not.toContain("Try again");
  });
  it("reports an invalid URL range without querying or replacing it with another period", async () => {
    const html = renderToStaticMarkup(await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-02-30", to: "2026-03-01" }) }));
    expect(m.load).not.toHaveBeenCalled();
    expect(html).toContain("Check your date range");
    expect(html).toContain('href="#earnings-from"');
    expect(html).not.toContain("Whole-period totals");
  });
  it("lets Next authentication redirects reach the framework", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login?next=/coaching;307;" });
    m.load.mockRejectedValue(redirect);
    await expect(CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) })).rejects.toBe(redirect);
  });
  it("shows a current public plan title and falls back for unavailable listings", async () => {
    const listingId = "10000000-0000-0000-0000-000000000001";
    m.load.mockResolvedValue({ ...workspace(), activity: [{ ...workspace().activity[0], listingId }] });
    m.titles.mockResolvedValue({ [listingId]: "Foundation training" });
    const html = renderToStaticMarkup(await CoachEarningsPage({ searchParams: Promise.resolve({ from: "2026-10-01", to: "2026-11-01" }) }));
    expect(html).toContain("Foundation training");
    expect(html).not.toContain("Retired plan");
    expect(html).not.toContain(">" + listingId + "<");
  });
});
