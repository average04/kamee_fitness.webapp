import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function signVideo(
  id: string,
  ownerId: string | null,
  operator = false,
) {
  const db = createAdminSupabase();
  const { data: video } = await db
    .from("coaching_videos")
    .select("id,coach_id,status,provider_ref,etag")
    .eq("id", id)
    .maybeSingle();
  if (
    !video ||
    video.status !== "ready" ||
    (!operator && (!ownerId || video.coach_id !== ownerId))
  )
    return Response.json({ error: "Video unavailable" }, { status: 404 });
  const { data, error } = await db.storage
    .from("coaching-videos")
    .createSignedUrl(video.provider_ref, 900);
  if (error || !data)
    return Response.json({ error: "Playback unavailable" }, { status: 503 });
  const head = await fetch(data.signedUrl, {
    method: "HEAD",
    cache: "no-store",
  });
  if (!head.ok || !video.etag || head.headers.get("etag") !== video.etag) {
      console.error("coaching_video_integrity_check_failed", { videoId: id, httpStatus: head.status });
    return Response.json(
      { error: "Video could not be verified" },
      { status: 409 },
    );
  }
  return Response.json(
    { url: data.signedUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
