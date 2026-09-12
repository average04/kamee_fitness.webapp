import { PageIntro } from "@/components/coaching/PageIntro";
import Link from "next/link";
import { requireCoach } from "@/lib/coaching/auth";
import { loadHub } from "@/lib/coaching/queries";
import { Checklist } from "@/components/coaching/Checklist";
import { CoverUpload } from "@/components/coaching/CoverUpload";
import { ProfileForm } from "@/components/coaching/ProfileForm";
import { SubmitBlock } from "@/components/coaching/SubmitBlock";
import { CoachTermsAcceptance } from "@/components/coaching/CoachTermsAcceptance";
import { coachTermsState } from "@/lib/coaching/terms";
import { COACH_TERMS_DRAFT, COACH_TERMS_VERSION } from "@/lib/legal-version";

export const metadata = { title: "Coach onboarding" };

export default async function OnboardingPage() {
  const { user, status } = await requireCoach();
  const hub = await loadHub(user.id);
  const readOnly = status === "in_review";
  const terms = coachTermsState(hub.profile, hub.currentTerms, {
    version: COACH_TERMS_VERSION,
    draft: COACH_TERMS_DRAFT,
  });

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="LET'S GET YOU STARTED" title="Your next chapter starts here." description="Bring your experience, personality and coaching style together. We'll help you turn them into a profile that feels like you." />

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
          <p className="text-sm text-mist">Submitted â€” we&apos;ll review it soon.</p>
        </div>
      )}

      <div className="coach-onboarding-grid">
        <div className="space-y-6">
          <CoverUpload userId={user.id} current={hub.profile.cover_image_path} readOnly={readOnly} />
          <ProfileForm profile={hub.profile} readOnly={readOnly} />
          <CoachTermsAcceptance state={terms} />
          <SubmitBlock missing={hub.missing} status={status} />
        </div>
        <aside className="coach-onboarding-aside" aria-label="Profile setup guide">
          <Checklist missing={hub.missing} />
          <div className="coach-panel">
            <h2>The details tell your story.</h2>
            <Link href="/coaching/gallery" className="coach-resource"><strong>Build your photo gallery <span aria-hidden="true">&#8599;</span></strong><span>Add at least three photos of you coaching, training or doing what you love.</span></Link>
            <Link href="/coaching/credentials" className="coach-resource"><strong>Add credentials <span aria-hidden="true">&#8599;</span></strong><span>Optional. Share your qualifications; supporting documents stay private.</span></Link>
            <Link href="/coaching/preview" className="coach-resource"><strong>See your profile preview <span aria-hidden="true">&#8599;</span></strong><span>Take a look through a future client&apos;s eyes.</span></Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
