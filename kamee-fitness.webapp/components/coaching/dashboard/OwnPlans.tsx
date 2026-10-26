import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { groupLatestDashboardPlans, type DashboardPlan } from "@/lib/coaching/dashboard";
import { stateLabel } from "@/lib/coaching/plans";
import styles from "./dashboard.module.css";

export function CoachSetup() {
  return (
    <div className={styles.empty}>
      <h3>Build your coach profile</h3><p>Plan creation becomes available once your coach profile is approved.</p>
      <Link href="/coaching/profile" className={styles.button}>Go to Profile</Link>
    </div>
  );
}

export function OwnPlans({ plans, plansError, canManagePlans }: { plans: DashboardPlan[]; plansError: boolean; canManagePlans: boolean }) {
  const latest = groupLatestDashboardPlans(plans);
  return (
    <section className={`${styles.panel} ${styles.ownPlans}`} aria-label="Your saved plans">
      <div className={styles.panelHead}>
        <div><p className={styles.realLabel}>Your workspace · saved data</p><h2>Your plans</h2><p className={styles.description}>Your latest plan versions. Business sales and client reporting are sample data above.</p></div>
        {canManagePlans && <Link href="/coaching/plans" className={styles.textLink}>View plans <span aria-hidden="true">↗</span></Link>}
      </div>
      {!canManagePlans ? (
        <CoachSetup />
      ) : plansError ? (
        <div className={styles.empty} role="status"><h3>We couldn’t load your plans</h3><p>Your plan count is unavailable. Open Plans to try again.</p><Link href="/coaching/plans" className={styles.button}>Open Plans</Link></div>
      ) : !latest.length ? (
        <div className={styles.empty}><h3>No plans yet</h3><p>Give your next coaching idea a place to grow.</p><Link href="/coaching/plans/new" className={`${styles.button} ${styles.primary}`}>Create your first plan</Link></div>
      ) : (
        <>
          <ul className={styles.planList}>
            {latest.map((plan) => (
              <li key={plan.listingId || plan.id}>
                <Link href={`/coaching/plans/${encodeURIComponent(plan.id)}`} className={styles.planLink}>
                  <div><h3>{plan.title}</h3><p className={styles.description}>{plan.discipline === "running" ? "Outdoor" : "Workout"} · {plan.weeksCount} weeks · Version {plan.versionNo}</p></div>
                  <span className={styles.planState}>{stateLabel(plan.state)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/coaching/plans/new" className={styles.textLink}>Create plan <span aria-hidden="true">↗</span></Link>
        </>
      )}
    </section>
  );
}
