import { PageIntro } from "@/components/coaching/PageIntro";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CoachProfileView, type CoachingProfileJson } from "@/components/coaching/CoachProfileView";

export const metadata = { title: "Preview your profile" };

export default async function PreviewPage() {
  const { user } = await requireCoach();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_coaching_profile", {
    p_user: user.id,
    p_preview: true,
  });

  if (error) {
    throw new Error(`PreviewPage: get_coaching_profile failed: ${error.message}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <PageIntro title="Profile preview" description="What members will see." />

      </div>
      {data ? (
        <CoachProfileView data={data as CoachingProfileJson} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-muted">
          Complete your profile to preview it.
        </div>
      )}
    </div>
  );
}
