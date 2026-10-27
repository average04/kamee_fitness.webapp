"use client";

import { useId, useState } from "react";
import type { PublishedSellerTerms } from "@/lib/coaching/coach-pricing";
import styles from "./PlanPricingPanel.module.css";

export function SellerTermsAcceptance({terms,accepted,pending,onAccept}: {
  terms: PublishedSellerTerms;
  accepted: boolean;
  pending: boolean;
  onAccept: (accepted: boolean) => Promise<void>;
}) {
  const id = useId();
  const [checked,setChecked] = useState(false);
  return <section className={styles.terms} aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Commercial terms</h3>
    <p className={styles.muted}>Version {terms.version}. Review the current published text before accepting.</p>
    <details>
      <summary className={styles.summary}>Read commercial terms</summary>
      <div className={styles.termsBody}>{terms.body}</div>
    </details>
    {accepted ? <p className={styles.accepted}>Commercial terms accepted</p> : <form onSubmit={event=>{event.preventDefault();void onAccept(checked);}}>
      <label className={styles.checkbox} htmlFor={`${id}-accept`}>
        <input id={`${id}-accept`} type="checkbox" required checked={checked} disabled={pending} onChange={event=>setChecked(event.target.checked)} />
        <span>I accept these commercial terms</span>
      </label>
      <p className={styles.muted}>Your coach onboarding consent does not replace this commercial agreement.</p>
      <button className={styles.secondary} type="submit" disabled={!checked || pending}>{pending ? "Please wait…" : "Accept commercial terms"}</button>
    </form>}
  </section>;
}
