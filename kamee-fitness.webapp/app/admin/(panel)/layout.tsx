import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getPortalSession } from "@/lib/auth/portal-session";
import { signOut } from "@/app/admin/actions";
import { AuthBoundaryForm } from "@/components/auth/AuthBoundaryForm";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const session = await getPortalSession();
  if (!session) redirect("/admin/login");

  return (
    <PortalShell
      access={{ isAdmin: session.isAdmin, canUseCoachHub: session.canUseCoachHub, coachStatus: session.coachStatus, defaultDestination: session.defaultDestination }}
      email={session.user.email ?? null}
      surface="admin"
      signOut={<AuthBoundaryForm action={signOut}><button type="submit">Sign out</button></AuthBoundaryForm>}
    >
      {children}
    </PortalShell>
  );
}
