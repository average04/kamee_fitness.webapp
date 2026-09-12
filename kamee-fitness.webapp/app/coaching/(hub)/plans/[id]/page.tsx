import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PlanEditor } from "@/components/coaching/plans/PlanEditor";
import type { PlanDocument, Video } from "@/lib/coaching/plans";

import { loadCoachingCatalog } from "@/lib/coaching/catalog";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireCoach(["approved"]);
  const { id } = await params;
  const db = await createServerSupabase();
  const [
    { data: plan, error },
    exercises,
    { data: videos, error: videoError },
  ] = await Promise.all([
    db.rpc("get_coaching_plan", { p_plan_id: id }),
    loadCoachingCatalog(db),
    db
      .from("coaching_videos")
      .select("*")
      .in("status", ["ready", "failed"])
      .order("created_at", { ascending: false }),
  ]);
  if (error || !plan) notFound();
  if (videoError)
    throw new Error("Could not load the exercise or video library.");
  return (
    <PlanEditor
      ownerId={user.id}
      key={id}
      initial={plan as PlanDocument}
      exercises={exercises ?? []}
      videos={(videos ?? []) as Video[]}
    />
  );
}
