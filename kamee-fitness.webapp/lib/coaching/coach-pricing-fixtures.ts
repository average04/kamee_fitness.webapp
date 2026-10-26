import { PHP_REFERENCE_PRICES, type PricingWorkspace } from "./commerce";

export const coachListingId = "10000000-0000-0000-0000-000000000001";
export const coachVersionId = "10000000-0000-0000-0000-000000000002";
export const coachTermsHash = "a".repeat(64);
export const publishedCoachTerms = { version: "seller-v1", contentHash: coachTermsHash, body: "Exact published terms.\n<script>Not HTML</script>", publishedAt: "2026-10-27T00:00:00Z" };
export function coachPricingFixture(enabled = false): PricingWorkspace {
  const platforms: PricingWorkspace["platforms"] = (["ios", "android"] as const).flatMap(platform => (["PRODUCTION", "SANDBOX"] as const).map(environment => ({platform, environment, state: "unconfigured", effective: null, offerRevision: null, effectiveVersionId: null, effectiveVersionNo: null, matchesCurrentVersion: false, setupOutcome: "none", setupPriceRevisionId: null, reason: "not_configured"})));
  return {
    listingId: coachListingId, listingStatus: "active", currentVersionId: coachVersionId, currentVersionNo: 2, contentApproved: true,
    pricing: { listingId: coachListingId, revision: "9007199254740993", requested: null, platforms: platforms.map(({ platform, environment, state, effective, offerRevision }) => ({platform, environment, state, effective, offerRevision})) },
    requestedOptionCurrent: false, options: PHP_REFERENCE_PRICES.map((referenceMoney, i) => ({id: `20000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`, code: `PHP_${referenceMoney.minor.slice(0, -2)}`, referenceMoney, legacyTier: null, enabled, revision: "0", displayOrder: i + 1})),
    terms: {version: publishedCoachTerms.version, contentHash: coachTermsHash}, acceptance: null, salesEnabled: false, canRequestPrice: false, platforms,
  };
}
