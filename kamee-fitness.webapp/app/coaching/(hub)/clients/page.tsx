import { CoachBusinessDashboard } from "@/components/coaching/dashboard/CoachBusinessDashboard";
import { loadCoachDashboard } from "@/lib/coaching/dashboard-query";
import { requireCoach } from "@/lib/coaching/auth";
import { COACHING_CONVERSATIONS_ENABLED } from "@/lib/coaching/conversation/flags";
import { CoachClients } from "@/components/coaching/conversation/CoachClients";

export const metadata = { title: "Coaching clients" };

export default async function CoachClientsPage() {
  const { user } = await requireCoach();
  if (COACHING_CONVERSATIONS_ENABLED) return <CoachClients accountId={user.id} />;
  return <CoachBusinessDashboard view="clients" {...await loadCoachDashboard()} />;
}
