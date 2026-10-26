import { CoachBusinessDashboard } from "@/components/coaching/dashboard/CoachBusinessDashboard";
import { loadCoachDashboard } from "@/lib/coaching/dashboard-query";

export const metadata = { title: "Coaching clients" };

export default async function CoachClientsPage() {
  return <CoachBusinessDashboard view="clients" {...await loadCoachDashboard()} />;
}
