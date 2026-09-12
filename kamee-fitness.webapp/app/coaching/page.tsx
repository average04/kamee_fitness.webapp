import { redirect } from "next/navigation";

/**
 * `/coaching` has no page of its own: requireCoach sends signed-out visitors
 * to `/login?next=/coaching`, so this bare path must land somewhere real.
 * The onboarding page runs requireCoach itself and routes invited users,
 * non-coaches and every hub state from there.
 */
export default function CoachingIndexPage() {
  redirect("/coaching/onboarding");
}
