import { PageIntro } from "@/components/coaching/PageIntro";
import { VideoLibrary } from "@/components/coaching/plans/VideoLibrary";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Video } from "@/lib/coaching/plans";
export default async function VideosPage() {
  const { status, user } = await requireCoach();
  if (status !== "approved")
    return (
      <PageIntro
        title="Videos"
        description="You can upload videos once your coach profile is approved."
      />
    );
  const db = await createServerSupabase();
  const [{ data, error }, profile] = await Promise.all([
    db
      .from("coaching_videos")
      .select("*")
      .is("retired_at", null)
      .order("created_at", { ascending: false }),
    db
      .from("coaching_profiles")
      .select("intro_video_id")
      .eq("user_id", user.id)
      .single(),
  ]);
  if (error || profile.error) throw new Error("Could not load videos.");
  return (
    <>
      <PageIntro
        title="Videos"
        description="Upload once. Use in your plans and profile."
      />
      <VideoLibrary
        initialIntroId={profile.data?.intro_video_id ?? null}
        initial={(data ?? []) as Video[]}
      />
    </>
  );
}
