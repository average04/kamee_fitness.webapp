import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoachBusinessDashboard } from "@/components/coaching/dashboard/CoachBusinessDashboard";
import { EarningsChart } from "@/components/coaching/dashboard/FinancePanels";
import {
  filterSampleClients,
  getDashboardReport,
  groupLatestDashboardPlans,
  SAMPLE_CLIENTS,
  type DashboardPlan,
} from "./dashboard";

describe("sample business reporting", () => {
  it.each([
    ["october", 15750, 3150, 12600, 10080, 2520, 6720, 3360],
    ["september", 11500, 2300, 9200, 7360, 1840, 4800, 2560],
  ] as const)("reconciles %s gross, net, shares, chart and payout", (period, gross, fees, net, coach, kamee, eligible, pending) => {
    const report = getDashboardReport(period);
    expect(report).toMatchObject({ gross, fees, net, coach, kamee, eligible, pending });
    expect(report.gross - report.fees).toBe(report.net);
    expect(report.coach).toBe(report.net * 0.8);
    expect(report.kamee).toBe(report.net * 0.2);
    expect(report.coach + report.kamee).toBe(report.net);
    expect(report.eligible + report.pending).toBe(report.coach);
    expect(report.bars.reduce((sum, bar) => sum + bar.amount, 0)).toBe(report.coach);
    expect(report.sales.reduce((sum, plan) => sum + plan.price * plan.count, 0)).toBe(report.gross);
    expect(report.sales.reduce((sum, plan) => sum + plan.count, 0)).toBe(report.purchases);
  });

  it("selects the requested report and defaults invalid periods to the latest sample", () => {
    expect(getDashboardReport("september")).toMatchObject({ name: "September 2026", purchases: 13 });
    expect(getDashboardReport("october")).toMatchObject({ name: "October 2026", purchases: 18 });
    expect(getDashboardReport("unknown").period).toBe("october");
  });

  it("searches names and plans literally, ignoring case and outer whitespace", () => {
    expect(filterSampleClients(SAMPLE_CLIENTS, "  ANDREA  ", "all").map((client) => client.id)).toEqual(["andrea"]);
    expect(filterSampleClients(SAMPLE_CLIENTS, "run-walk", "all").map((client) => client.id)).toEqual(["miguel", "paolo"]);
    expect(filterSampleClients(SAMPLE_CLIENTS, ".*", "all")).toEqual([]);
    expect(filterSampleClients(SAMPLE_CLIENTS, "nobody", "all")).toEqual([]);
  });

  it("combines the visible query with the attention filter without changing the roster", () => {
    expect(filterSampleClients(SAMPLE_CLIENTS, "", "attention").map((client) => client.id)).toEqual(["miguel", "paolo"]);
    expect(filterSampleClients(SAMPLE_CLIENTS, "miguel", "attention").map((client) => client.id)).toEqual(["miguel"]);
    expect(filterSampleClients(SAMPLE_CLIENTS, "andrea", "attention")).toEqual([]);
    expect(SAMPLE_CLIENTS).toHaveLength(4);
  });
});

describe("business dashboard rendering", () => {
  const props = { displayName: "Coach Ana", plans: [], plansError: false, canManagePlans: true };
  const render = (overrides: Partial<Parameters<typeof CoachBusinessDashboard>[0]> = {}) =>
    renderToStaticMarkup(createElement(CoachBusinessDashboard, { ...props, view: "overview", ...overrides }));

  it.each(["overview", "clients", "earnings"] as const)("discloses fictional business data on the %s view", (view) => {
    const markup = render({ view });
    expect(markup).toContain("Sample data");
    expect(markup).toContain("Clients, sales, earnings and payouts are fictional");
    expect(markup).not.toMatch(/<button[^>]*>[^<]*(Withdraw|Transfer|Pay now)/i);
  });

  it("links to existing editors while keeping real plans separate from sample sales", () => {
    const markup = render({ plans: [{ id: "my-plan", listingId: "listing", title: "My real training plan", versionNo: 2, state: "draft", weeksCount: 8, discipline: "strength" }] });
    expect(markup).toContain('href="/coaching/plans/my-plan"');
    expect(markup).toContain('href="/coaching/plans/new"');
    expect(markup).toContain('href="/coaching/clients"');
    expect(markup).toContain('href="/coaching/earnings?period=october"');
    const ownPlans = markup.slice(markup.indexOf('aria-label="Your saved plans"'));
    expect(ownPlans).toContain("My real training plan");
    expect(ownPlans).not.toContain("₱");
    expect(ownPlans).not.toContain("Dumbbell Foundation");
  });

  it("reports plan-read failures without presenting an invented zero or create-first message", () => {
    const markup = render({ plansError: true });
    expect(markup).toContain("couldn’t load your plans");
    expect(markup).not.toContain("No plans yet");
  });

  it.each(["overview", "clients", "earnings"] as const)("offers setup guidance and withholds authoring on the non-approved %s view", (view) => {
    const markup = render({ view, canManagePlans: false, plans: [{ id: "restricted", listingId: "a", title: "Hidden plan", versionNo: 1, state: "draft", weeksCount: 8, discipline: "strength" }] });
    expect(markup).toContain('href="/coaching/profile"');
    expect(markup).not.toContain('href="/coaching/plans');
    expect(markup).not.toContain("Hidden plan");
  });

  it("labels the current roster independently and provides accessible client controls", () => {
    const markup = render({ view: "clients" });
    expect(markup).toContain("October 19, 2026");
    expect(markup).toContain("independent of the reporting period");
    expect(markup).toContain('type="search"');
    expect(markup).toContain('aria-label="Search sample clients by name or plan"');
    expect(markup).toContain('aria-label="Andrea Santos sessions completed"');
    expect(markup).toContain('aria-valuenow="8"');
    expect(markup).toContain('aria-valuemax="24"');
  });

  it("renders an accessible September chart with the selected report values", () => {
    const markup = renderToStaticMarkup(createElement(EarningsChart, { report: getDashboardReport("september") }));
    expect(markup).toContain("September 2026");
    expect(markup).toContain("₱7,360");
    expect(markup).toContain("Sep 21–30");
    expect(markup).not.toContain("Oct 19");
  });

  it("keeps the initial September report in its figures and breakdown destination", () => {
    const markup = render({ initialPeriod: "september" });
    expect(markup).toContain('value="september" selected=""');
    expect(markup).toContain("₱7,360");
    expect(markup).toContain("₱4,800");
    expect(markup).toContain('href="/coaching/earnings?period=september"');
    expect(markup).not.toContain("₱10,080");
    const earnings = render({ view: "earnings", initialPeriod: "september" });
    expect(earnings).toContain("₱11,500");
    expect(earnings).toContain("₱7,360");
    expect(earnings).not.toContain("₱15,750");
  });
});

describe("own plan summaries", () => {
  const plan = (id: string, listingId: string, versionNo: number): DashboardPlan => ({
    id, listingId, versionNo, title: id, state: "draft", weeksCount: 6, discipline: "strength",
  });

  it("selects the newest numeric version per listing while retaining distinct listings with identical names", () => {
    const plans = [plan("old", "a", 2), plan("other", "b", 1), plan("latest", "a", 10)];
    plans[1].title = "old";
    expect(groupLatestDashboardPlans(plans).map(({ id }) => id)).toEqual(["latest", "other"]);
    expect(plans[0].id).toBe("old");
  });

  it("handles an empty list and does not collapse plans without listing IDs", () => {
    expect(groupLatestDashboardPlans([])).toEqual([]);
    expect(groupLatestDashboardPlans([plan("one", "", 1), plan("two", "", 1)]).map(({ id }) => id)).toEqual(["one", "two"]);
  });
});
