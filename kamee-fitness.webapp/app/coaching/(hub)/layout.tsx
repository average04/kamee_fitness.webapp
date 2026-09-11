import Link from "next/link";
import { requireCoach } from "@/lib/coaching/auth";
import { COACH_STATUS_LABEL } from "@/lib/coaching/states";
import { signOutCoach } from "./actions";

const ONBOARDING_VISIBLE_STATES = ["onboarding", "in_review", "changes_requested"];

const STATUS_CLASS: Record<string, string> = {
  onboarding: "border-white/10 text-muted",
  in_review: "border-white/10 text-muted",
  changes_requested: "border-ember-600/40 text-ember-400",
  approved: "border-leaf-600/40 text-leaf-400",
  suspended: "border-ember-600/40 text-ember-400",
};

export default async function CoachingHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = await requireCoach();

  return (
    <div className="min-h-dvh bg-ink-950 text-mist">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-3">
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/coaching/onboarding" className="font-display font-semibold">
            Kamee Coaching
          </Link>
          {ONBOARDING_VISIBLE_STATES.includes(status) && (
            <Link href="/coaching/onboarding" className="text-sm text-muted hover:text-mist">
              Onboarding
            </Link>
          )}
          <Link href="/coaching/profile" className="text-sm text-muted hover:text-mist">
            Profile
          </Link>
          <Link href="/coaching/credentials" className="text-sm text-muted hover:text-mist">
            Credentials
          </Link>
          <Link href="/coaching/gallery" className="text-sm text-muted hover:text-mist">
            Gallery
          </Link>
          <Link href="/coaching/preview" className="text-sm text-muted hover:text-mist">
            Preview
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs ${STATUS_CLASS[status] ?? "border-white/10 text-muted"}`}
          >
            {COACH_STATUS_LABEL[status] ?? status}
          </span>
          <form action={signOutCoach}>
            <button className="rounded-md border border-white/10 px-2 py-1 text-sm text-muted hover:text-mist">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
