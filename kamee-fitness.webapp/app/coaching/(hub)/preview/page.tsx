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
        <h1 className="font-display text-2xl font-semibold">Preview</h1>
        <p className="mt-1 text-sm text-muted">This is how members will see you.</p>
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
