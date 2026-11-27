import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/coaching/auth";
import { getPortalSession } from "@/lib/auth/portal-session";
import { COACH_STATUS_LABEL } from "@/lib/coaching/states";
import { HubLocation, HubSectionNav } from "@/components/coaching/HubNav";
import { CoachSignOut } from "@/components/coaching/CoachSignOut";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function CoachingHubLayout({ children }: { children: React.ReactNode }) {
  const { status } = await requireCoach();
  const session = await getPortalSession();
  if (!session) redirect("/login");
  return (
    <PortalShell
      access={{ isAdmin: session.isAdmin, canUseCoachHub: session.canUseCoachHub, coachStatus: session.coachStatus, defaultDestination: session.defaultDestination }}
      email={session.user.email ?? null}
      surface="coach"
      contentElement="div"
      skipTargetId="coach-content"
      signOut={<CoachSignOut />}
    >
      <div className="coach-main">
        <header className="coach-topbar">
          <HubLocation />
          <div className="coach-topbar-actions">
            <span className="coach-status">{COACH_STATUS_LABEL[status] ?? status}</span>
          </div>
        </header>
        <main id="coach-content" className="coach-content" tabIndex={-1}>
          <HubSectionNav />
          {children}
        </main>
      </div>
    </PortalShell>
  );
}
