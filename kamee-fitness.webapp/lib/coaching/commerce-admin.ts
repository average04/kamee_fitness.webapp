import { parseRevision, type AdminPricingPage, type AdminProductWorkspace, type Money, type PricingErrorCode } from "./commerce";

export type AdminCommerceError = {code: PricingErrorCode; message: string};
export type TermsReview = {version:string; body:string; expectedRevision:string; reason:string; contentHash:string};
export type AdminCommerceResult = {data?:AdminProductWorkspace; page?:AdminPricingPage; error?:AdminCommerceError; mutationApplied?:boolean; termsReview?:TermsReview};
export type AdminCommerceActions = {
  refresh:(listingId:string)=>Promise<AdminCommerceResult>;
  register:(input:unknown)=>Promise<AdminCommerceResult>;
  readiness:(listingId:string,input:unknown)=>Promise<AdminCommerceResult>;
  option:(listingId:string,input:unknown)=>Promise<AdminCommerceResult>;
  prepareTerms:(input:unknown)=>Promise<AdminCommerceResult>;
  publishTerms:(listingId:string,input:unknown)=>Promise<AdminCommerceResult>;
};
const messages:Record<PricingErrorCode,string> = {
  unauthorized:"Admin sign-in is required. Sign in again to continue.",
  terms_unavailable:"Commercial terms have not been published.",
  terms_outdated:"Commercial terms changed. Refresh and review the current version.",
  option_disabled:"This reference price is disabled.",
  retired:"This listing is retired.",
  conflict:"Values changed. Review the refreshed data and prepare a new summary before submitting again.",
  operator_permission_required:"Product setup is read-only. This account lacks the required database admin capability.",
  registry_not_ready:"The provider registry is not ready. Review it through the separate release procedure.",
  invalid_input:"Check the required fields, exact PHP mapping and expected revisions.",
  unavailable:"Product readiness is unavailable. The required server RPCs may not be deployed. Refresh before retrying; no success is assumed.",
};
export function adminCommerceError(code:PricingErrorCode):AdminCommerceError{return {code,message:messages[code]};}
export function mapAdminCommerceError(error:{message?:string;code?:string}):AdminCommerceError {
  if(error.message==="revision_conflict" || error.message==="conflict") return adminCommerceError("conflict");
  if(error.message==="exact_registry_required" || error.message==="registry_changed") return adminCommerceError("registry_not_ready");
  if(error.code==="42501") return adminCommerceError("operator_permission_required");
  if(error.code==="22023") return adminCommerceError("invalid_input");
  return adminCommerceError(error.message && Object.hasOwn(messages,error.message)?error.message as PricingErrorCode:"unavailable");
}
export function validAdminUuid(input:unknown):input is string {
  return typeof input==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.exec(input)?.[0]===input;
}
function exact(input:unknown,keys:string[]):Record<string,unknown> {
  if(!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).length!==keys.length || Object.keys(input).some(k=>!keys.includes(k))) throw new Error("Invalid input");
  return input as Record<string,unknown>;
}
function shortText(input:unknown,max:number):string {
  if(typeof input!=="string" || input.trim()!==input || !input || input.length>max || /[\u0000-\u001f\u007f]/.test(input)) throw new Error("Invalid input");
  return input;
}
export type AdminOptionInput = {optionId:string;enabled:boolean;legacyTier:1|2|3|4|null;expectedRevision:string;reason:string};
export function parseAdminOptionInput(input:unknown):AdminOptionInput {
  const v=exact(input,["optionId","enabled","legacyTier","expectedRevision","reason"]);
  if(!validAdminUuid(v.optionId) || typeof v.enabled!=="boolean" || ![null,1,2,3,4].includes(v.legacyTier as number|null)) throw new Error("Invalid input");
  return {optionId:v.optionId,enabled:v.enabled,legacyTier:v.legacyTier as AdminOptionInput["legacyTier"],expectedRevision:parseRevision(v.expectedRevision),reason:shortText(v.reason,1024)};
}
export type AdminTermsInput = {version:string;body:string;expectedRevision:string;reason:string};
export function parseAdminTermsInput(input:unknown):AdminTermsInput {
  const v=exact(input,["version","body","expectedRevision","reason"]);
  if(typeof v.body!=="string" || !v.body.trim() || v.body.length>100000 || v.body.includes("\u0000")) throw new Error("Invalid input");
  return {version:shortText(v.version,80),body:v.body,expectedRevision:parseRevision(v.expectedRevision),reason:shortText(v.reason,1024)};
}
export function parseAdminTermsReview(input:unknown):TermsReview {
  const v=exact(input,["version","body","expectedRevision","reason","contentHash"]);
  const {contentHash,...rest}=v;
  if(typeof contentHash!=="string" || !/^[0-9a-f]{64}$/.test(contentHash)) throw new Error("Invalid input");
  return {...parseAdminTermsInput(rest),contentHash};
}
export function formatAdminMoney(money:Money):string {
  const value=BigInt(money.minor), negative=value<BigInt(0), abs=negative?-value:value;
  const fraction=(abs%BigInt(100)).toString().padStart(2,"0");
  return `PHP ${negative?"−":""}${(abs/BigInt(100)).toLocaleString("en-PH")}${fraction==="00"?"":`.${fraction}`}`;
}
/** Synchronous lock covers rapid submits before React has rendered pending state. */
export function createExclusiveRunner() {
  let running=false;
  return async <T>(task:()=>Promise<T>):Promise<T|undefined> => {
    if(running) return undefined;
    running=true;
    try{return await task();}finally{running=false;}
  };
}
