"use server";

import { getCoachSession } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseAcceptSellerTermsInput, parseListingPricing, parseSellerAcceptance, parseSetListingPriceInput } from "@/lib/coaching/commerce";
import { coachPricingError, hasCurrentSellerAcceptance, mapCoachPricingError, publishedTermsMatch, validListingId, type CoachPricingResult } from "@/lib/coaching/coach-pricing";
import { readCoachPricing } from "@/lib/coaching/pricing-query";

async function coachDb() {
  const session = await getCoachSession();
  if (!session.user || session.role !== "coach" || session.status !== "approved") return null;
  return createServerSupabase();
}
export async function refreshCoachPricing(listingId: string): Promise<CoachPricingResult> {
  const db = await coachDb();
  if (!db) return {error:coachPricingError("unauthorized")};
  if (!validListingId(listingId)) return {error:coachPricingError("invalid_input")};
  return readCoachPricing(db,listingId);
}
export async function saveCoachPrice(input: unknown): Promise<CoachPricingResult> {
  const db = await coachDb();
  if (!db) return {error:coachPricingError("unauthorized")};
  let value;
  try { value = parseSetListingPriceInput(input); } catch { return {error:coachPricingError("invalid_input")}; }
  const current = await readCoachPricing(db,value.listingId);
  if (!current.data) return current;
  const {workspace} = current.data;
  const fail = (code: Parameters<typeof coachPricingError>[0]) => ({...current,error:coachPricingError(code)});
  if (workspace.listingStatus === "retired") return fail("retired");
  if (!workspace.terms || !current.data.terms || current.data.termsError) return fail("terms_unavailable");
  if (!hasCurrentSellerAcceptance(workspace)) return fail("terms_outdated");
  if (workspace.pricing.revision !== value.expectedRevision) return fail("conflict");
  const option = workspace.options.find(o=>o.id === value.optionId);
  if (!option?.enabled || !workspace.canRequestPrice) return fail("option_disabled");
  try {
    const result = await db.rpc("set_coaching_listing_price",{p_listing_id:value.listingId,p_option_id:value.optionId,p_expected_revision:value.expectedRevision});
    if (result.error) return {...await readCoachPricing(db,value.listingId),error:mapCoachPricingError(result.error)};
    const pricing = parseListingPricing(result.data);
    if (pricing.listingId !== value.listingId) return fail("unavailable");
    return {...await readCoachPricing(db,value.listingId),mutationApplied:true};
  } catch { return fail("unavailable"); }
}
export async function acceptCoachSellerTerms(listingId: string, input: unknown, accepted: boolean): Promise<CoachPricingResult> {
  const db = await coachDb();
  if (!db) return {error:coachPricingError("unauthorized")};
  let value;
  try {
    value = parseAcceptSellerTermsInput(input);
    if (!validListingId(listingId) || accepted !== true) throw new Error("Invalid acceptance");
  } catch { return {error:coachPricingError("invalid_input")}; }
  const current = await readCoachPricing(db,listingId);
  if (!current.data) return current;
  const fail = (code: Parameters<typeof coachPricingError>[0]) => ({...current,error:coachPricingError(code)});
  if (!current.data.terms || current.data.termsError || !publishedTermsMatch(current.data)) return fail("terms_unavailable");
  if (value.version !== current.data.terms.version || value.contentHash !== current.data.terms.contentHash) return fail("terms_outdated");
  try {
    const result = await db.rpc("accept_coaching_seller_terms",{p_version:value.version,p_content_hash:value.contentHash});
    if (result.error) return {...await readCoachPricing(db,listingId),error:mapCoachPricingError(result.error)};
    const acceptance = parseSellerAcceptance(result.data);
    if (acceptance.version !== value.version || acceptance.contentHash !== value.contentHash) return fail("unavailable");
    return {...await readCoachPricing(db,listingId),mutationApplied:true};
  } catch { return fail("unavailable"); }
}
