import Link from "next/link";
import Image from "next/image";
import { requireCoach } from "@/lib/coaching/auth";
import { COACH_STATUS_LABEL } from "@/lib/coaching/states";
import { HubNav } from "@/components/coaching/HubNav";
import { signOutCoach } from "./actions";

export default async function CoachingHubLayout({ children }: { children: React.ReactNode }) {
  const { status } = await requireCoach();
  return (
    <div className="coach-shell">
      <aside className="coach-sidebar">
        <Link href="/coaching" className="coach-brand" aria-label="Kamee coaching home">
          <Image src="/adaptive-icon.png" width={38} height={38} className="coach-brand-mark" alt="" />
          <span>kamee<small>COACHING</small></span>
        </Link>
        <p className="coach-sidebar-label">COACH PROFILE</p>
        <HubNav onboarding={["onboarding", "in_review", "changes_requested"].includes(status)} />
        <form action={signOutCoach} className="coach-signout"><button>Sign out</button></form>
      </aside>
      <div className="coach-main">
        <header className="coach-topbar">
          <span>Coaching</span>
          <div className="flex items-center gap-3">
            <span className="coach-status">{COACH_STATUS_LABEL[status] ?? status}</span>
            <form action={signOutCoach} className="md:hidden"><button className="text-xs text-muted">Sign out</button></form>
          </div>
        </header>
        <main id="coach-content" className="coach-content">{children}</main>
      </div>
    </div>
  );
}
