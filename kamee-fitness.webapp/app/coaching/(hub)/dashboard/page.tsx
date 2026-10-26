import { CoachBusinessDashboard } from "@/components/coaching/dashboard/CoachBusinessDashboard";
import { loadCoachDashboard } from "@/lib/coaching/dashboard-query";

export const metadata = { title: "Coach business overview" };

export default async function CoachDashboardPage() {
  return <CoachBusinessDashboard view="overview" {...await loadCoachDashboard()} />;
}
