import Link from "next/link";
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
          <span className="coach-brand-mark" aria-hidden="true">k</span>
          <span>kamee<small>COACHING</small></span>
        </Link>
        <p className="coach-sidebar-label">YOUR WORKSPACE</p>
        <HubNav onboarding={["onboarding", "in_review", "changes_requested"].includes(status)} />
        <div className="coach-sidebar-note"><p>A little guidance.<br />A lasting difference.</p><p>Build a profile that helps people find the right coach for their next chapter.</p></div>
        <form action={signOutCoach} className="coach-signout"><button>Sign out</button></form>
      </aside>
      <div className="coach-main">
        <header className="coach-topbar">
          <span>Made for the way you coach.</span>
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
