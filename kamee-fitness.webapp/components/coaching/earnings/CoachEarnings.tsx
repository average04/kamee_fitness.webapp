import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { earningsHref, formatEarningsMoney, parseEarningsSearchParams, type EarningsQuery, type EarningsWorkspace } from "@/lib/coaching/earnings";
import styles from "./earnings.module.css";

type Props = { query: EarningsQuery | null; data: EarningsWorkspace | null; error: "invalid_input" | "unavailable" | "needs_review" | null; planTitles?: Record<string, string> };
const activityLabels = { sale: "Plan sale", refund: "Refund", reversal: "Reversal" };
function displayTime(at: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(at));
}
export function CoachEarnings({ query, data, error, planTitles = {} }: Props) {
  const selected = query ?? parseEarningsSearchParams({});
  const midPage = selected.cursor !== null;
  const hasReview = Boolean(data && data.reviewRequiredCount !== "0");
  return (
    <div className={styles.earnings}>
      <header className={styles.heading}>
        <div><p className={styles.eyebrow}>Your business</p><h1>Sales &amp; earnings</h1><p className={styles.description}>Verified production activity from your coaching plans.</p></div>
        <span className={styles.badge}>Sales estimates</span>
      </header>
      <section className={styles.panel} aria-labelledby="earnings-period-title">
        <h2 id="earnings-period-title">Reporting period</h2>
        <p id="earnings-period-help" className={styles.description}>Dates use UTC. From is included; Until is excluded. Choose up to 366 days.</p>
        {error === "invalid_input" && <div className={styles.error} role="alert"><h3>Check your date range</h3><p>Choose a valid start and later end date, up to 366 days apart. If a saved page link expired, apply the period again.</p><a href="#earnings-from">Review start date</a><a href="#earnings-to">Review end date</a></div>}
        <form action="/coaching/earnings" method="get" className={styles.filters} aria-describedby="earnings-period-help">
          <label htmlFor="earnings-from">From<input id="earnings-from" name="from" type="date" required defaultValue={selected.from.slice(0, 10)} /></label>
          <label htmlFor="earnings-to">Until (excluded)<input id="earnings-to" name="to" type="date" required defaultValue={selected.to.slice(0, 10)} /></label>
          <button type="submit" className={`${styles.button} ${styles.primary}`}>Apply period</button>
        </form>
        {query && <p className={styles.period}>Selected UTC period: <time dateTime={query.from}>{displayTime(query.from)}</time> to <time dateTime={query.to}>{displayTime(query.to)}</time> (end excluded).</p>}
      </section>
      {error === "unavailable" && <section className={`${styles.panel} ${styles.error}`} role="alert"><h2>We couldn’t load your earnings</h2><p>Your sales and balances are unavailable right now. Please try again.</p><Link className={styles.button} href={earningsHref(selected, selected.cursor)}>Try again</Link></section>}
      {error === "needs_review" && <section className={`${styles.panel} ${styles.error}`} role="alert"><h2>Your earnings need review</h2><p>Some verified sales activity needs reconciliation before this statement can be shown. A review of the verified records is required.</p></section>}
      {data && !error && <>
        {hasReview && <section className={`${styles.panel} ${styles.error}`} role="alert" aria-labelledby="earnings-review-title"><h2 id="earnings-review-title">Some activity needs review</h2><p>{data.reviewRequiredCount} {data.reviewRequiredCount === "1" ? "transaction across your sales history needs review" : "transactions across your sales history need review"}, independent of this reporting period or activity page.</p><p>Verified original sales and their reference values remain counted. Known refund and reversal counts may be incomplete until review is resolved.</p></section>}
        <section aria-labelledby="earnings-totals-title" className={styles.totals}>
          <div><h2 id="earnings-totals-title">{hasReview ? "Known period activity" : "Whole-period totals"}</h2><p className={styles.description}>{hasReview ? "Original sales cover the selected period across all activity pages. Refunds and reversals include known verified effects only." : "These totals cover the selected period across all activity pages."}</p></div>
          <dl className={styles.metrics}>
            <div><dt>Production sales</dt><dd>{data.productionSalesCount}</dd></div>
            <div><dt>Known refunds</dt><dd>{data.refundedSalesCount}</dd></div>
            <div><dt>Known reversals</dt><dd>{data.reversedSalesCount}</dd></div>
          </dl>
        </section>
        <div className={styles.financeGrid}>
          <section className={styles.panel} aria-labelledby="earnings-reference-title">
            <h2 id="earnings-reference-title">Reference sales value</h2>
            {data.referenceSales.length ? <ul className={styles.moneyList}>{data.referenceSales.map(money => <li key={money.currency}>{formatEarningsMoney(money)}</li>)}</ul> : <p className={styles.empty}>No reference sales value in this period.</p>}
            <p className={styles.description}>Saved reference prices for original production sales in this period. This value is not store proceeds or money available for payout. Refunds and reversals appear separately.</p>
          </section>
          <section className={`${styles.panel} ${styles.estimate}`} aria-labelledby="earnings-estimate-title"><h2 id="earnings-estimate-title">Estimated earnings unavailable</h2><p className={styles.description}>Final earnings follow store settlement. Store fees, taxes and adjustments are not yet available.</p></section>
        </div>
        <section className={styles.panel} aria-labelledby="earnings-balances-title">
          <h2 id="earnings-balances-title">Balances</h2><p className={styles.description}>Settlement balances and payouts are not enabled yet.</p>
          <dl className={styles.balances}>{["Available", "Reserved", "Paid"].map(label => <div key={label}><dt>{label}</dt><dd>Not enabled</dd></div>)}</dl>
        </section>
        <section className={styles.panel} aria-labelledby="earnings-activity-title">
          <div className={styles.activityHeading}><div><h2 id="earnings-activity-title">Sales activity</h2><p className={styles.description}>Newest first · UTC · Verified production only</p></div>{midPage && <Link href={earningsHref(selected)} className={styles.button}>Back to newest</Link>}</div>
          {data.activity.length ? <ul className={styles.activityList}>{data.activity.map(row => <li key={row.id} className={styles.activityRow}>
            <div><h3>{activityLabels[row.kind]}</h3><p className={styles.description}>{row.listingId && planTitles[row.listingId] ? planTitles[row.listingId] : "Retired plan"}</p><time className={styles.time} dateTime={row.at}>{displayTime(row.at)} UTC</time></div>
            <div className={styles.activityValue}>{row.money ? <><strong>{formatEarningsMoney(row.money)}</strong><span>{row.status === "held" ? "Activity needs review" : "Reference value · provisional"}</span></> : <span>Amount unavailable</span>}</div>
          </li>)}</ul> : <p className={styles.empty}>{midPage ? "No more activity on this page. Return to the newest activity or choose another period." : hasReview ? "No known verified production activity in this period. Activity awaiting review may be omitted." : "No verified production activity in this period."}</p>}
          {data.nextCursor && <div className={styles.pagination}><p>Period totals stay the same as you browse.</p><Link className={styles.button} href={earningsHref(selected, data.nextCursor)}>Older activity <span aria-hidden="true">→</span></Link></div>}
        </section>
        <p className={styles.asOf}>Updated <time dateTime={data.asOf}>{displayTime(data.asOf)} UTC</time>. Sales history is provisional until store settlement.</p>
      </>}
    </div>
  );
}
