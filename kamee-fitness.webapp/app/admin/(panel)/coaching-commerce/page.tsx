import Link from "next/link";
import { listAdminPricing } from "./actions";
import { formatAdminMoney } from "@/lib/coaching/commerce-admin";
import styles from "@/components/coaching/commerce/ProductReadinessPanel.module.css";

export default async function AdminCommercePage({searchParams}:{searchParams:Promise<{after?:string|string[]}>}) {
  const {after}=await searchParams;
  const result=await listAdminPricing(typeof after==="string"?after:null);
  return <div className={styles.workspace}>
    <header><p className={styles.eyebrow}>Coach commerce · operator workspace</p><h1>Product readiness</h1><p>Review requested prices and independent platform offers before any release decision.</p></header>
    {result.error&&<p role="alert" className={styles.error}>{result.error.message} <Link href="/admin/coaching-commerce">Retry loading</Link></p>}
    {result.page&&<section aria-label="Listing pricing summaries">{result.page.items.length===0?<p>No listings in this page.</p>:<div className={styles.grid}>{result.page.items.map(item=><article className={styles.card} key={item.listingId}><h2><Link href={`/admin/coaching-commerce/${item.listingId}`}>{item.listingTitle||"Untitled listing"}</Link></h2><p>{item.coachDisplayName||"Coach"} · {item.listingStatus}</p><p>Requested reference: {item.requested?formatAdminMoney(item.requested.referenceMoney):"Not requested"}</p><p>Latest setup outcome: {item.setupOutcome} · listing revision {item.revision}</p>{item.requested&&!item.requestedOptionCurrent&&<p>Requested option is outside the current catalogue.</p>}<ul>{item.platforms.map(row=><li key={`${row.platform}:${row.environment}`}>{row.platform==="ios"?"iOS":"Android"} · {row.environment}: {row.state.replaceAll("_"," ")} · effective {row.effective?formatAdminMoney(row.effective.referenceMoney):"none"} · {row.matchesCurrentVersion?"current version":"version not matched"}</li>)}</ul></article>)}</div>}{result.page.nextListingId&&<Link href={`/admin/coaching-commerce?after=${encodeURIComponent(result.page.nextListingId)}`}>Next listings</Link>}</section>}
    <section id="release-readiness" className={styles.card}><h2>Release readiness checklist</h2><p>Manual store verification is one prerequisite. This workspace cannot activate global release gates.</p><ul>
      <li>Confirm approved current content, exact current seller consent, and the requested price.</li>
      <li>Verify the immutable product/provider tuple and exact PHP store price point independently for iOS and Android, in sandbox and production.</li>
      <li>Check store review evidence within the applicable environment. Production cannot be verified while review is pending.</li>
      <li>Verify sales, purchase verification, provider routing processing and test-access gates through the release procedure. Their current states are not reported by this index.</li>
      <li>Complete Task 0a inbox/routing release and deferred provider retry evidence before real product/refund tests; repair both Task 6 tier-derived Free predicates before sales activation.</li>
      <li>Keep payouts, ownership, provider registry changes and global flags in their separate authorized procedures.</li>
    </ul><p>Unconfigured or unavailable paid listings must not be labelled Free. Reference amounts do not estimate coach earnings; coach receives 80% of actual net proceeds after store fees, subject to refunds, adjustments and monthly admin review.</p></section>
  </div>;
}
