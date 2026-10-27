/** Owner-filtered plan metadata used to group pricing cards by listing. */
export type DashboardPlan = {
  id: string;
  listingId: string;
  title: string;
  versionNo: number;
  state: string;
  weeksCount: number;
  discipline: string;
};

export function groupLatestDashboardPlans(plans: readonly DashboardPlan[]): DashboardPlan[] {
  const latest = new Map<string, DashboardPlan>();
  for (const plan of plans) {
    const key = plan.listingId || plan.id;
    const previous = latest.get(key);
    if (!previous || plan.versionNo > previous.versionNo) latest.set(key, plan);
  }
  return [...latest.values()];
}
