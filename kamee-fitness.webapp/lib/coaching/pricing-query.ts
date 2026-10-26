import "server-only";
import { getCoachSession, requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { groupLatestDashboardPlans, type DashboardPlan } from "./dashboard";
import { parsePricingSummaries, parsePricingWorkspace, type PricingSummary } from "./commerce";
import { coachPricingError, mapCoachPricingError, parsePublishedSellerTerms, publishedTermsMatch, validListingId, type CoachPricingResult } from "./coach-pricing";

type CoachDb = Awaited<ReturnType<typeof createServerSupabase>>;
/** Both reads use the caller's cookie-bound client; the workspace RPC enforces listing ownership. */
export async function readCoachPricing(db: CoachDb, listingId: string): Promise<CoachPricingResult> {
  try {
    const [workspace, terms] = await Promise.all([
      db.rpc("get_coaching_pricing_workspace", {p_listing_id:listingId}),
      db.rpc("get_coaching_seller_terms"),
    ]);
    if (workspace.error) return {error:mapCoachPricingError(workspace.error)};
    const parsed = parsePricingWorkspace(workspace.data);
    if (parsed.listingId !== listingId) return {error:coachPricingError("unavailable")};
    let published = null;
    let termsError = Boolean(terms.error);
    if (!terms.error) {
      try { published = parsePublishedSellerTerms(terms.data); } catch { termsError = true; }
    }
    const data = {workspace:parsed,terms:published,termsError};
    if (parsed.terms && !publishedTermsMatch(data)) return {data:{...data,terms:null,termsError:true}};
    return {data};
  } catch { return {error:coachPricingError("unavailable")}; }
}
export async function loadCoachPricing(listingId: string): Promise<CoachPricingResult> {
  const session = await getCoachSession();
  if (!session.user || session.role !== "coach" || session.status !== "approved") return {error:coachPricingError("unauthorized")};
  if (!validListingId(listingId)) return {error:coachPricingError("invalid_input")};
  return readCoachPricing(await createServerSupabase(),listingId);
}
/** One card per listing, using its newest version; each summary request is bounded to 100 IDs. */
export async function loadCoachPlanList() {
  const {user,status} = await requireCoach();
  if (status !== "approved") return {canManagePlans:false,plans:[] as DashboardPlan[],requests:[],summaries:[] as PricingSummary[],pricingError:false};
  const db = await createServerSupabase();
  const [plans, requests] = await Promise.all([
    db.from("plans").select("id,listing_id,title,version_no,version_state,discipline,weeks_count,updated_at").eq("author_id",user.id).eq("kind","coach").order("updated_at",{ascending:false}),
    db.from("coaching_exercise_requests").select("id,name,status,reviewer_note").eq("coach_id",user.id).order("created_at",{ascending:false}),
  ]);
  if (plans.error || requests.error) throw new Error("Could not load your plans.");
  const grouped = groupLatestDashboardPlans((plans.data ?? []).map(p=>({id:p.id,listingId:p.listing_id,title:p.title,versionNo:p.version_no,state:p.version_state,weeksCount:p.weeks_count,discipline:p.discipline})));
  const summaries: PricingSummary[] = [];
  let pricingError = false;
  for (let start = 0; start < grouped.length; start += 100) {
    const ids = grouped.slice(start,start + 100).map(p=>p.listingId);
    try {
      const result = await db.rpc("get_my_coaching_pricing_summaries",{p_listing_ids:ids});
      if (result.error) { pricingError = true; continue; }
      const parsed = parsePricingSummaries(result.data);
      if (parsed.items.some(item=>!ids.includes(item.listingId)) || parsed.items.length !== ids.length) {pricingError = true; continue;}
      summaries.push(...parsed.items);
    } catch { pricingError = true; }
  }
  return {canManagePlans:true,plans:grouped,requests:requests.data ?? [],summaries,pricingError};
}
