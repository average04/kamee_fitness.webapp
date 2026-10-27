"use server";

import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { parseAdminPricingPage, parseAdminProductWorkspace, parseRegisterStoreProductInput, parseRegisterStoreProductResult, parseSetProductReadinessInput, parseSetProductReadinessResult, parseRevision, parseSellerTerms } from "@/lib/coaching/commerce";
import { adminCommerceError, mapAdminCommerceError, parseAdminOptionInput, parseAdminTermsInput, parseAdminTermsReview, validAdminUuid, type AdminCommerceResult } from "@/lib/coaching/commerce-admin";

type Db=ReturnType<typeof createAdminSupabase>;
async function readWorkspace(db:Db,actorId:string,listingId:string):Promise<AdminCommerceResult> {
  try {
    const result=await db.rpc("admin_get_coaching_product_workspace",{p_actor_id:actorId,p_listing_id:listingId});
    if(result.error) return {error:mapAdminCommerceError(result.error)};
    const data=parseAdminProductWorkspace(result.data);
    if(data.workspace.listingId!==listingId) throw new Error("Invalid listing");
    return {data};
  } catch {return {error:adminCommerceError("unavailable")};}
}
async function afterMutation(db:Db,actorId:string,listingId:string,error?:{message?:string;code?:string}):Promise<AdminCommerceResult> {
  const refreshed=await readWorkspace(db,actorId,listingId);
  return error?{...refreshed,error:mapAdminCommerceError(error)}:{...refreshed,mutationApplied:true};
}
export async function listAdminPricing(afterListingId:string|null=null):Promise<AdminCommerceResult> {
  const actor=await requireAdmin();
  if(afterListingId!==null && !validAdminUuid(afterListingId)) return {error:adminCommerceError("invalid_input")};
  try {
    const db=createAdminSupabase();
    const result=await db.rpc("admin_list_coaching_pricing",{p_actor_id:actor.id,p_after_listing_id:afterListingId,p_limit:25});
    if(result.error) return {error:mapAdminCommerceError(result.error)};
    return {page:parseAdminPricingPage(result.data)};
  } catch {return {error:adminCommerceError("unavailable")};}
}
export async function refreshAdminProductWorkspace(listingId:string):Promise<AdminCommerceResult> {
  const actor=await requireAdmin();
  if(!validAdminUuid(listingId)) return {error:adminCommerceError("invalid_input")};
  try {return await readWorkspace(createAdminSupabase(),actor.id,listingId);}catch{return {error:adminCommerceError("unavailable")};}
}
export async function registerAdminStoreProduct(input:unknown):Promise<AdminCommerceResult> {
  const actor=await requireAdmin();
  let value;
  try {value=parseRegisterStoreProductInput(input);}catch{return {error:adminCommerceError("invalid_input")};}
  try {
    const db=createAdminSupabase(),current=await readWorkspace(db,actor.id,value.listingId);
    if(!current.data) return current;
    const fail=(code:Parameters<typeof adminCommerceError>[0])=>({...current,error:adminCommerceError(code)});
    if(!current.data.canManageProducts) return fail("operator_permission_required");
    if(current.data.workspace.pricing.revision!==value.expectedListingRevision) return fail("conflict");
    const registry=current.data.registryRevisions.find(r=>r.projectKey===value.projectKey);
    if(!registry) return fail("registry_not_ready");
    if(registry.revision!==value.expectedRegistryRevision) return fail("conflict");
    const result=await db.rpc("admin_register_coaching_store_product",{p_actor_id:actor.id,p_input:value});
    if(result.error) return afterMutation(db,actor.id,value.listingId,result.error);
    parseRegisterStoreProductResult(result.data);
    return afterMutation(db,actor.id,value.listingId);
  } catch {return {error:adminCommerceError("unavailable")};}
}
export async function setAdminProductReadiness(listingId:string,input:unknown):Promise<AdminCommerceResult> {
  const actor=await requireAdmin();
  let value;
  try {if(!validAdminUuid(listingId)) throw new Error();value=parseSetProductReadinessInput(input);}catch{return {error:adminCommerceError("invalid_input")};}
  try {
    const db=createAdminSupabase(),current=await readWorkspace(db,actor.id,listingId);
    if(!current.data) return current;
    const fail=(code:Parameters<typeof adminCommerceError>[0])=>({...current,error:adminCommerceError(code)});
    if(!current.data.canManageProducts) return fail("operator_permission_required");
    const workspace=current.data.workspace, product=current.data.products.find(p=>p.id===value.productId), row=product?.environments.find(r=>r.environment===value.environment);
    if(!row) return fail("invalid_input");
    if(workspace.pricing.revision!==value.expectedListingRevision || row.revision!==value.expectedReadinessRevision || row.setupRevision!==value.expectedSetupRevision || workspace.pricing.requested?.id!==value.priceRevisionId) return fail("conflict");
    if(value.action==="confirm_effective_offer" && (workspace.currentVersionId!==value.expectedVersionId || workspace.pricing.requested.referenceMoney.minor!==value.verifiedPhpMoney.minor || !workspace.contentApproved)) return fail("conflict");
    const result=await db.rpc("admin_set_coaching_product_readiness",{p_actor_id:actor.id,p_input:value});
    if(result.error) return afterMutation(db,actor.id,listingId,result.error);
    const changed=parseSetProductReadinessResult(result.data);
    if(changed.productId!==value.productId || changed.environment!==value.environment) throw new Error("Invalid result");
    return afterMutation(db,actor.id,listingId);
  }catch{return {error:adminCommerceError("unavailable")};}
}
export async function setAdminPriceOption(listingId:string,input:unknown):Promise<AdminCommerceResult> {
  const actor=await requireAdmin();
  let value;
  try {if(!validAdminUuid(listingId)) throw new Error();value=parseAdminOptionInput(input);}catch{return {error:adminCommerceError("invalid_input")};}
  try {
    const db=createAdminSupabase(),current=await readWorkspace(db,actor.id,listingId);
    if(!current.data) return current;
    const option=current.data.workspace.options.find(o=>o.id===value.optionId);
    if(!option || option.legacyTier!==value.legacyTier) return {...current,error:adminCommerceError("invalid_input")};
    if(option.revision!==value.expectedRevision) return {...current,error:adminCommerceError("conflict")};
    const result=await db.rpc("admin_set_coaching_price_option",{p_actor_id:actor.id,p_option_id:value.optionId,p_enabled:value.enabled,p_legacy_tier:option.legacyTier,p_expected_revision:value.expectedRevision});
    if(result.error) return afterMutation(db,actor.id,listingId,result.error);
    const returned=result.data as Record<string,unknown>|null;
    if(!returned || returned.optionId!==value.optionId || returned.enabled!==value.enabled || returned.legacyTier!==option.legacyTier) throw new Error("Invalid result");
    parseRevision(returned.revision);
    return afterMutation(db,actor.id,listingId);
  }catch{return {error:adminCommerceError("unavailable")};}
}
export async function prepareAdminSellerTerms(input:unknown):Promise<AdminCommerceResult> {
  await requireAdmin();
  try {
    const value=parseAdminTermsInput(input);
    return {termsReview:{...value,contentHash:createHash("sha256").update(value.body,"utf8").digest("hex")}};
  }catch{return {error:adminCommerceError("invalid_input")};}
}
export async function publishAdminSellerTerms(listingId:string,input:unknown):Promise<AdminCommerceResult> {
  const actor=await requireAdmin();
  let value;
  try {
    if(!validAdminUuid(listingId)) throw new Error();value=parseAdminTermsReview(input);
    if(createHash("sha256").update(value.body,"utf8").digest("hex")!==value.contentHash) throw new Error();
  }catch{return {error:adminCommerceError("invalid_input")};}
  try {
    const db=createAdminSupabase(),current=await readWorkspace(db,actor.id,listingId);
    if(!current.data) return current;
    if(current.data.configRevision!==value.expectedRevision) return {...current,error:adminCommerceError("conflict")};
    const result=await db.rpc("admin_publish_coaching_seller_terms",{p_actor_id:actor.id,p_version:value.version,p_body:value.body,p_expected_revision:value.expectedRevision});
    if(result.error) return afterMutation(db,actor.id,listingId,result.error);
    const terms=parseSellerTerms(result.data);
    if(terms.version!==value.version || terms.contentHash!==value.contentHash) throw new Error("Invalid terms result");
    parseRevision((result.data as Record<string,unknown>).revision);
    return afterMutation(db,actor.id,listingId);
  }catch{return {error:adminCommerceError("unavailable")};}
}
