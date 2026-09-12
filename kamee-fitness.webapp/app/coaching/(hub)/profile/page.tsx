import { requireCoach } from "@/lib/coaching/auth";
import { loadHub } from "@/lib/coaching/queries";
import { CoverUpload } from "@/components/coaching/CoverUpload";
import { ProfileForm } from "@/components/coaching/ProfileForm";
import { CoachTermsAcceptance } from "@/components/coaching/CoachTermsAcceptance";
import { coachTermsState } from "@/lib/coaching/terms";
import { COACH_TERMS_DRAFT, COACH_TERMS_VERSION } from "@/lib/legal-version";

export const metadata = { title: "Coach profile" };

export default async function CoachProfilePage() {
  const { user, status } = await requireCoach();
  const hub = await loadHub(user.id);
  const readOnly = status === "in_review";
  const terms = coachTermsState(hub.profile, hub.currentTerms, {
    version: COACH_TERMS_VERSION,
    draft: COACH_TERMS_DRAFT,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Your coach profile</h1>
      <CoverUpload userId={user.id} current={hub.profile.cover_image_path} readOnly={readOnly} />
      <ProfileForm profile={hub.profile} readOnly={readOnly} />
      <CoachTermsAcceptance state={terms} />
    </div>
  );
}
