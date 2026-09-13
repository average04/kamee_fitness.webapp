import { loadCoachingCatalog } from "@/lib/coaching/catalog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PlanPreview } from "@/components/coaching/plans/PlanPreview";
import { ReviewForm } from "@/components/coaching/plans/ReviewForm";
import type { PlanDocument } from "@/lib/coaching/plans";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminSupabase();
  const [result, exercises, reviews] = await Promise.all([
    db.rpc("admin_get_coaching_plan", { p_plan_id: id }),
    loadCoachingCatalog(db),
    db
      .from("coaching_plan_reviews")
      .select("*")
      .eq("plan_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (result.error || !result.data) notFound();
  if (reviews.error)
    throw new Error("Could not load review details.");
  const plan = result.data as PlanDocument;
  return (
    <>
      <Link href="/admin/coaching-plans">← Coaching plans</Link>
      <h1 className="text-3xl font-semibold">
        {plan.title} · v{plan.version_no}
      </h1>
      {plan.change_note && (
        <div className="coach-panel">
          <h2>Version changes</h2>
          <p>{plan.change_note}</p>
        </div>
      )}
      <PlanPreview plan={plan} exercises={exercises} admin />
      {plan.version_state === "in_review" && (
        <div className="coach-panel">
          <ReviewForm id={id} />
        </div>
      )}
      <section className="coach-panel plan-stack">
        <h2>Review history</h2>
        {reviews.data?.map((r) => (
          <p key={r.id}>
            {new Date(r.created_at).toLocaleString()} · {r.decision}
            {r.note ? ` · ${r.note}` : ""}
          </p>
        ))}
      </section>
    </>
  );
}
