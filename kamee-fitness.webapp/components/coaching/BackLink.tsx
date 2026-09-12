import Link from "next/link";
import type { CoachStatus } from "@/lib/coaching/states";

const ONBOARDING_STATES: CoachStatus[] = ["onboarding", "in_review", "changes_requested"];

/**
 * "Back" for the credentials and gallery editors: to the onboarding
 * checklist while the coach is still onboarding (or in review / asked for
 * changes), otherwise to their profile.
 */
export function BackLink({ status }: { status: CoachStatus }) {
  const toOnboarding = ONBOARDING_STATES.includes(status);
  return (
    <Link
      href={toOnboarding ? "/coaching/onboarding" : "/coaching/profile"}
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-mist"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {toOnboarding ? "Back to onboarding" : "Back to profile"}
    </Link>
  );
}
