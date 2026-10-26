// Keep dependency-free pricing contracts in parity with the app coaching contracts.
export type Money = { currency: string; exponent: number; minor: string };
export type StorePlatform = 'ios' | 'android';
export type VerifiedEnvironment = 'PRODUCTION' | 'SANDBOX';

// Extend only with audited currency exponent data for future store/settlement stages.
const CURRENCY_EXPONENTS = new Map<string, number>([['PHP', 2]]);
const MIN_SIGNED_BIGINT = BigInt('-9223372036854775808');
const MAX_SIGNED_BIGINT = BigInt('9223372036854775807');
const MONEY_INTEGER = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
const REVISION_INTEGER = /^(0|[1-9][0-9]*)$/;

function parseInteger(input: unknown, pattern: RegExp, minimum: bigint, label: string): string {
  if (typeof input !== 'string') throw new Error(`Invalid ${label}`);
  const match = input.match(pattern);
  // JavaScript's $ also matches before a terminal newline; require the entire input.
  if (!match || match[0] !== input) throw new Error(`Invalid ${label}`);
  const value = BigInt(input);
  if (value < minimum || value > MAX_SIGNED_BIGINT) throw new Error(`Invalid ${label}`);
  return input;
}

export function parseMoney(input: unknown): Money {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid money');
  }
  const { currency, exponent, minor } = input as Record<string, unknown>;
  if (
    typeof currency !== 'string' ||
    !CURRENCY_EXPONENTS.has(currency) ||
    typeof exponent !== 'number' ||
    exponent !== CURRENCY_EXPONENTS.get(currency)
  ) {
    throw new Error('Invalid money currency or exponent');
  }
  return {
    currency,
    exponent,
    minor: parseInteger(minor, MONEY_INTEGER, MIN_SIGNED_BIGINT, 'money minor'),
  };
}

export function parseRevision(input: unknown): string {
  return parseInteger(input, REVISION_INTEGER, BigInt('0'), 'revision');
}

// Reference amounts only: storefront prices and actual proceeds are separate values.
export const PHP_REFERENCE_PRICES: readonly Money[] = [
  '20000',
  '30000',
  '40000',
  '50000',
  '60000',
  '70000',
  '80000',
  '90000',
  '100000',
  '110000',
  '120000',
  '130000',
  '140000',
  '150000',
  '160000',
  '170000',
  '180000',
  '190000',
  '200000',
  '250000',
  '300000',
  '350000',
  '400000',
  '450000',
  '500000',
  '550000',
  '600000',
  '650000',
  '700000',
  '750000',
  '800000',
  '850000',
  '900000',
  '950000',
  '1000000',
  '1100000',
  '1200000',
  '1300000',
  '1400000',
  '1500000',
  '1600000',
  '1700000',
  '1800000',
  '1900000',
  '2000000',
].map((minor) => ({ currency: 'PHP', exponent: 2, minor }));
const PHP_REFERENCE_MINORS = new Set(PHP_REFERENCE_PRICES.map((money) => money.minor));

export function isSupportedReferencePrice(input: Money): boolean {
  return input.currency === 'PHP' && input.exponent === 2 && PHP_REFERENCE_MINORS.has(input.minor);
}

export type PriceOption = {
  id: string;
  code: string;
  referenceMoney: Money;
  legacyTier: 1 | 2 | 3 | 4 | null;
};
export type PriceRequest = {
  id: string;
  optionId: string;
  referenceMoney: Money;
  acceptedTermsVersion: string;
  requestedAt: string;
};
export type PlatformPricing = {
  platform: StorePlatform;
  environment: VerifiedEnvironment;
  state: 'unconfigured' | 'pending_review' | 'active' | 'change_pending' | 'failed' | 'unavailable';
  effective: PriceRequest | null;
  offerRevision: string | null;
};
export type ListingPricing = {
  listingId: string;
  revision: string;
  requested: PriceRequest | null;
  platforms: PlatformPricing[];
};

export type ListingStatus = 'draft' | 'active' | 'paused' | 'retired';
export type SetupOutcome = 'none' | 'pending_review' | 'change_pending' | 'verified' | 'failed';
export type ReadinessReason = 'not_configured' | 'setup_pending' | 'setup_failed' | 'product_unavailable' | 'version_changed' | 'terms_required' | 'option_disabled';
export type ReadinessSummary = PlatformPricing & {
  effectiveVersionId: string | null; effectiveVersionNo: number | null; matchesCurrentVersion: boolean;
  setupOutcome: SetupOutcome; setupPriceRevisionId: string | null; reason: ReadinessReason | null;
};
export type WorkspacePriceOption = PriceOption & {enabled: boolean; revision: string; displayOrder: number};
export type SellerTerms = {version: string; contentHash: string};
export type SellerAcceptance = SellerTerms & {acceptedAt: string};
export type PricingWorkspace = {
  listingId: string; listingStatus: ListingStatus; currentVersionId: string | null; currentVersionNo: number | null;
  contentApproved: boolean; pricing: ListingPricing; requestedOptionCurrent: boolean; options: WorkspacePriceOption[];
  terms: SellerTerms | null; acceptance: SellerAcceptance | null; salesEnabled: boolean; canRequestPrice: boolean;
  platforms: ReadinessSummary[];
};
export type PricingSummary = {listingId: string; revision: string; requested: PriceRequest | null; platforms: ReadinessSummary[]};
export type PricingSummaries = {items: PricingSummary[]};
export type AdminPricingSummary = PricingSummary & {
  listingTitle: string; listingStatus: ListingStatus; coachId: string; coachDisplayName: string | null;
  requestedOptionCurrent: boolean; setupOutcome: SetupOutcome;
};
export type AdminPricingPage = {items: AdminPricingSummary[]; nextListingId: string | null};
export type AdminProductEnvironment = ReadinessSummary & {revision: string; setupRevision: string; verifiedEvidenceRef: string | null};
export type StoreReviewStatus = 'not_required' | 'pending' | 'approved';
export type ProductSetupAudit = {
  id: string; environment: VerifiedEnvironment; priceRevisionId: string;
  action: 'record_setup' | 'mark_unavailable' | 'confirm_effective_offer'; outcome: SetupOutcome;
  evidenceRef: string; createdAt: string; previousOfferRevision: string | null; offerRevision: string | null;
  readinessRevision: string; setupRevision: string; expectedVersionId: string | null;
  verifiedPhpMoney: Money | null; storePricePointRef: string | null; storeReviewStatus: StoreReviewStatus | null;
};
export type AdminProduct = {
  id: string; listingId: string; sellerId: string; platform: StorePlatform; storeAppId: string;
  storeProductId: string; projectKey: string; providerAppId: string; providerProductId: string; createdAt: string;
  environments: AdminProductEnvironment[]; audit: ProductSetupAudit[];
};
export type AdminProductWorkspace = {
  workspace: PricingWorkspace; configRevision: string; products: AdminProduct[]; canManageProducts: boolean;
  registryRevisions: {projectKey: string; revision: string}[];
};
export type RegisterStoreProductInput = {
  listingId: string; platform: StorePlatform; expectedListingRevision: string; storeAppId: string;
  storeProductId: string; projectKey: string; providerAppId: string; providerProductId: string;
  expectedRegistryRevision: string; evidenceRef: string;
};
type ReadinessInputBase = {
  productId: string; environment: VerifiedEnvironment; expectedListingRevision: string;
  expectedReadinessRevision: string; expectedSetupRevision: string; priceRevisionId: string; evidenceRef: string;
};
export type SetProductReadinessInput = ReadinessInputBase & (
  | {action: 'record_setup'; outcome: 'pending_review' | 'change_pending' | 'failed'}
  | {action: 'mark_unavailable'}
  | {action: 'confirm_effective_offer'; expectedVersionId: string; verifiedPhpMoney: Money; storePricePointRef: string; storeReviewStatus: StoreReviewStatus}
);
export type RegisterStoreProductResult = {productId: string; created: boolean; readinessRevisions: {SANDBOX: string; PRODUCTION: string}};
export type SetProductReadinessResult = {
  productId: string; environment: VerifiedEnvironment; revision: string; setupRevision: string;
  state: PlatformPricing['state']; offerRevision: string | null; setupOutcome: SetupOutcome;
};
export type SetListingPriceInput = {listingId: string; optionId: string; expectedRevision: string};
export type AcceptSellerTermsInput = SellerTerms;
export type PricingErrorCode = 'unauthorized' | 'terms_unavailable' | 'terms_outdated' | 'option_disabled' | 'retired' | 'conflict' | 'operator_permission_required' | 'registry_not_ready' | 'invalid_input' | 'unavailable';

type Parser<T> = (input: unknown) => T;
const invalid = (): never => { throw new Error('Invalid pricing input'); };
const record = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  return input as Record<string, unknown>;
};
function shape<S extends Record<string, Parser<unknown>>>(schema: S, exact = false): Parser<{[K in keyof S]: ReturnType<S[K]>}> {
  return input => {
    const value = record(input);
    if (exact && Object.keys(value).some(key => !Object.prototype.hasOwnProperty.call(schema, key))) return invalid();
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) output[key] = schema[key]!(value[key]);
    return output as {[K in keyof S]: ReturnType<S[K]>};
  };
}
const nullable = <T>(parse: Parser<T>): Parser<T | null> => input => input === null ? null : parse(input);
function array<T>(parse: Parser<T>, max = 100): Parser<T[]> {
  return input => {
    if (!Array.isArray(input) || input.length > max) return invalid();
    return input.map(parse);
  };
}
function enumeration<const T extends readonly string[]>(values: T): Parser<T[number]> {
  return input => typeof input === 'string' && values.includes(input) ? input as T[number] : invalid();
}
const bool: Parser<boolean> = input => typeof input === 'boolean' ? input : invalid();
const text = (max: number, empty = false): Parser<string> => input =>
  typeof input === 'string' && input.length <= max && (empty || input.length > 0) && input.trim() === input && !/[\u0000-\u001f\u007f]/.test(input) ? input : invalid();
const identity = text(255);
const evidence = text(1024);
const uuid: Parser<string> = input => typeof input === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.exec(input)?.[0] === input ? input : invalid();
const hash: Parser<string> = input => typeof input === 'string' && /^[0-9a-f]{64}$/.exec(input)?.[0] === input ? input : invalid();
const timestamp: Parser<string> = input => {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(input) || input.trim() !== input || !Number.isFinite(Date.parse(input))) return invalid();
  return input;
};
const positive: Parser<number> = input => typeof input === 'number' && Number.isSafeInteger(input) && input > 0 && input <= 2147483647 ? input : invalid();
const platform = enumeration(['ios','android']);
const environment = enumeration(['SANDBOX','PRODUCTION']);
const state = enumeration(['unconfigured','pending_review','active','change_pending','failed','unavailable']);
const listingStatus = enumeration(['draft','active','paused','retired']);
const setupOutcome = enumeration(['none','pending_review','change_pending','verified','failed']);
const reason = enumeration(['not_configured','setup_pending','setup_failed','product_unavailable','version_changed','terms_required','option_disabled']);
const reviewStatus = enumeration(['not_required','pending','approved']);
const action = enumeration(['record_setup','mark_unavailable','confirm_effective_offer']);
const moneyInput = shape({currency: identity, exponent: positive, minor: (input: unknown) => parseMoney({currency:'PHP',exponent:2,minor:input}).minor}, true);
const exactMoney: Parser<Money> = input => parseMoney(moneyInput(input));
const selectableMoney: Parser<Money> = input => {
  const value = exactMoney(input);
  return isSupportedReferencePrice(value) ? value : invalid();
};
const tier: Parser<PriceOption['legacyTier']> = input => input === null || input === 1 || input === 2 || input === 3 || input === 4 ? input : invalid();
const optionFields = {id:uuid,code:identity,referenceMoney:parseMoney,legacyTier:tier};
export const parsePriceOption: Parser<PriceOption> = shape(optionFields);
export const parsePriceRequest: Parser<PriceRequest> = shape({id:uuid,optionId:uuid,referenceMoney:parseMoney,acceptedTermsVersion:identity,requestedAt:timestamp});
const platformFields = {platform,environment,state,effective:nullable(parsePriceRequest),offerRevision:nullable(uuid)};
const parsePlatformPricing = shape(platformFields);
const readinessFields = {...platformFields,effectiveVersionId:nullable(uuid),effectiveVersionNo:nullable(positive),matchesCurrentVersion:bool,setupOutcome,setupPriceRevisionId:nullable(uuid),reason:nullable(reason)};
export const parseReadinessSummary: Parser<ReadinessSummary> = shape(readinessFields);
function unique<T>(items: T[], key: (item: T) => string): T[] {
  return new Set(items.map(key)).size === items.length ? items : invalid();
}
function fourPlatforms(input: unknown): ReadinessSummary[] {
  const result = unique(array(parseReadinessSummary,4)(input), row => `${row.platform}:${row.environment}`);
  return result.length === 4 ? result : invalid();
}
export const parseListingPricing: Parser<ListingPricing> = input => {
  const result = shape({listingId:uuid,revision:parseRevision,requested:nullable(parsePriceRequest),platforms:array(parsePlatformPricing,4)})(input);
  unique(result.platforms,row=>`${row.platform}:${row.environment}`);
  return result;
};
export const parseSellerTerms: Parser<SellerTerms> = shape({version:identity,contentHash:hash});
export const parseSellerAcceptance: Parser<SellerAcceptance> = shape({version:identity,contentHash:hash,acceptedAt:timestamp});
const parseWorkspaceOption: Parser<WorkspacePriceOption> = shape({...optionFields,enabled:bool,revision:parseRevision,displayOrder:positive});
export const parsePricingWorkspace: Parser<PricingWorkspace> = input => {
  const value = shape({listingId:uuid,listingStatus,currentVersionId:nullable(uuid),currentVersionNo:nullable(positive),contentApproved:bool,pricing:parseListingPricing,requestedOptionCurrent:bool,options:array(parseWorkspaceOption,45),terms:nullable(parseSellerTerms),acceptance:nullable(parseSellerAcceptance),salesEnabled:bool,canRequestPrice:bool,platforms:fourPlatforms})(input);
  if (value.pricing.listingId !== value.listingId || value.options.length !== 45) return invalid();
  unique(value.options, o=>o.id);
  value.options.forEach((option,i)=>{
    if (option.displayOrder !== i+1 || option.referenceMoney.currency !== 'PHP' || option.referenceMoney.exponent !== 2 || option.referenceMoney.minor !== PHP_REFERENCE_PRICES[i]!.minor) invalid();
  });
  return value;
};
const summaryFields = {listingId:uuid,revision:parseRevision,requested:nullable(parsePriceRequest),platforms:fourPlatforms};
const parseSummary: Parser<PricingSummary> = shape(summaryFields);
export const parsePricingSummaries: Parser<PricingSummaries> = input => {
  const value = shape({items:array(parseSummary)})(input);
  unique(value.items,item=>item.listingId);
  return value;
};
const parseAdminSummary: Parser<AdminPricingSummary> = shape({...summaryFields,listingTitle:text(1024,true),listingStatus,coachId:uuid,coachDisplayName:nullable(text(255,true)),requestedOptionCurrent:bool,setupOutcome});
export const parseAdminPricingPage: Parser<AdminPricingPage> = input => {
  const value = shape({items:array(parseAdminSummary),nextListingId:nullable(uuid)})(input);
  unique(value.items,item=>item.listingId);
  return value;
};
const parseAdminEnvironment: Parser<AdminProductEnvironment> = shape({...readinessFields,revision:parseRevision,setupRevision:parseRevision,verifiedEvidenceRef:nullable(evidence)});
const parseAudit: Parser<ProductSetupAudit> = shape({id:parseRevision,environment,priceRevisionId:uuid,action,outcome:setupOutcome,evidenceRef:evidence,createdAt:timestamp,previousOfferRevision:nullable(uuid),offerRevision:nullable(uuid),readinessRevision:parseRevision,setupRevision:parseRevision,expectedVersionId:nullable(uuid),verifiedPhpMoney:nullable(parseMoney),storePricePointRef:nullable(evidence),storeReviewStatus:nullable(reviewStatus)});
const parseProduct: Parser<AdminProduct> = input => {
  const product = shape({id:uuid,listingId:uuid,sellerId:uuid,platform,storeAppId:identity,storeProductId:identity,projectKey:identity,providerAppId:identity,providerProductId:identity,createdAt:timestamp,environments:array(parseAdminEnvironment,2),audit:array(parseAudit,20)})(input);
  if(product.environments.length !== 2 || product.environments.some(row=>row.platform !== product.platform)) return invalid();
  unique(product.environments,row=>row.environment);
  unique(product.audit,row=>row.id);
  return product;
};
export const parseAdminProductWorkspace: Parser<AdminProductWorkspace> = input => {
  const result = shape({workspace:parsePricingWorkspace,configRevision:parseRevision,products:array(parseProduct,2),canManageProducts:bool,registryRevisions:array(shape({projectKey:identity,revision:parseRevision}))})(input);
  unique(result.products,p=>p.id); unique(result.products,p=>p.platform); unique(result.registryRevisions,r=>r.projectKey);
  if(result.products.some(p=>p.listingId !== result.workspace.listingId)) return invalid();
  return result;
};
export const parseRegisterStoreProductInput: Parser<RegisterStoreProductInput> = shape({listingId:uuid,platform,expectedListingRevision:parseRevision,storeAppId:identity,storeProductId:identity,projectKey:identity,providerAppId:identity,providerProductId:identity,expectedRegistryRevision:parseRevision,evidenceRef:evidence},true);
const commonInput = {productId:uuid,environment,expectedListingRevision:parseRevision,expectedReadinessRevision:parseRevision,expectedSetupRevision:parseRevision,priceRevisionId:uuid,evidenceRef:evidence};
export const parseSetProductReadinessInput: Parser<SetProductReadinessInput> = input => {
  const value = record(input);
  if(value.action === 'record_setup') return shape({...commonInput,action:enumeration(['record_setup']),outcome:enumeration(['pending_review','change_pending','failed'])},true)(input);
  if(value.action === 'mark_unavailable') return shape({...commonInput,action:enumeration(['mark_unavailable'])},true)(input);
  if(value.action === 'confirm_effective_offer') {
    const result = shape({...commonInput,action:enumeration(['confirm_effective_offer']),expectedVersionId:uuid,verifiedPhpMoney:selectableMoney,storePricePointRef:evidence,storeReviewStatus:reviewStatus},true)(input);
    if(result.environment === 'PRODUCTION' && result.storeReviewStatus === 'pending') return invalid();
    return result;
  }
  return invalid();
};
export const parseRegisterStoreProductResult: Parser<RegisterStoreProductResult> = shape({productId:uuid,created:bool,readinessRevisions:shape({SANDBOX:parseRevision,PRODUCTION:parseRevision})});
export const parseSetProductReadinessResult: Parser<SetProductReadinessResult> = shape({productId:uuid,environment,revision:parseRevision,setupRevision:parseRevision,state,offerRevision:nullable(uuid),setupOutcome});
export const parseSetListingPriceInput: Parser<SetListingPriceInput> = shape({listingId:uuid,optionId:uuid,expectedRevision:parseRevision},true);
export const parseAcceptSellerTermsInput: Parser<AcceptSellerTermsInput> = shape({version:identity,contentHash:hash},true);
export const parsePricingErrorCode: Parser<PricingErrorCode> = enumeration(['unauthorized','terms_unavailable','terms_outdated','option_disabled','retired','conflict','operator_permission_required','registry_not_ready','invalid_input','unavailable']);
