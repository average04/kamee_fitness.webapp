import { PageIntro } from "@/components/coaching/PageIntro";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CoachProfileView, type CoachingProfileJson } from "@/components/coaching/CoachProfileView";
import { VideoPlayer } from "@/components/coaching/plans/PlanPreview";
import { SubmitBlock } from "@/components/coaching/SubmitBlock";
import { Checklist } from "@/components/coaching/Checklist";

export const metadata = { title: "Preview your profile" };

export default async function PreviewPage() {
  const { user, status } = await requireCoach();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_coaching_profile", {
    p_user: user.id,
    p_preview: true,
  });

  if (error) {
    throw new Error(`PreviewPage: get_coaching_profile failed: ${error.message}`);
  }
  const { data: missing, error: missingError } = await supabase.rpc("get_coaching_profile_missing");
  if (missingError) throw new Error("Could not check profile requirements. Please retry.");
  const needsSubmission = status === "onboarding" || status === "changes_requested";

  return (
    <div className="space-y-6">
      <div>
        <PageIntro title="Profile preview" description="What members will see." />

      </div>
      {needsSubmission && (
        <div className="space-y-4">
          {(missing?.length ?? 0) > 0 && <Checklist missing={missing ?? ["profile"]} />}
          <SubmitBlock missing={missing ?? ["profile"]} status={status} />
        </div>
      )}
      {status === "in_review" && <p role="status" className="coach-panel">Submitted. Your profile is awaiting review.</p>}
      {data ? (
        <><CoachProfileView data={data as CoachingProfileJson} />{data.intro_video_id && <div className="coach-panel"><h2>Intro video</h2><VideoPlayer id={data.intro_video_id} /></div>}</>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-muted">
          Complete your profile to preview it.
        </div>
      )}
    </div>
  );
}
