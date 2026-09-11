import Link from "next/link";
import { requireCoach } from "@/lib/coaching/auth";
import { loadHub } from "@/lib/coaching/queries";
import { Checklist } from "@/components/coaching/Checklist";
import { CoverUpload } from "@/components/coaching/CoverUpload";
import { ProfileForm } from "@/components/coaching/ProfileForm";
import { SubmitBlock } from "@/components/coaching/SubmitBlock";

export const metadata = { title: "Coach onboarding" };

export default async function OnboardingPage() {
  const { user, status } = await requireCoach();
  const hub = await loadHub(user.id);
  const readOnly = status === "in_review";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Set up your coach profile</h1>

      {hub.latestReview?.decision === "changes_requested" && status === "changes_requested" && (
        <div className="rounded-2xl border border-ember-600/40 bg-ember-600/10 p-5">
          <h2 className="text-sm font-semibold text-ember-400">Changes requested</h2>
          {hub.latestReview.note && (
            <p className="mt-1 text-sm text-mist">{hub.latestReview.note}</p>
          )}
        </div>
      )}

      {status === "in_review" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-mist">Submitted — we&apos;ll review it soon.</p>
        </div>
      )}

      <Checklist missing={hub.missing} />
      <CoverUpload userId={user.id} current={hub.profile.cover_image_path} readOnly={readOnly} />
      <ProfileForm profile={hub.profile} readOnly={readOnly} />
      <SubmitBlock missing={hub.missing} status={status} />

      <div className="flex gap-4 text-sm">
        <Link href="/coaching/credentials" className="text-leaf-500 hover:text-leaf-400">
          Add credentials
        </Link>
        <Link href="/coaching/gallery" className="text-leaf-500 hover:text-leaf-400">
          Add gallery photos
        </Link>
      </div>
    </div>
  );
}
