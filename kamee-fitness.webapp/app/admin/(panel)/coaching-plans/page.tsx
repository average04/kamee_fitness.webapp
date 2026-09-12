import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { stateLabel } from "@/lib/coaching/plans";
import { ExerciseReviewForm } from "@/components/coaching/plans/ReviewForm";
export default async function ReviewQueue() {
  await requireAdmin();
  const db = createAdminSupabase();
  const [plans, requests, exercises] = await Promise.all([
    db
      .from("plans")
      .select("id,title,version_no,version_state,updated_at")
      .eq("kind", "coach")
      .order("updated_at", { ascending: false }),
    db
      .from("coaching_exercise_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at"),
    db.from("exercises").select("id,name").order("name").limit(2000),
  ]);
  if (plans.error || requests.error || exercises.error)
    throw new Error("Could not load coaching review queue.");
  return (
    <>
      <h1 className="text-3xl font-semibold">Coaching plans</h1>
      {!plans.data?.length && <p>No plans yet.</p>}
      {plans.data?.map((p) => (
        <Link
          key={p.id}
          href={`/admin/coaching-plans/${p.id}`}
          className="coach-panel plan-card"
        >
          <span>
            {p.title} · Version {p.version_no}
          </span>
          <span>{stateLabel(p.version_state)}</span>
        </Link>
      ))}
      <h2 className="text-xl font-semibold">Exercise requests</h2>
      {!requests.data?.length && <p>No pending requests.</p>}
      {requests.data?.map((r) => (
        <details key={r.id} className="coach-panel">
          <summary>{r.name}</summary>
          <div className="plan-stack">
            <p>{r.description}</p>
            <p>
              {r.primary_muscle} · {r.equipment.join(", ")}
            </p>
            <Link href="/admin/exercises/new">Add exercise to catalog ↗</Link>
            <ExerciseReviewForm id={r.id} exercises={exercises.data ?? []} />
          </div>
        </details>
      ))}
    </>
  );
}
