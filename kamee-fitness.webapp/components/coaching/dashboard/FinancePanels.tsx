import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { useId } from "react";
import { formatDashboardMoney as money, type SampleReport } from "@/lib/coaching/dashboard";
import styles from "./dashboard.module.css";

export function BusinessMetrics({ report }: { report: SampleReport }) {
  return (
    <section className={styles.metrics} aria-label={`Sample business metrics, ${report.name}`}>
      <div className={styles.metric}>
        <p className={styles.metricLabel}>Active clients</p>
        <p className={styles.metricValue}>{report.clients}</p>
        <p className={styles.metricNote}>Sample · during report period</p>
      </div>
      <div className={styles.metric}>
        <p className={styles.metricLabel}>Plan sales</p>
        <p className={styles.metricValue}>{report.purchases}</p>
        <p className={styles.metricNote}>Sample one-time purchases</p>
      </div>
      <div className={styles.metric}>
        <p className={styles.metricLabel}>Estimated earnings</p>
        <p className={`${styles.metricValue} ${styles.green}`}>{money(report.coach)}</p>
        <p className={styles.metricNote}>Sample · your 80% of net proceeds</p>
      </div>
    </section>
  );
}

export function EarningsChart({ report }: { report: SampleReport }) {
  const id = useId();
  return (
    <section className={styles.panel} aria-label="Sample coach earnings chart">
      <div className={styles.panelHead}>
        <div><h2>Your earnings</h2><p className={styles.description}>Sample figures · {report.range}</p></div>
        <span className={styles.small}>PHP</span>
      </div>
      <figure className={styles.chartFigure}>
        <figcaption className={styles.srOnly}>{report.name}: sample coach earnings of {money(report.coach)}. Each bar is a period subtotal, after the illustrative fees and Kamee share.</figcaption>
        <div className={styles.chart} role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
          <span id={`${id}-title`} className={styles.srOnly}>Sample coach earnings, {report.name}</span>
          <span id={`${id}-description`} className={styles.srOnly}>{report.bars.map((bar) => `${bar.label}: ${money(bar.amount)}`).join("; ")}. Total {money(report.coach)}.</span>
          <div className={styles.chartAxis} aria-hidden="true"><span>4k</span><span>2k</span><span>0</span></div>
          <div className={styles.chartPlot} aria-hidden="true">
            {report.bars.map((bar) => (
              <div key={bar.label} className={styles.chartColumn}>
                <div className={styles.chartBarArea}>
                  <div className={styles.chartBar} style={{ height: `${bar.amount / 4000 * 100}%` }}><span>{bar.amount.toLocaleString("en-PH")}</span></div>
                </div>
                <span className={styles.chartLabel}>{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
      </figure>
    </section>
  );
}

export function MonthlyPayout({ report, breakdown = false }: { report: SampleReport; breakdown?: boolean }) {
  return (
    <section className={`${styles.panel} ${styles.payout}`} aria-label={`Sample monthly payout, ${report.name}`}>
      <h2 className={styles.payoutLabel}>Monthly payout <span className={styles.sampleInline}>Sample</span></h2>
      <p className={styles.payoutValue}>{money(report.eligible)}</p>
      <p className={styles.description}>Eligible for monthly admin review</p>
      <dl className={styles.payoutLine}><dt>Pending clearance</dt><dd>{money(report.pending)}</dd></dl>
      {!breakdown && <Link href="/coaching/earnings" className={styles.textLink}>View your earnings <span aria-hidden="true">↗</span></Link>}
      <p className={styles.reviewNote}>Sample for {report.name}. Reviewed monthly after store settlement. Illustrative amounts; no payout is scheduled.</p>
    </section>
  );
}

export function EarningsBreakdown({ report }: { report: SampleReport }) {
  return (
    <section className={styles.panel} aria-label="Sample earnings breakdown">
      <h2>Earnings breakdown</h2>
      <p className={styles.description}>Sample figures · {report.range}</p>
      <dl className={styles.ledger}>
        <div><dt>Gross plan sales</dt><dd>{money(report.gross)}</dd></div>
        <div><dt>Store fees &amp; taxes · illustrative</dt><dd>−{money(report.fees)}</dd></div>
        <div><dt>Net proceeds</dt><dd>{money(report.net)}</dd></div>
        <div><dt>Kamee share · 20% of net</dt><dd>−{money(report.kamee)}</dd></div>
        <div className={styles.ledgerTotal}><dt>Your share · 80% of net</dt><dd>{money(report.coach)}</dd></div>
      </dl>
      <p className={styles.small}>Store fees and taxes vary. Final earnings follow the store settlement report.</p>
    </section>
  );
}

export function SamplePlanSales({ report }: { report: SampleReport }) {
  return (
    <section className={styles.panel} aria-label="Fictional sample plan sales">
      <h2>Sample plan sales</h2>
      <p className={styles.description}>Fictional plans only · {report.purchases} purchases · {report.name}. These are separate from your saved plans.</p>
      <ul className={styles.salesList}>
        {report.sales.map((plan) => (
          <li key={plan.title} className={styles.salesRow}>
            <div><h3>{plan.title}</h3><p className={styles.description}>{money(plan.price)} · {plan.count} sample sales</p></div>
            <strong>{money(plan.price * plan.count)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
