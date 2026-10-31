import "server-only";
import { requireCoach } from "./auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { earningsInstant, parseEarningsQuery, parseEarningsWorkspace, type EarningsQuery, type EarningsWorkspace } from "./earnings";

export class EarningsUnavailableError extends Error {
  constructor() { super("Earnings are unavailable. Please try again."); this.name = "EarningsUnavailableError"; }
}
export class EarningsReconciliationError extends Error {
  constructor() { super("Your earnings need review before they can be shown."); this.name = "EarningsReconciliationError"; }
}
/** The stable seller is resolved by the RPC from this caller's JWT, including suspension. */
export async function loadCoachEarnings(input: EarningsQuery): Promise<EarningsWorkspace> {
  await requireCoach();
  const query = parseEarningsQuery(input);
  try {
    const db = await createServerSupabase();
    const result = await db.rpc("get_coaching_earnings", { p_input: query });
    if (result.error) throw new EarningsUnavailableError();
    const payload: unknown = result.data;
    if (payload && typeof payload === "object" && "error" in payload) {
      const denial = payload.error;
      if (denial && typeof denial === "object" && "code" in denial && denial.code === "reconciliation_required") throw new EarningsReconciliationError();
    }
    const data = parseEarningsWorkspace(result.data);
    if (earningsInstant(data.period.from) !== earningsInstant(query.from) || earningsInstant(data.period.to) !== earningsInstant(query.to) || data.activity.length > query.limit) throw new EarningsUnavailableError();
    if (query.cursor && data.activity.some(row => earningsInstant(row.at) > earningsInstant(query.cursor!.at) || (earningsInstant(row.at) === earningsInstant(query.cursor!.at) && row.id >= query.cursor!.id))) throw new EarningsUnavailableError();
    return data;
  } catch (error) {
    if (error instanceof EarningsReconciliationError) throw error;
    throw new EarningsUnavailableError();
  }
}

/** Display-only published metadata; an unavailable or retired title never changes the statement. */
export async function loadEarningsPlanTitles(data: EarningsWorkspace): Promise<Record<string, string>> {
  const listingIds = [...new Set(data.activity.flatMap(row => row.listingId ? [row.listingId] : []))];
  if (!listingIds.length) return {};
  try {
    // Coach metadata is owner-readable under RLS, including suspension; anon cannot read it.
    const db = await createServerSupabase();
    const result = await db.from("plans").select("listing_id,title,version_no")
      .in("listing_id", listingIds).eq("kind", "coach").eq("is_published", true).eq("review_status", "approved")
      .order("version_no", { ascending: false });
    if (result.error || !Array.isArray(result.data)) return {};
    const titles: Record<string, string> = {};
    for (const row of result.data) {
      if (typeof row.listing_id === "string" && listingIds.includes(row.listing_id) && !titles[row.listing_id] && typeof row.title === "string" && row.title.trim()) titles[row.listing_id] = row.title;
    }
    return titles;
  } catch { return {}; }
}
