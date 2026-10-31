import { parseMoney, parseRevision, type Money } from "./commerce";

export type { Money } from "./commerce";
export type EarningsCursor = { at: string; id: string };
export type EarningsQuery = { from: string; to: string; cursor: EarningsCursor | null; limit: number };
export type EarningsActivity = {
  id: string; at: string; kind: "sale" | "refund" | "reversal";
  listingId: string | null; sourceClass: "verified_sale" | "reference_value";
  money: Money | null; status: "provisional" | "held";
};
/** Release A deliberately accepts no financial balances or settlement claims. */
export type EarningsWorkspace = {
  mode: "estimates"; asOf: string; accountRevision: "0";
  period: { from: string; to: string };
  productionSalesCount: string; refundedSalesCount: string; reversedSalesCount: string;
  reviewRequiredCount: string;
  referenceSales: Money[]; estimatedCoachNet: null; estimateBasis: "unavailable";
  balances: []; activity: EarningsActivity[]; nextCursor: EarningsCursor | null;
};
export type EarningsSearchParams = Record<string, string | string[] | undefined>;

function invalid(): never { throw new Error("Invalid earnings data"); }
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid();
  return input as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) invalid();
}
/** Compare instants as integer microseconds; Date is used only for calendar validation. */
export function earningsInstant(input: unknown): bigint {
  if (typeof input !== "string") invalid();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(input);
  if (!match || match[0] !== input || match[1].startsWith("0000")) invalid();
  const whole = `${match[1]}T${match[2]}.000Z`;
  const milliseconds = Date.parse(whole);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== whole) invalid();
  return BigInt(milliseconds) * BigInt(1000) + BigInt((match[3] ?? "").padEnd(6, "0"));
}
function timestamp(input: unknown): string { earningsInstant(input); return input as string; }
function opaqueId(input: unknown): string {
  if (typeof input !== "string" || !/^[a-f0-9]{64}$/.test(input) || input.length !== 64) invalid();
  return input;
}
function cursor(input: unknown): EarningsCursor | null {
  if (input === null) return null;
  const value = record(input); exactKeys(value, ["at", "id"]);
  return { at: timestamp(value.at), id: opaqueId(value.id) };
}
function isBefore(a: EarningsCursor, b: EarningsCursor): boolean {
  const at = earningsInstant(a.at), bt = earningsInstant(b.at);
  return at < bt || (at === bt && a.id < b.id);
}
export function parseEarningsQuery(input: unknown): EarningsQuery {
  const value = record(input); exactKeys(value, ["from", "to", "cursor", "limit"]);
  const from = timestamp(value.from), to = timestamp(value.to);
  const span = earningsInstant(to) - earningsInstant(from);
  if (span <= BigInt(0) || span > BigInt(366 * 86400) * BigInt(1000000)) invalid();
  if (typeof value.limit !== "number" || !Number.isInteger(value.limit) || value.limit < 1 || value.limit > 50) invalid();
  const next = cursor(value.cursor);
  if (next && (earningsInstant(next.at) < earningsInstant(from) || earningsInstant(next.at) >= earningsInstant(to))) invalid();
  return { from, to, cursor: next, limit: value.limit };
}
function dateInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
}
export function parseEarningsSearchParams(params: EarningsSearchParams, now = new Date()): EarningsQuery {
  const single = (key: string) => {
    const value = params[key];
    if (value !== undefined && typeof value !== "string") invalid();
    return value;
  };
  let from = single("from"), to = single("to");
  if (from === undefined && to === undefined) {
    const today = now.toISOString().slice(0, 10);
    from = `${today.slice(0, 7)}-01`;
    to = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  if (!from || !to) invalid();
  const at = single("cursorAt"), id = single("cursorId"), rawLimit = single("limit");
  if ((at === undefined) !== (id === undefined)) invalid();
  if (rawLimit !== undefined && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit)) invalid();
  return parseEarningsQuery({ from: dateInput(from), to: dateInput(to), cursor: at === undefined ? null : { at, id }, limit: rawLimit === undefined ? 25 : Number(rawLimit) });
}
export function earningsHref(query: EarningsQuery, next: EarningsCursor | null = null): string {
  const params = new URLSearchParams({ from: query.from, to: query.to, limit: String(query.limit) });
  if (next) { params.set("cursorAt", next.at); params.set("cursorId", next.id); }
  return `/coaching/earnings?${params.toString()}`;
}
export function parseEarningsWorkspace(input: unknown): EarningsWorkspace {
  const value = record(input);
  if ("error" in value || value.mode !== "estimates" || value.accountRevision !== "0" || value.estimatedCoachNet !== null || value.estimateBasis !== "unavailable" || !Array.isArray(value.balances) || value.balances.length !== 0) invalid();
  const period = record(value.period);
  const reviewRequiredCount = parseRevision(value.reviewRequiredCount);
  const query = parseEarningsQuery({ from: period.from, to: period.to, cursor: null, limit: 50 });
  if (!Array.isArray(value.referenceSales) || !Array.isArray(value.activity) || value.activity.length > 50) invalid();
  const referenceSales = value.referenceSales.map(parseMoney);
  const currencies = new Set<string>();
  for (const money of referenceSales) {
    if (currencies.has(money.currency) || BigInt(money.minor) < BigInt(0)) invalid();
    currencies.add(money.currency);
  }
  const ids = new Set<string>();
  const activity: EarningsActivity[] = value.activity.map(input => {
    const row = record(input);
    if (!["sale", "refund", "reversal"].includes(row.kind as string) || !["verified_sale", "reference_value"].includes(row.sourceClass as string)) invalid();
    if (row.status !== "provisional" && !(row.status === "held" && row.kind === "sale" && reviewRequiredCount !== "0")) invalid();
    const id = opaqueId(row.id), at = timestamp(row.at);
    if (ids.has(id) || earningsInstant(at) < earningsInstant(query.from) || earningsInstant(at) >= earningsInstant(query.to)) invalid();
    ids.add(id);
    const money = row.money === null ? null : parseMoney(row.money);
    if (row.kind === "sale") {
      if (row.sourceClass !== "reference_value" || money === null || BigInt(money.minor) < BigInt(0)) invalid();
    } else if (row.sourceClass !== "verified_sale" || money !== null) invalid();
    if (row.listingId !== null && (typeof row.listingId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.listingId))) invalid();
    return { id, at, kind: row.kind as EarningsActivity["kind"], listingId: row.listingId as string | null, sourceClass: row.sourceClass as EarningsActivity["sourceClass"], money, status: row.status as EarningsActivity["status"] };
  });
  for (let index = 1; index < activity.length; index++) if (!isBefore(activity[index], activity[index - 1])) invalid();
  const nextCursor = cursor(value.nextCursor);
  const last = activity.at(-1);
  if (nextCursor && (!last || nextCursor.at !== last.at || nextCursor.id !== last.id)) invalid();
  return { mode: "estimates", asOf: timestamp(value.asOf), accountRevision: "0", period: { from: query.from, to: query.to }, productionSalesCount: parseRevision(value.productionSalesCount), refundedSalesCount: parseRevision(value.refundedSalesCount), reversedSalesCount: parseRevision(value.reversedSalesCount), reviewRequiredCount, referenceSales, estimatedCoachNet: null, estimateBasis: "unavailable", balances: [], activity, nextCursor };
}
/** Exact integer formatting: no amount is converted to a floating-point number. */
export function formatEarningsMoney(input: Money): string {
  const money = parseMoney(input), minor = BigInt(money.minor);
  const absolute = (minor < BigInt(0) ? -minor : minor).toString().padStart(money.exponent + 1, "0");
  const whole = money.exponent ? absolute.slice(0, -money.exponent) : absolute;
  const fraction = money.exponent ? `.${absolute.slice(-money.exponent)}` : "";
  return `${money.currency} ${minor < BigInt(0) ? "−" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction}`;
}
