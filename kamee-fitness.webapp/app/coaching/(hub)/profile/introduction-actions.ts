"use server";

import { getCoachSession } from "@/lib/coaching/auth";
import { isUuid } from "@/lib/coaching/uuid";
import { createServerSupabase } from "@/lib/supabase/server";

export type IntroductionVideoResult = { ok: true } | { ok: false; error: string };

/** Bind every change, including null/detach, to the account that rendered it. */
export async function setIntroductionVideo(ownerId: string, videoId: string | null): Promise<IntroductionVideoResult> {
  if (!isUuid(ownerId) || (videoId !== null && !isUuid(videoId))) {
    return { ok: false, error: "Choose a valid introduction video." };
  }
  try {
    const { user, role, status } = await getCoachSession();
    if (!user || user.id !== ownerId) {
      return { ok: false, error: "Your account session changed. Reload to continue." };
    }
    if (role !== "coach" || status !== "approved") {
      return { ok: false, error: "An approved coach account is required." };
    }
    // Request cookies are captured by Next for this action; never reuse the
    // browser's mutable session or a service client to select the actor.
    const db = await createServerSupabase();
    const { error } = await db.rpc("set_coaching_intro_video", { p_video_id: videoId });
    if (!error) return { ok: true };
  } catch {
    // Auth/profile/transport errors do not reveal provider details or succeed.
  }
  return { ok: false, error: "Could not update your introduction. Reload the videos and try again." };
}
