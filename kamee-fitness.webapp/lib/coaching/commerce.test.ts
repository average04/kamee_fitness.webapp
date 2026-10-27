import {describe,it,expect} from 'vitest';
import {
  parsePricingWorkspace, parsePricingSummaries, parseAdminPricingPage,
  parseAdminProductWorkspace, parseRegisterStoreProductInput, parseSetProductReadinessInput,
  parseRegisterStoreProductResult, parseSetProductReadinessResult, parseSetListingPriceInput,
  parseAcceptSellerTermsInput, parsePricingErrorCode, parseReadinessSummary,
} from './commerce';

const id = '10000000-0000-0000-0000-000000000001';
const requestId = '10000000-0000-0000-0000-000000000002';
const offerId = '10000000-0000-0000-0000-000000000003';
const at = '2026-10-27T00:00:00Z';
const hash = 'a'.repeat(64);
const request = {id:requestId, optionId:id, referenceMoney:{currency:'PHP',exponent:2,minor:'25000'}, acceptedTermsVersion:'v1', requestedAt:at};
const row = {platform:'ios',environment:'SANDBOX',state:'active', effective:request,offerRevision:offerId,effectiveVersionId:id,effectiveVersionNo:1,matchesCurrentVersion:true,setupOutcome:'failed',setupPriceRevisionId:requestId,reason:null};
const platforms = ['ios','android'].flatMap(platform => ['SANDBOX','PRODUCTION'].map(environment => ({...row,platform,environment})));
const minors = ['20000','30000','40000','50000','60000','70000','80000','90000','100000','110000','120000','130000','140000','150000','160000','170000','180000','190000','200000','250000','300000','350000','400000','450000','500000','550000','600000','650000','700000','750000','800000','850000','900000','950000','1000000','1100000','1200000','1300000','1400000','1500000','1600000','1700000','1800000','1900000','2000000'];
function workspace() {
  return {listingId:id,listingStatus:'active',currentVersionId:id,currentVersionNo:1,contentApproved:true,pricing:{listingId:id,revision:'9007199254740993',requested:request,platforms:platforms.map(({platform,environment,state,effective,offerRevision}) => ({platform,environment,state,effective,offerRevision}))},requestedOptionCurrent:false,options:minors.map((minor,i)=>({id:`20000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`,code:`PHP${minor}`,referenceMoney:{currency:'PHP',exponent:2,minor},legacyTier:null,enabled:false,revision:'0',displayOrder:i+1})),terms:{version:'v1',contentHash:hash},acceptance:{version:'v1',contentHash:hash,acceptedAt:at},salesEnabled:false,canRequestPrice:false,platforms};
}
const registration = {listingId:id,platform:'ios',expectedListingRevision:'1',storeAppId:'app',storeProductId:'product',projectKey:'coaching',providerAppId:'provider-app',providerProductId:'provider-product',expectedRegistryRevision:'1',evidenceRef:'console:123'};
const common = {productId:id,environment:'SANDBOX',expectedListingRevision:'1',expectedReadinessRevision:'0',expectedSetupRevision:'9007199254740993',priceRevisionId:requestId,evidenceRef:'console:456'};

describe('pricing workspace boundary', () => {
  it('preserves historical prices, request UUIDs, precise CAS, and failed setup beside a valid old offer', () => {
    const result = parsePricingWorkspace(workspace());
    expect(result.pricing.revision).toBe('9007199254740993');
    expect(result.pricing.requested?.referenceMoney.minor).toBe('25000');
    expect(result.requestedOptionCurrent).toBe(false);
    expect(result.platforms[0]).toMatchObject({state:'active',reason:null,setupOutcome:'failed',offerRevision:offerId,setupPriceRevisionId:requestId});
  });
  it('rejects incomplete, duplicate, reordered or non-current choices and missing platform rows', () => {
    const w = workspace();
    for (const invalid of [ {...w,options:w.options.slice(1)}, {...w,options:[w.options[1],w.options[0],...w.options.slice(2)]}, {...w,options:w.options.map((o,i)=> i===0?{...o,referenceMoney:request.referenceMoney}:o)}, {...w,platforms:platforms.slice(1)}, {...w,platforms:[platforms[0],platforms[0],...platforms.slice(2)]} ]) expect(()=>parsePricingWorkspace(invalid)).toThrow();
  });
  it.each([null, {}, { ...workspace(),requestedOptionCurrent:'false' },{...workspace(),currentVersionNo:'1'}, {...workspace(),currentVersionId:'version'}, {...workspace(),pricing:{...workspace().pricing,revision:'01'}}])('rejects malformed snapshots %p', input => expect(()=>parsePricingWorkspace(input)).toThrow());
  it('does not conflate numeric revisions with immutable offer or request UUIDs', () => {
    expect(()=>parseReadinessSummary({...row,offerRevision:'1'})).toThrow();
    expect(()=>parseReadinessSummary({...row,setupPriceRevisionId:'1'})).toThrow();
    expect(()=>parseReadinessSummary({...row,effective:{...request,id:'1'}})).toThrow();
  });
  it('parses coherent bounded card summaries and admin keyset pages', () => {
    const summary = {listingId:id,revision:'1',requested:request,platforms};
    expect(parsePricingSummaries({items:[summary]}).items[0]!.requested?.id).toBe(requestId);
    const admin = {...summary,listingTitle:'A plan',listingStatus:'active',coachId:id,coachDisplayName:null,requestedOptionCurrent:false,setupOutcome:'failed'};
    expect(parseAdminPricingPage({items:[admin],nextListingId:id}).nextListingId).toBe(id);
    expect(()=>parsePricingSummaries({items:Array(101).fill(summary)})).toThrow();
    expect(()=>parsePricingSummaries({items:[summary,summary]})).toThrow();
  });
  it('parses admin immutable identities, environment revisions, evidence, and audit bounds', () => {
    const product = {id,listingId:id,sellerId:id,platform:'ios',storeAppId:'app',storeProductId:'product',projectKey:'coaching',providerAppId:'pa',providerProductId:'pp',createdAt:at,environments:platforms.slice(0,2).map(r=>({...r,revision:'3',setupRevision:'99',verifiedEvidenceRef:'console:old'})),audit:[]};
    const admin = {workspace:workspace(),configRevision:'1',products:[product],canManageProducts:false,registryRevisions:[{projectKey:'coaching',revision:'4'}]};
    expect(parseAdminProductWorkspace(admin).products[0]!.environments[0]!.setupRevision).toBe('99');
    expect(()=>parseAdminProductWorkspace({...admin,products:[{...product,environments:[product.environments[0]]}]})).toThrow();
    expect(()=>parseAdminProductWorkspace({...admin,products:[{...product,audit:Array(21).fill({})}]})).toThrow();
  });
});

describe('operator mutation boundary', () => {
  it('accepts exact registration fields without actor identity', () => {
    expect(parseRegisterStoreProductInput(registration).expectedRegistryRevision).toBe('1');
    for(const patch of [{actorId:id},{expectedRegistryRevision:'1\n'},{listingId:'x'},{evidenceRef:''},{evidenceRef:' x'},{providerProductId:'p '},{evidenceRef:'a'.repeat(1025)}]) expect(()=>parseRegisterStoreProductInput({...registration,...patch})).toThrow();
  });
  it('validates action-specific fields and exact money, including production review status', () => {
    expect(parseSetProductReadinessInput({...common,action:'record_setup',outcome:'failed'}).action).toBe('record_setup');
    expect(parseSetProductReadinessInput({...common,action:'mark_unavailable'}).action).toBe('mark_unavailable');
    const confirm = {...common,action:'confirm_effective_offer',expectedVersionId:id,verifiedPhpMoney:{currency:'PHP',exponent:2,minor:'20000'},storePricePointRef:'apple:point',storeReviewStatus:'approved'};
    expect(parseSetProductReadinessInput(confirm).expectedSetupRevision).toBe('9007199254740993');
    for(const input of [{...common,action:'record_setup',outcome:'verified'}, {...common,action:'mark_unavailable',outcome:'failed'}, {...confirm,environment:'PRODUCTION',storeReviewStatus:'pending'}, {...confirm,verifiedPhpMoney:request.referenceMoney}, {...confirm,expectedVersionId:undefined}, {...confirm,expectedSetupRevision:'9223372036854775808'}]) expect(()=>parseSetProductReadinessInput(input)).toThrow();
  });
  it('validates result UUIDs and independent readiness/setup revisions', () => {
    expect(parseRegisterStoreProductResult({productId:id,created:false,readinessRevisions:{SANDBOX:'0',PRODUCTION:'2'}}).created).toBe(false);
    expect(parseSetProductReadinessResult({productId:id,environment:'SANDBOX',revision:'2',setupRevision:'999',state:'active',offerRevision:offerId,setupOutcome:'failed'}).setupRevision).toBe('999');
    expect(()=>parseSetProductReadinessResult({productId:id,environment:'SANDBOX',revision:2,setupRevision:'999',state:'active',offerRevision:offerId,setupOutcome:'failed'})).toThrow();
  });
  it('validates coach inputs and the shared safe error union', () => {
    expect(parseSetListingPriceInput({listingId:id,optionId:id,expectedRevision:'0'}).expectedRevision).toBe('0');
    expect(parseAcceptSellerTermsInput({version:'v1',contentHash:hash}).contentHash).toBe(hash);
    expect(()=>parseAcceptSellerTermsInput({version:'v1',contentHash:hash+'\n'})).toThrow();
    expect(parsePricingErrorCode('conflict')).toBe('conflict');
    expect(()=>parsePricingErrorCode('SQL: secret')).toThrow();
  });
});

import {
  PHP_REFERENCE_PRICES,
  isSupportedReferencePrice,
  parseMoney,
  parseRevision,
} from './commerce';
import type { Money } from './commerce';

describe('money_boundary', () => {
  // Catch Number conversion, narrowing the valid range, or rejecting generic financial values.
  it.each(['0', '-1', '9007199254740993', '-9223372036854775808', '9223372036854775807'])(
    'preserves and JSON-serializes the exact minor string %s',
    (minor) => {
      const money = parseMoney({ currency: 'PHP', exponent: 2, minor });
      expect(money).toEqual({ currency: 'PHP', exponent: 2, minor });
      expect(JSON.parse(JSON.stringify(money))).toEqual({ currency: 'PHP', exponent: 2, minor });
    },
  );

  // Catch accepting malformed wire objects, guessed currency exponents, or noncanonical money.
  it.each([
    null,
    undefined,
    [],
    ['PHP', 2, '25000'],
    '25000',
    25000,
    {},
    { exponent: 2, minor: '25000' },
    { currency: 'PHP', minor: '25000' },
    { currency: 'PHP', exponent: 2 },
    { currency: 'PHP', exponent: 2, minor: 25000 },
    { currency: 'PHP', exponent: 2, minor: BigInt('25000') },
    { currency: 'USD', exponent: 2, minor: '25000' },
    { currency: 'php', exponent: 2, minor: '25000' },
    { currency: '__proto__', exponent: 2, minor: '25000' },
    { currency: 1, exponent: 2, minor: '25000' },
    { currency: 'PHP', exponent: 0, minor: '25000' },
    { currency: 'PHP', exponent: '2', minor: '25000' },
  ])('rejects an invalid money wire object: %p', (input) => {
    expect(() => parseMoney(input)).toThrow();
  });

  it.each([
    '-9223372036854775809',
    '9223372036854775808',
    '007',
    '-0',
    '+5',
    '',
    ' ',
    ' 5',
    '5 ',
    '\t5',
    '5\t',
    '5\n',
    '5\r\n',
    '5\r',
    '5\u2028',
    '5\u2029',
    '2.5',
    '1e3',
    '１',
    '١',
  ])('rejects noncanonical or overflowing minor string %p', (minor) => {
    expect(() => parseMoney({ currency: 'PHP', exponent: 2, minor })).toThrow();
  });
});

describe('reference_catalogue', () => {
  it('exposes the exact ordered 45 current PHP reference choices', () => {
    expect(PHP_REFERENCE_PRICES.map(m => m.minor)).toEqual([
      '20000','30000','40000','50000','60000','70000','80000','90000','100000',
      '110000','120000','130000','140000','150000','160000','170000','180000','190000','200000',
      '250000','300000','350000','400000','450000','500000','550000','600000','650000',
      '700000','750000','800000','850000','900000','950000','1000000',
      '1100000','1200000','1300000','1400000','1500000','1600000','1700000','1800000','1900000','2000000',
    ]);
    for (const money of PHP_REFERENCE_PRICES) expect(isSupportedReferencePrice(money)).toBe(true);
  });
  it('keeps retired reference money readable while rejecting it for new selection', () => {
    for (const minor of ['25000','35000','210000','220000','290000']) {
      const money = parseMoney({currency:'PHP', exponent:2, minor});
      expect(money.minor).toBe(minor);
      expect(isSupportedReferencePrice(money)).toBe(false);
    }
  });

  // Catch treating valid generic money, nearby amounts, or another currency as a selling choice.
  it.each<Money>([
    { currency: 'PHP', exponent: 2, minor: '0' },
    { currency: 'PHP', exponent: 2, minor: '-1' },
    { currency: 'PHP', exponent: 2, minor: '24999' },
    { currency: 'PHP', exponent: 2, minor: '95000' },
    { currency: 'PHP', exponent: 2, minor: '300001' },
    { currency: 'PHP', exponent: 2, minor: '-9223372036854775808' },
    { currency: 'PHP', exponent: 2, minor: '9223372036854775807' },
    { currency: 'PHP', exponent: 2, minor: '025000' },
    { currency: 'PHP', exponent: 0, minor: '25000' },
    { currency: 'USD', exponent: 2, minor: '25000' },
  ])('rejects unsupported reference money %p', (money) => {
    expect(isSupportedReferencePrice(money)).toBe(false);
  });
});

describe('revision_boundary', () => {
  // Catch loss of revision precision or rejecting the nonnegative bigint endpoints.
  it.each(['0', '1', '9007199254740993', '9223372036854775807'])(
    'preserves canonical revision %s',
    (revision) => expect(parseRevision(revision)).toBe(revision),
  );

  // Catch numeric, negative, noncanonical, terminal-line-break, or overflowing revisions.
  it.each([
    null,
    undefined,
    [],
    {},
    0,
    BigInt('1'),
    '-1',
    '-9223372036854775808',
    '9223372036854775808',
    '007',
    '-0',
    '+5',
    '',
    ' ',
    ' 5',
    '5 ',
    '\t5',
    '5\t',
    '5\n',
    '5\r\n',
    '5\r',
    '5\u2028',
    '5\u2029',
    '2.5',
    '1e3',
    '１',
    '١',
  ])('rejects invalid revision %p', (input) => {
    expect(() => parseRevision(input)).toThrow();
  });
});

