import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { PageIntro } from "@/components/coaching/PageIntro";
import { stateLabel } from "@/lib/coaching/plans";
import { loadCoachPlanList } from "@/lib/coaching/pricing-query";
import { coachPricingBadge } from "@/lib/coaching/coach-pricing";
import styles from "@/components/coaching/plans/PlanPricingPanel.module.css";

export const metadata = { title: "My coaching plans" };

export default async function PlansPage() {
  const { canManagePlans, plans, requests, summaries, pricingError } = await loadCoachPlanList();
  if (!canManagePlans)
    return (
      <PageIntro
        title="My plans"
        description="You can create plans once your coach profile is approved."
      />
    );
  const pricingByListing = new Map(summaries.map(summary => [summary.listingId, summary]));
  return (
    <>
      <div className="plan-list-heading">
        <PageIntro title="My plans" />
        <Link className="coach-primary" href="/coaching/plans/new">
          Create plan
        </Link>
      </div>
      {pricingError && <p className="coach-panel-description" role="status">Pricing is temporarily unavailable. Open a plan to retry its pricing status.</p>}
      <div className="plan-list">
        {!plans.length && (
          <div className="coach-panel">
            <h2>No plans yet</h2>
            <p className="coach-panel-description">
              Create your first workout or outdoor plan.
            </p>
          </div>
        )}
        {plans.map((p) => (
          <Link
            className="coach-panel plan-card"
            key={p.listingId}
            href={`/coaching/plans/${p.id}`}
          >
            <div>
              <h2>{p.title}</h2>
              <p className="coach-panel-description">
                {p.discipline === "running" ? "Outdoor" : "Workout"} ·{" "}
                {p.weeksCount} weeks · Version {p.versionNo}
              </p>
            </div>
            <div className={styles.listBadges}>
              <span className="coach-status">{stateLabel(p.state)}</span>
              <span className={styles.listBadge}>{coachPricingBadge(pricingByListing.get(p.listingId))}</span>
            </div>
          </Link>
        ))}
      </div>
      {!!requests.length && (
        <section className="plan-stack mt-6">
          <h2>Exercise requests</h2>
          {requests.map((r) => (
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
