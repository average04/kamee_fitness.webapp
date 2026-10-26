// Synthetic acceptance fixture only. No hosted identities or service credentials.
import { PHP_REFERENCE_PRICES, type AdminProductWorkspace, type ReadinessSummary } from "./commerce";

export const adminFixtureIds = {
  listing: "10000000-0000-4000-8000-000000000001",
  version: "10000000-0000-4000-8000-000000000002",
  request: "10000000-0000-4000-8000-000000000003",
  product: "10000000-0000-4000-8000-000000000004",
  actor: "10000000-0000-4000-8000-000000000005",
  offer: "10000000-0000-4000-8000-000000000006",
};
export function makeAdminCommerceFixture(canManageProducts = false): AdminProductWorkspace {
  const options = PHP_REFERENCE_PRICES.map((referenceMoney, i) => ({
    id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    code: `php_${referenceMoney.minor}`, referenceMoney, legacyTier: null,
    enabled: false, revision: "0", displayOrder: i + 1,
  }));
  const request = {id:adminFixtureIds.request,optionId:options[0].id,referenceMoney:options[0].referenceMoney,acceptedTermsVersion:"synthetic-v1",requestedAt:"2026-10-27T00:00:00Z"};
  const platforms: ReadinessSummary[] = (["ios", "android"] as const).flatMap(platform => (["SANDBOX", "PRODUCTION"] as const).map(environment => ({platform,environment,state:"unconfigured" as const,effective:null,offerRevision:null,effectiveVersionId:null,effectiveVersionNo:null,matchesCurrentVersion:false,setupOutcome:"none" as const,setupPriceRevisionId:null,reason:"not_configured" as const})));
  return {
    canManageProducts, configRevision:"3", registryRevisions:[{projectKey:"synthetic-project",revision:"7"}],
    workspace:{listingId:adminFixtureIds.listing,listingStatus:"active",currentVersionId:adminFixtureIds.version,currentVersionNo:1,contentApproved:true,pricing:{listingId:adminFixtureIds.listing,revision:"4",requested:request,platforms},requestedOptionCurrent:true,options,terms:{version:"synthetic-v1",contentHash:"a".repeat(64)},acceptance:{version:"synthetic-v1",contentHash:"a".repeat(64),acceptedAt:"2026-10-27T00:00:00Z"},salesEnabled:false,canRequestPrice:false,platforms},
    products:[{id:adminFixtureIds.product,listingId:adminFixtureIds.listing,sellerId:adminFixtureIds.actor,platform:"ios",storeAppId:"synthetic.app",storeProductId:"synthetic.plan",projectKey:"synthetic-project",providerAppId:"synthetic-provider-app",providerProductId:"synthetic-provider-product",createdAt:"2026-10-27T00:00:00Z",environments:platforms.filter(p=>p.platform==="ios").map(p=>({...p,revision:"2",setupRevision:"9",verifiedEvidenceRef:null})),audit:[]}],
  };
}
