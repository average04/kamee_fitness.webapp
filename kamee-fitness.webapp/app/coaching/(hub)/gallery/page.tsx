import { PageIntro } from "@/components/coaching/PageIntro";
import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { GalleryManager, type GalleryRow } from "@/components/coaching/GalleryManager";

export const metadata = { title: "Coach gallery" };

export default async function GalleryPage() {
  const { user, status } = await requireCoach();
  const supabase = await createServerSupabase();
  let photos: GalleryRow[] | null = null;
  try {
    const { data, error } = await supabase
      .from("coaching_gallery")
      .select("id, image_path, caption, position")
      .eq("coach_id", user.id)
      // Tie-break by created_at, matching the credentials page and the
      // profile RPC so rows sharing a position still have a stable order.
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error) photos = (data ?? []) as GalleryRow[];
  } catch {
    // An optional gallery read must not prevent continuing to preview.
    // Null shows the read failure instead of a false empty, editable grid.
  }

  const readOnly = status === "in_review";

  return (
    <div className="space-y-6">
      <PageIntro title="Gallery" description="Optional. Add up to 12 photos, or continue to your profile preview." />
      {photos === null ? (
        <div className="coach-panel">
          <p role="alert" className="text-sm text-muted">
            Your gallery could not be loaded. Reload to try again, or continue to your profile preview.
          </p>
        </div>
      ) : (
        <GalleryManager coachId={user.id} photos={photos} readOnly={readOnly} />
      )}
      <nav className="flex justify-end" aria-label="Next profile step">
        <Link
          href="/coaching/preview"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-leaf-600 px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-leaf-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-500"
        >
          Next: Profile preview <span aria-hidden="true">&#8594;</span>
        </Link>
      </nav>
    </div>
  );
}
