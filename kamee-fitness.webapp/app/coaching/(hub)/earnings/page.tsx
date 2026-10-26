import { CoachBusinessDashboard } from "@/components/coaching/dashboard/CoachBusinessDashboard";
import { loadCoachDashboard } from "@/lib/coaching/dashboard-query";
import { getDashboardReport } from "@/lib/coaching/dashboard";

export const metadata = { title: "Coaching sales and earnings" };

export default async function CoachEarningsPage({ searchParams }: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const [data, params] = await Promise.all([loadCoachDashboard(), searchParams]);
  const initialPeriod = getDashboardReport(typeof params.period === "string" ? params.period : "october").period;
  return <CoachBusinessDashboard view="earnings" initialPeriod={initialPeriod} {...data} />;
}
