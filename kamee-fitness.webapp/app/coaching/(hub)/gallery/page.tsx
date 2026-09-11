import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { GalleryManager, type GalleryRow } from "@/components/coaching/GalleryManager";

export const metadata = { title: "Coach gallery" };

export default async function GalleryPage() {
  const { user, status } = await requireCoach();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("coaching_gallery")
    .select("id, image_path, caption, position")
    .eq("coach_id", user.id)
    .order("position", { ascending: true });

  // M8-style rule (see loadHub): never silently render an empty grid on a
  // failed read -- app/coaching/error.tsx shows a friendly retry instead.
  if (error) {
    throw new Error(`GalleryPage: failed to load coaching_gallery: ${error.message}`);
  }

  const readOnly = status === "in_review";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Gallery</h1>
      <p className="text-sm text-muted">
        Photos of you coaching, training, or with clients. Members see these on your profile.
      </p>
      <GalleryManager
        coachId={user.id}
        photos={(data ?? []) as GalleryRow[]}
        readOnly={readOnly}
      />
    </div>
  );
}
