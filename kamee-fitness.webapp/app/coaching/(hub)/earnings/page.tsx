import { unstable_rethrow } from "next/navigation";
import { CoachEarnings } from "@/components/coaching/earnings/CoachEarnings";
import { EarningsReconciliationError, loadCoachEarnings, loadEarningsPlanTitles } from "@/lib/coaching/earnings-query";
import { parseEarningsSearchParams, type EarningsQuery, type EarningsSearchParams, type EarningsWorkspace } from "@/lib/coaching/earnings";

export const metadata = { title: "Coaching sales and earnings" };

export default async function CoachEarningsPage({ searchParams }: {
  searchParams: Promise<EarningsSearchParams>;
}) {
  const params = await searchParams;
  let query: EarningsQuery | null = null;
  try { query = parseEarningsSearchParams(params); }
  catch { /* Invalid input is rendered below, outside the error handler. */ }
  if (!query) return <CoachEarnings query={null} data={null} error="invalid_input" />;
  let data: EarningsWorkspace | null = null;
  let planTitles: Record<string, string> = {};
  let loadError: "unavailable" | "needs_review" | null = null;
  try {
    data = await loadCoachEarnings(query);
    planTitles = await loadEarningsPlanTitles(data);
  }
  catch (error) {
    unstable_rethrow(error);
    loadError = error instanceof EarningsReconciliationError ? "needs_review" : "unavailable";
  }
  return <CoachEarnings query={query} data={loadError ? null : data} error={loadError} planTitles={planTitles} />;
}
