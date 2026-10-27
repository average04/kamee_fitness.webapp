import { parseSellerTerms, type PricingErrorCode, type PricingSummary, type PricingWorkspace, type Money, type SellerTerms } from "./commerce";

export type PublishedSellerTerms = SellerTerms & { body: string; publishedAt: string };
export type CoachPricingData = {workspace: PricingWorkspace; terms: PublishedSellerTerms | null; termsError: boolean};
export type CoachPricingError = {code: PricingErrorCode; message: string};
export type CoachPricingResult = {data?: CoachPricingData; error?: CoachPricingError; mutationApplied?: boolean};
export type CoachPricingActions = {
  refresh: (listingId: string) => Promise<CoachPricingResult>;
  save: (input: unknown) => Promise<CoachPricingResult>;
  accept: (listingId: string, input: unknown, accepted: boolean) => Promise<CoachPricingResult>;
};
export function validListingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.exec(value)?.[0] === value;
}
/** The body is opaque published text, never locally rendered MDX or reconstructed prose. */
export function parsePublishedSellerTerms(input: unknown): PublishedSellerTerms | null {
  if (!input || typeof input !== "object" || !("terms" in input)) throw new Error("Invalid seller terms response");
  const raw = input.terms;
  if (raw === null) return null;
  const terms = parseSellerTerms(raw);
  if (!raw || typeof raw !== "object" || !("body" in raw) || typeof raw.body !== "string" || !raw.body.trim() || !("publishedAt" in raw) || typeof raw.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw.publishedAt) || !Number.isFinite(Date.parse(raw.publishedAt))) throw new Error("Invalid seller terms response");
  return {...terms, body: raw.body, publishedAt: raw.publishedAt};
}
export function hasCurrentSellerAcceptance(workspace: PricingWorkspace): boolean {
  return Boolean(workspace.terms && workspace.acceptance && workspace.terms.version === workspace.acceptance.version && workspace.terms.contentHash === workspace.acceptance.contentHash);
}
export function publishedTermsMatch(data: CoachPricingData): boolean {
  return Boolean(data.terms && data.workspace.terms && data.terms.version === data.workspace.terms.version && data.terms.contentHash === data.workspace.terms.contentHash);
}
export function formatReferenceMoney(money: Money): string {
  const minor = BigInt(money.minor);
  const absolute = minor < BigInt(0) ? -minor : minor;
  const scale = BigInt(100);
  const fraction = (absolute % scale).toString().padStart(2, "0");
  return `PHP ${minor < BigInt(0) ? "−" : ""}${(absolute / scale).toLocaleString("en-PH")}${fraction === "00" ? "" : `.${fraction}`}`;
}
export function coachPricingBadge(summary: PricingSummary | undefined): string {
  if (!summary) return "Pricing unavailable";
  const current = summary.platforms.filter(row => row.environment === "PRODUCTION" && row.effective && row.matchesCurrentVersion && (row.state === "active" || row.state === "change_pending"));
  if (!summary.requested) return current.length ? `Current reference ${formatReferenceMoney(current[0].effective!.referenceMoney)}` : "Price not set";
  const requested = formatReferenceMoney(summary.requested.referenceMoney);
  if (current.length === 2 && current.every(row=>row.effective?.id === summary.requested?.id)) return `Reference ${requested}`;
  return `Setup pending · Requested ${requested}`;
}
const messages: Record<PricingErrorCode, string> = {
  unauthorized: "Your session expired or an approved coach account is required. Sign in again; your content edits are preserved.",
  terms_unavailable: "Commercial terms are not available yet. Pricing is being prepared.",
  terms_outdated: "Review and explicitly accept the current commercial terms before saving a price.",
  option_disabled: "This reference price is not available yet. Pricing is being prepared.",
  retired: "Pricing cannot be changed for a retired listing.",
  conflict: "Pricing changed since you opened it. Your selection is preserved. Review it against the refreshed values before saving again.",
  operator_permission_required: "This change needs an operator. Please contact Kamee support.",
  registry_not_ready: "Store setup is still being prepared. Please try again later.",
  invalid_input: "Check your price selection or commercial terms acceptance and try again.",
  unavailable: "Pricing could not be loaded or updated. Please retry. Your content edits are preserved.",
};
export function coachPricingError(code: PricingErrorCode): CoachPricingError { return {code,message:messages[code]}; }
export function mapCoachPricingError(error: {message?: string;code?: string}): CoachPricingError {
  if (error.code === "42501" || error.code === "PGRST301" || error.message === "Denied") return coachPricingError("unauthorized");
  const message = error.message;
  // Existing Task 2 SQL names are mapped to the frozen UI error union.
  if (message === "revision_conflict") return coachPricingError("conflict");
  if (message === "Unsupported price option") return coachPricingError("option_disabled");
  if (error.code === "22023") return coachPricingError("invalid_input");
  return coachPricingError(message && Object.hasOwn(messages,message) ? message as PricingErrorCode : "unavailable");
}
