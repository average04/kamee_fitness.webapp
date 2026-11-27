import { redirect } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { getPortalSession } from "@/lib/auth/portal-session";
import { PortalShell } from "@/components/portal/PortalShell";
import { AuthBoundaryForm } from "@/components/auth/AuthBoundaryForm";
import { signOut } from "./actions";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const session = await getPortalSession();
  if (!session) redirect("/login");

  return (
    <PortalShell
      access={{ isAdmin: session.isAdmin, canUseCoachHub: session.canUseCoachHub, coachStatus: session.coachStatus, defaultDestination: session.defaultDestination }}
      email={session.user.email ?? null}
      surface="member"
      contentElement="div"
      signOut={<AuthBoundaryForm action={signOut}><button type="submit">Sign out</button></AuthBoundaryForm>}
    >
      {children}
    </PortalShell>
  );
}
