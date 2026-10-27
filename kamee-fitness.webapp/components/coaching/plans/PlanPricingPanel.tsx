"use client";

import { useId, useState, useTransition } from "react";
import type { ReadinessSummary } from "@/lib/coaching/commerce";
import { coachPricingError, formatReferenceMoney, hasCurrentSellerAcceptance, publishedTermsMatch, type CoachPricingActions, type CoachPricingResult } from "@/lib/coaching/coach-pricing";
import { SellerTermsAcceptance } from "./SellerTermsAcceptance";
import styles from "./PlanPricingPanel.module.css";

const stateLabels: Record<ReadinessSummary["state"],string> = {
  unconfigured:"Not configured",pending_review:"Store review pending",active:"Verified offer recorded",change_pending:"Price change pending",failed:"Setup failed",unavailable:"Product unavailable",
};
const reasonLabels: Record<NonNullable<ReadinessSummary["reason"]>,string> = {
  not_configured:"Store product setup is needed.",setup_pending:"Store setup is pending.",setup_failed:"Store setup needs attention.",product_unavailable:"New purchases are blocked for this product.",version_changed:"The current content version needs a matching verified offer before new purchases.",terms_required:"Current commercial terms need acceptance.",option_disabled:"The requested reference price is currently disabled.",
};
function StoreStatus({row}: {row:ReadinessSummary}) {
  return <article className={styles.store}>
    <h4>{row.platform === "ios" ? "Apple" : "Google"} · {row.environment === "PRODUCTION" ? "Production" : "Sandbox (test only)"}</h4>
    <p className={styles.status}>{stateLabels[row.state]}</p>
    {row.effective ? <>
      <p>Effective reference <strong>{formatReferenceMoney(row.effective.referenceMoney)}</strong></p>
      <p className={styles.muted}>Content version {row.effectiveVersionNo ?? "unknown"}{row.matchesCurrentVersion ? " · Matches current version" : " · Previous version"}</p>
      {!row.matchesCurrentVersion && <p className={styles.notice}>The current content version needs a matching verified offer before new purchases.</p>}
    </> : <p className={styles.muted}>No effective offer recorded.</p>}
    {row.reason && <p className={styles.muted}>{reasonLabels[row.reason]}</p>}
    {row.setupOutcome === "failed" && row.effective && <p className={styles.notice}>New-price setup failed. The previous effective offer remains recorded; its availability is shown above.</p>}
    {(row.setupOutcome === "change_pending" || row.setupOutcome === "pending_review") && <p className={styles.muted}>Latest setup: {row.setupOutcome === "change_pending" ? "price change pending" : "store review pending"}.</p>}
  </article>;
}
/** Actions and initial values are injectable so local fixtures exercise the same UI without accounts. */
export function PlanPricingPanel({listingId,initial,actions}: {listingId:string;initial:CoachPricingResult;actions:CoachPricingActions}) {
  const id=useId();
  const [result,setResult]=useState(initial);
  const [selected,setSelected]=useState(initial.data?.workspace.pricing.requested?.optionId ?? "");
  const [notice,setNotice]=useState("");
  const [pending,startTransition]=useTransition();
  const data=result.data;
  const workspace=data?.workspace;
  const accepted=workspace ? hasCurrentSellerAcceptance(workspace) : false;
  const termsReady=data ? publishedTermsMatch(data) && !data.termsError : false;
  const enabled=workspace?.options.some(option=>option.enabled) ?? false;
  const selectedEnabled=workspace?.options.some(option=>option.id === selected && option.enabled) ?? false;
  const blockedByError=result.error?.code === "unauthorized" || result.error?.code === "unavailable";
  const canSave=Boolean(workspace?.canRequestPrice && selectedEnabled && accepted && termsReady && workspace.listingStatus !== "retired" && !blockedByError);
  function run(operation:()=>Promise<CoachPricingResult>,success:string) {
    startTransition(async()=>{
      setNotice("");
      try {
        const next=await operation();
        if (next.error?.code === "unauthorized") {
          setResult({error:next.error});
          setSelected("");
        } else {
          setResult(previous=>({...next,data:next.data ?? previous.data}));
          if (next.error?.code === "terms_outdated") setSelected("");
          if (next.mutationApplied) setNotice(next.error ? "Your change was recorded, but refreshed pricing is unavailable. Retry pricing to check its status." : success);
        }
      } catch {setResult(previous=>({...previous,error:coachPricingError("unavailable")}));}
    });
  }
  return <section className={styles.panel} aria-labelledby={`${id}-heading`} aria-busy={pending}>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>Listing settings</p><h2 id={`${id}-heading`}>Pricing</h2></div>
      <button className={styles.secondary} type="button" disabled={pending} onClick={()=>run(()=>actions.refresh(listingId),"")}>{pending ? "Please wait…" : "Retry pricing"}</button>
    </div>
    <p className={styles.muted}>Set a reference price for this listing. Approved workouts and meals stay unchanged when you save a price.</p>
    {result.error && <p role="alert" className={styles.error}>{result.error.message}</p>}
    <p role="status" aria-live="polite" className={styles.feedback}>{pending ? "Updating pricing… Your content edits are preserved." : notice}</p>
    {workspace && <>
      <div className={styles.overview}>
        <div><p className={styles.label}>Requested reference price</p><p className={styles.amount}>{workspace.pricing.requested ? formatReferenceMoney(workspace.pricing.requested.referenceMoney) : "Price not set"}</p></div>
        <div><p className={styles.label}>Current listing content</p><p>{workspace.currentVersionNo ? `Version ${workspace.currentVersionNo}` : "No current version"}</p><p className={styles.muted}>{workspace.contentApproved ? "Approved content" : "Content approval pending"}</p></div>
      </div>
      {workspace.pricing.requested && <p className={styles.muted}>A request is separate from each store’s effective offer below. Store setup may take time.</p>}
      {!workspace.requestedOptionCurrent && workspace.pricing.requested && <p className={styles.notice}>Your previous request uses a historical price. Choose an available current option for a new request.</p>}
      {!workspace.salesEnabled && <p className={styles.notice}>Purchases are currently off. Saving a price or accepting terms does not turn on sales.</p>}
      {workspace.listingStatus === "retired" && <p className={styles.notice}>This listing is retired. Its pricing is read-only.</p>}
      {!enabled && <p className={styles.notice}>Pricing is being prepared. All 45 supported reference choices are shown below; saving will be available when prices are enabled.</p>}
      <form className={styles.priceForm} onSubmit={event=>{event.preventDefault();if (canSave && selected) run(()=>actions.save({listingId,optionId:selected,expectedRevision:workspace.pricing.revision}),"Reference price requested. Store setup is separate.");}}>
        <label htmlFor={`${id}-price`}>Reference price (PHP)</label>
        <select id={`${id}-price`} name="optionId" aria-describedby={`${id}-disclosure`} value={selected} required disabled={pending || workspace.listingStatus === "retired"} onChange={event=>setSelected(event.target.value)}>
          <option value="" disabled>Choose a reference price</option>
          {workspace.options.map(option=><option key={option.id} value={option.id} disabled={!option.enabled}>{formatReferenceMoney(option.referenceMoney)}{!option.enabled ? " · Unavailable" : ""}</option>)}
        </select>
        <p id={`${id}-disclosure`} className={styles.muted}>Reference amounts are in PHP. Buyers see local store prices, which may differ. A new price or approved content version needs store verification before new purchases use it.</p>
        {!accepted && termsReady && <p className={styles.notice}>Accept the current commercial terms below before saving a price.</p>}
        <button type="submit" className={styles.primary} disabled={!canSave || pending}>{pending ? "Please wait…" : "Save price"}</button>
      </form>
      <section className={styles.platformSection} aria-labelledby={`${id}-stores`}>
        <h3 id={`${id}-stores`}>Store status</h3>
        <p className={styles.muted}>Production offers are shown first. A verified offer alone does not enable checkout.</p>
        <div className={styles.stores}>{workspace.platforms.filter(row=>row.environment === "PRODUCTION").map(row=><StoreStatus key={row.platform} row={row}/>)}</div>
        <details className={styles.sandbox}><summary className={styles.summary}>Sandbox test details</summary><p className={styles.muted}>Test environment only. Sandbox status does not establish launch readiness.</p><div className={styles.stores}>{workspace.platforms.filter(row=>row.environment === "SANDBOX").map(row=><StoreStatus key={row.platform} row={row}/>)}</div></details>
      </section>
      {termsReady && data?.terms ? <SellerTermsAcceptance key={`${data.terms.version}:${data.terms.contentHash}`} terms={data.terms} accepted={accepted} pending={pending} onAccept={async checked=>run(()=>actions.accept(listingId,{version:data.terms!.version,contentHash:data.terms!.contentHash},checked),"Commercial terms acceptance recorded.")}/> : <section className={styles.terms}><h3>Commercial terms</h3><p className={styles.notice}>{data?.termsError ? "Commercial terms could not be loaded or changed during loading. Retry pricing to review the current text." : "Commercial terms are not available yet. Pricing is being prepared."}</p></section>}
      <p className={styles.disclosure}>Coaches receive 80% of actual net proceeds after store fees; Kamee receives 20%. Payouts are reviewed monthly and depend on settlement, refunds and adjustments. Your selected reference price is not a payable earnings estimate.</p>
    </>}
  </section>;
}
