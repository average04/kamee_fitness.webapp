import Link from "next/link";
import { requireCoach } from "@/lib/coaching/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageIntro } from "@/components/coaching/PageIntro";
import { CreatePlan } from "@/components/coaching/plans/CreatePlan";
import { stateLabel } from "@/lib/coaching/plans";

export default async function PlansPage() {
  const { status } = await requireCoach();
  if (status !== "approved")
    return (
      <PageIntro
        title="Plans"
        description="You can create plans once your coach profile is approved."
      />
    );
  const db = await createServerSupabase();
  const [{ data, error }, requests] = await Promise.all([
    db
      .from("plans")
      .select(
        "id,title,version_no,version_state,discipline,weeks_count,updated_at",
      )
      .eq("kind", "coach")
      .order("updated_at", { ascending: false }),
    db
      .from("coaching_exercise_requests")
      .select("id,name,status,reviewer_note")
      .order("created_at", { ascending: false }),
  ]);
  if (error || requests.error) throw new Error("Could not load your plans.");
  return (
    <>
      <PageIntro title="Plans" />
      <div className="plan-home">
        <div className="plan-stack">
          {!data?.length && (
            <div className="coach-panel">
              <h2>No plans yet</h2>
              <p className="coach-panel-description">
                Build a schedule, add meals and attach your videos.
              </p>
            </div>
          )}
          {data?.map((p) => (
            <Link
              className="coach-panel plan-card"
              key={p.id}
              href={`/coaching/plans/${p.id}`}
            >
              <div>
                <h2>{p.title}</h2>
                <p className="coach-panel-description">
                  {p.discipline === "running" ? "Outdoor" : "Workout"} ·{" "}
                  {p.weeks_count} weeks · Version {p.version_no}
                </p>
              </div>
              <span className="coach-status">
                {stateLabel(p.version_state)}
              </span>
            </Link>
          ))}
        </div>
        <CreatePlan />
      </div>
      {!!requests.data?.length && (
        <section className="plan-stack mt-6">
          <h2>Exercise requests</h2>
          {requests.data.map((r) => (
            <div key={r.id} className="coach-panel">
              <div className="plan-card">
                <h3>{r.name}</h3>
                <span>
                  {r.status === "added"
                    ? "Added to catalog"
                    : r.status === "declined"
                      ? "Declined"
                      : "Pending review"}
                </span>
              </div>
              {r.reviewer_note && (
                <p className="coach-panel-description">{r.reviewer_note}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
