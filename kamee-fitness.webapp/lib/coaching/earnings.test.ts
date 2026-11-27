import { describe, expect, it } from "vitest";
import { formatEarningsMoney, parseEarningsQuery, parseEarningsSearchParams, parseEarningsWorkspace } from "./earnings";

const from = "2026-10-01T00:00:00Z";
const to = "2026-11-01T00:00:00Z";
const at = "2026-10-20T10:11:12.123456Z";
const id = "a".repeat(64);
const money = { currency: "PHP", exponent: 2, minor: "9007199254740993" };
const fixture = () => ({ mode: "estimates", asOf: "2026-10-29T00:00:00Z", accountRevision: "0", period: { from, to }, productionSalesCount: "1", refundedSalesCount: "0", reversedSalesCount: "0", reviewRequiredCount: "0", referenceSales: [money], estimatedCoachNet: null, estimateBasis: "unavailable", balances: [], activity: [{ id, at, kind: "sale", listingId: null, sourceClass: "reference_value", money, status: "provisional" }], nextCursor: null });

describe("earnings checked contract", () => {
  it("preserves exact money, UTC microseconds and unavailable earnings", () => {
    expect(parseEarningsWorkspace(fixture())).toMatchObject({ estimatedCoachNet: null, balances: [], activity: [{ at }], referenceSales: [money] });
    expect(formatEarningsMoney(money)).toBe("PHP 90,071,992,547,409.93");
    expect(formatEarningsMoney({ currency: "PHP", exponent: 2, minor: "-1" })).toBe("PHP −0.01");
  });
  it.each([9007199254740993, 100, "01", "-0", "1e2", " 1", "1\n", "9223372036854775808"])("rejects unsafe/noncanonical money %j", (minor) => {
    expect(() => parseEarningsWorkspace({ ...fixture(), referenceSales: [{ ...money, minor }] })).toThrow();
  });
  it.each([{ currency: "USD", exponent: 2, minor: "0" }, { currency: "PHP", exponent: 0, minor: "0" }])("rejects unsupported currency metadata", (value) => {
    expect(() => parseEarningsWorkspace({ ...fixture(), referenceSales: [value] })).toThrow();
  });
  it.each([{ estimatedCoachNet: [] }, { balances: [{}] }, { mode: "settlement" }, { accountRevision: "1" }, { productionSalesCount: 0 }, { productionSalesCount: "01" }, { error: { code: "forbidden" } }])("fails closed for unsupported or malformed financial claims", (patch) => {
    expect(() => parseEarningsWorkspace({ ...fixture(), ...patch })).toThrow();
  });
  it("distinguishes verified empty totals from unavailable earnings", () => {
    const value = parseEarningsWorkspace({ ...fixture(), productionSalesCount: "0", referenceSales: [], activity: [] });
    expect(value.productionSalesCount).toBe("0");
    expect(value.estimatedCoachNet).toBeNull();
  });
  it("preserves the required all-time review count independently of period and page", () => {
    const first = parseEarningsWorkspace({ ...fixture(), reviewRequiredCount: "9007199254740993" });
    const otherPeriod = parseEarningsWorkspace({ ...fixture(), reviewRequiredCount: "9007199254740993", period: { from: "2026-09-01T00:00:00Z", to: from }, productionSalesCount: "0", referenceSales: [], activity: [] });
    const emptyPage = parseEarningsWorkspace({ ...fixture(), reviewRequiredCount: "9007199254740993", activity: [] });
    expect([first.reviewRequiredCount, otherPeriod.reviewRequiredCount, emptyPage.reviewRequiredCount]).toEqual(["9007199254740993", "9007199254740993", "9007199254740993"]);
  });
  it.each([undefined, null, 0, "01", "-1", "1\n", "9223372036854775808"])("rejects missing or noncanonical review counts %j", reviewRequiredCount => {
    expect(() => parseEarningsWorkspace({ ...fixture(), reviewRequiredCount })).toThrow();
  });
  it("retains original sale money and counts when its effective activity needs review", () => {
    const parsed = parseEarningsWorkspace({ ...fixture(), reviewRequiredCount: "1", activity: [{ ...fixture().activity[0], status: "held" }] });
    expect(parsed).toMatchObject({ productionSalesCount: "1", referenceSales: [money], estimatedCoachNet: null, reviewRequiredCount: "1", activity: [{ status: "held", sourceClass: "reference_value", money }] });
  });
  it.each([
    { kind: "refund", sourceClass: "verified_sale", money: null },
    { kind: "reversal", sourceClass: "verified_sale", money: null },
    { kind: "sale", sourceClass: "verified_sale", money },
    { kind: "sale", sourceClass: "reference_value", money: null },
    { kind: "sale", sourceClass: "reference_value", money: { ...money, minor: "-1" } },
  ])("rejects held status outside a proved reference-value sale %j", patch => {
    expect(() => parseEarningsWorkspace({ ...fixture(), reviewRequiredCount: "1", activity: [{ ...fixture().activity[0], ...patch, status: "held" }] })).toThrow();
  });
  it("rejects a held sale with a contradictory zero all-time review count", () => {
    expect(() => parseEarningsWorkspace({ ...fixture(), activity: [{ ...fixture().activity[0], status: "held" }] })).toThrow();
  });
  it("rejects duplicate/out-of-period activities and a cursor that does not match the page", () => {
    const row = fixture().activity[0];
    for (const patch of [{ activity: [row, row] }, { activity: [{ ...row, at: to }] }, { nextCursor: { at, id: "b".repeat(64) } }]) {
      expect(() => parseEarningsWorkspace({ ...fixture(), ...patch })).toThrow();
    }
  });
  it("discards unexpected private fields instead of leaking them into the DTO", () => {
    const parsed = parseEarningsWorkspace({ ...fixture(), buyerId: "private-buyer", activity: [{ ...fixture().activity[0], transactionId: "private-store-id" }] });
    expect(JSON.stringify(parsed)).not.toContain("private-");
  });
  it("allows verified refund/reversal facts without fabricating money", () => {
    const row = fixture().activity[0];
    const parsed = parseEarningsWorkspace({ ...fixture(), activity: [{ ...row, kind: "refund", sourceClass: "verified_sale", money: null }, { ...row, id: "0".repeat(64), kind: "reversal", sourceClass: "verified_sale", money: null }] });
    expect(parsed.activity.map(row => row.money)).toEqual([null, null]);
  });
  it.each([
    { kind: "sale", sourceClass: "verified_sale", money },
    { kind: "sale", sourceClass: "reference_value", money: null },
    { kind: "sale", sourceClass: "reference_value", money: { ...money, minor: "-1" } },
    { kind: "refund", sourceClass: "verified_sale", money },
    { kind: "refund", sourceClass: "reference_value", money: null },
    { kind: "reversal", sourceClass: "verified_sale", money },
    { kind: "settlement_credit", sourceClass: "settlement", money },
  ])("rejects contradictory or unsupported activity money %j", (patch) => {
    expect(() => parseEarningsWorkspace({ ...fixture(), activity: [{ ...fixture().activity[0], ...patch }] })).toThrow();
  });
  it.each(["raw-store-id", "A".repeat(64), "a".repeat(63), "a".repeat(64) + "\n"])("rejects unreviewed projection identifiers %j", (id) => {
    expect(() => parseEarningsWorkspace({ ...fixture(), activity: [{ ...fixture().activity[0], id }] })).toThrow();
  });
  it("rejects terminal-newline listing identifiers", () => {
    expect(() => parseEarningsWorkspace({ ...fixture(), activity: [{ ...fixture().activity[0], listingId: "10000000-0000-0000-0000-000000000001\n" }] })).toThrow();
  });
  it("orders equal timestamps by exact opaque ID rather than rounding event time", () => {
    const row = fixture().activity[0];
    expect(() => parseEarningsWorkspace({ ...fixture(), activity: [{ ...row, id: "0".repeat(64) }, row] })).toThrow();
    const next = { ...row, id: "0".repeat(64), at: "2026-10-20T10:11:12.123455Z" };
    expect(parseEarningsWorkspace({ ...fixture(), activity: [row, next], nextCursor: { at: next.at, id: next.id } }).activity.map(row => row.at)).toEqual([at, "2026-10-20T10:11:12.123455Z"]);
  });
});

describe("earnings period and cursor validation", () => {
  it("retains the exact SQL cursor and binds a maximum fifty-row request", () => {
    expect(parseEarningsQuery({ from, to, cursor: { at, id }, limit: 50 })).toEqual({ from, to, cursor: { at, id }, limit: 50 });
  });
  it.each([
    { from: "2026-02-30T00:00:00Z" }, { from: "2026-10-01T24:00:00Z" }, { from: "2026-10-01T00:00:00+08:00" }, { from: "2026-10-01" },
    { to: from }, { to: "2027-10-03T00:00:00Z" }, { limit: 51 }, { limit: 0 }, { limit: 1.5 },
    { cursor: { at: "2026-10-20T10:11:12.123456Z\n", id } }, { cursor: { at: to, id } }, { cursor: { at, id: "raw/customer id" } },
    { sellerId: "other-seller" },
  ])("rejects malformed or unscoped requests %j", (patch) => {
    expect(() => parseEarningsQuery({ from, to, cursor: null, limit: 25, ...patch })).toThrow();
  });
  it("resolves real date inputs and a UTC current-month default", () => {
    expect(parseEarningsSearchParams({}, new Date("2026-10-29T23:59:59Z"))).toEqual({ from, to: "2026-10-30T00:00:00Z", cursor: null, limit: 25 });
    expect(parseEarningsSearchParams({ from: "2026-10-01", to: "2026-11-01", cursorAt: at, cursorId: id, limit: "1" })).toEqual({ from, to, cursor: { at, id }, limit: 1 });
  });
  it.each([{ from: ["2026-10-01", "2026-10-02"] }, { from: "2026-10-01" }, { cursorAt: at }, { cursorId: id }, { limit: "1e1" }, { limit: "1\n" }, { to: "2026-02-30", from: "2026-02-01" }])("rejects ambiguous URLs instead of silently showing another period", (params) => {
    expect(() => parseEarningsSearchParams(params)).toThrow();
  });
});
