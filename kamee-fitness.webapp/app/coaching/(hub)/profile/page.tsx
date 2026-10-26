import { PageIntro } from "@/components/coaching/PageIntro";
import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { requireCoach } from "@/lib/coaching/auth";
import { loadHub } from "@/lib/coaching/queries";
import { loadCoachingSpecialtyOptions } from "@/lib/coaching/specialty-options-query";
import { Checklist } from "@/components/coaching/Checklist";
import { CoverUpload } from "@/components/coaching/CoverUpload";
import { ProfileForm } from "@/components/coaching/ProfileForm";
import { DisplayNameForm } from "@/components/coaching/DisplayNameForm";
import { SubmitBlock } from "@/components/coaching/SubmitBlock";
import { CoachTermsAcceptance } from "@/components/coaching/CoachTermsAcceptance";
import { coachTermsState } from "@/lib/coaching/terms";
import { COACH_TERMS_DRAFT, COACH_TERMS_VERSION } from "@/lib/legal-version";

export const metadata = { title: "Your coach profile" };

export default async function CoachProfilePage() {
  const { user, status } = await requireCoach();
  const [hub, specialtyOptions] = await Promise.all([
    loadHub(user.id),
    loadCoachingSpecialtyOptions(),
  ]);
  const onboarding = ["onboarding", "in_review", "changes_requested"].includes(status);
  const readOnly = status === "in_review";
  const terms = coachTermsState(hub.profile, hub.currentTerms, {
    version: COACH_TERMS_VERSION,
    draft: COACH_TERMS_DRAFT,
  });

  return (
    <div className="space-y-6">
      <PageIntro title={onboarding ? "Set up your coach profile" : "Your coach profile"} />

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
          <p className="text-sm text-mist">Submitted. We&apos;ll review it soon.</p>
        </div>
      )}

      <div className={onboarding ? "coach-onboarding-grid" : undefined}>
        <div className="space-y-6">
          <DisplayNameForm current={hub.displayName} readOnly={readOnly} />
          <CoverUpload kind="avatar" userId={user.id} current={hub.avatarPhotoPath} readOnly={readOnly} />
          <CoverUpload userId={user.id} current={hub.profile.cover_image_path} readOnly={readOnly} />
          <ProfileForm
            profile={hub.profile}
            readOnly={readOnly}
            specialtyOptions={specialtyOptions.options}
            specialtyOptionsError={specialtyOptions.error}
          />
          <CoachTermsAcceptance state={terms} />
          {onboarding && <nav className="flex justify-end" aria-label="Next onboarding step">
            <Link
              href="/coaching/credentials"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-leaf-600 px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-leaf-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-500"
            >
              Next: Credentials <span aria-hidden="true">&#8594;</span>
            </Link>
          </nav>}
          <SubmitBlock missing={hub.missing} status={status} />
        </div>
        {onboarding && (
          <aside className="coach-onboarding-aside" aria-label="Profile setup guide">
            <Checklist missing={hub.missing} />
          </aside>
        )}
      </div>
    </div>
  );
}
