// Generated from src/lib/coaching/commerceTypes.ts; run the app sync-coaching-conversation-client script. Do not edit.
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

export type BeginCheckoutInput = {
  listingId: string;
  platform: StorePlatform;
  expectedVersionId: string;
  expectedOfferRevision: string;
  intent?: 'buy' | 'buy_after_test';
};
export type PurchaseAccess =
  | {
      state: 'unowned';
      versionId: string;
      productId: string;
      priceRevisionId: string;
      offerRevision: string;
    }
  | { state: 'pending'; orderId: string; platform: StorePlatform; paymentState: 'open' | 'pending' }
  | {
      state: 'owned';
      ownershipId: string;
      grantingOrderId: string;
      versionId: string;
      userPlanId: string | null;
      enrollmentAttemptId: string | null;
      environment: VerifiedEnvironment;
    }
  | {
      state: 'revoked';
      ownershipId: string;
      grantingOrderId: string;
      environment: VerifiedEnvironment;
    }
  | { state: 'unavailable'; reason: string };
export type BeginCheckout = {
  orderId: string;
  listingId: string;
  versionId: string;
  productId: string;
  priceRevisionId: string;
  offerRevision: string;
  platform: StorePlatform;
};
export type BeginCheckoutResult =
  | { state: 'ready'; checkout: BeginCheckout }
  | Extract<PurchaseAccess, { state: 'owned' | 'pending' }>;
export type ListingAccess = { listingId: string; access: PurchaseAccess };
export type EnrollmentInput = {
  ownershipId: string;
  expectedVersionId: string;
  idempotencyKey: string;
  startDate: string;
  weekdays: number[];
  longRunWeekday?: number | null;
  preferredTime: string | null;
  timezone: string;
};
export type EnrollmentResult = {
  ownershipId: string;
  enrollmentAttemptId: string;
  userPlanId: string;
  versionId: string;
};
export type CommerceErrorCode =
  | 'sales_disabled'
  | 'product_unavailable'
  | 'pending_other_store'
  | 'offer_changed'
  | 'identity_conflict'
  | 'needs_recovery'
  | 'version_unavailable'
  | 'access_revoked'
  | 'revision_conflict'
  | 'processing_uncertain'
  | 'rate_limited';
export type CommerceError =
  | {
      code: 'pending_other_store';
      orderId: string;
      platform: StorePlatform;
      retryAfter: string | null;
    }
  | { code: 'offer_changed'; listingId: string; versionId: string; offerRevision: string }
  | { code: Exclude<CommerceErrorCode, 'pending_other_store' | 'offer_changed'> };
export type CancelCheckoutResult =
  | { state: 'cancelled'; orderId: string }
  | { state: 'pending'; orderId: string; platform: StorePlatform }
  | Extract<PurchaseAccess, { state: 'owned' | 'revoked' | 'unavailable' }>;
export type SafeRecovery = { recoveryId: string; code: 'needs_recovery' | 'processing_uncertain' };
export type PurchaseResolution = {
  access: ListingAccess[];
  verification: 'complete' | 'pending' | 'needs_recovery';
  recovery: SafeRecovery[];
};
