"use client";

import { useState } from "react";
import {
  getDashboardReport,
  type DashboardPeriod,
  type DashboardPlan,
  type DashboardView,
} from "@/lib/coaching/dashboard";
import { BusinessMetrics, EarningsBreakdown, EarningsChart, MonthlyPayout, SamplePlanSales } from "./FinancePanels";
import { SampleClients } from "./SampleClients";
import { CoachSetup, OwnPlans } from "./OwnPlans";
import styles from "./dashboard.module.css";

export type CoachBusinessDashboardProps = {
  view: DashboardView;
  displayName: string | null;
  plans: DashboardPlan[];
  plansError: boolean;
  canManagePlans: boolean;
  initialPeriod?: DashboardPeriod;
};

export function CoachBusinessDashboard({ view, displayName, plans, plansError, canManagePlans, initialPeriod = "october" }: CoachBusinessDashboardProps) {
  const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod);
  const report = getDashboardReport(period);
  const name = displayName?.trim();
  const title = view === "overview"
    ? name ? `Welcome back, ${name}.` : "Welcome to your workspace."
    : view === "clients" ? "Your clients" : "Sales & earnings";
  const description = view === "overview" ? "A little progress. A growing coaching business."
    : view === "clients" ? "See who’s progressing and who may need attention."
      : "From each plan purchase to your monthly payout.";

  return (
    <div className={styles.dashboard}>
      <aside className={styles.sampleNotice} aria-label="Sample business data notice">
        <strong className={styles.sampleBadge}>Sample data</strong>
        <p>Clients, sales, earnings and payouts are fictional. Business reporting is a preview; no payment or transfer will be made.</p>
      </aside>
      <header className={styles.heading}>
        <div>
          <h1>{title}</h1>
          <p className={styles.intro}>{description}</p>
        </div>
        {view !== "clients" && (
          <label className={styles.period}>
            <span>Sample reporting period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value === "september" ? "september" : "october")}>
              <option value="october">October 2026</option>
              <option value="september">September 2026</option>
            </select>
          </label>
        )}
      </header>
      {!canManagePlans && view !== "overview" && <section className={styles.panel} aria-label="Coach workspace setup"><h2>Coach workspace setup</h2><CoachSetup /></section>}
      {view !== "clients" && <BusinessMetrics report={report} />}
      {view === "overview" && (
        <>
          <div className={styles.financeGrid}>
            <EarningsChart report={report} />
            <MonthlyPayout report={report} />
          </div>
          <SampleClients overview />
          <OwnPlans plans={plans} plansError={plansError} canManagePlans={canManagePlans} />
        </>
      )}
      {view === "clients" && <SampleClients />}
      {view === "earnings" && (
        <>
          <div className={styles.financeGrid}>
            <EarningsBreakdown report={report} />
            <MonthlyPayout report={report} breakdown />
          </div>
          <SamplePlanSales report={report} />
        </>
      )}
    </div>
  );
}

export default CoachBusinessDashboard;
