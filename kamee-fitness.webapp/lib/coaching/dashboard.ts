/** Real, owner-filtered plan metadata. Never used to derive the sample business reports. */
export type DashboardPlan = {
  id: string;
  listingId: string;
  title: string;
  versionNo: number;
  state: string;
  weeksCount: number;
  discipline: string;
};

export type DashboardView = "overview" | "clients" | "earnings";
export type DashboardPeriod = "october" | "september";
export type ClientFilter = "all" | "attention";
export type SampleClient = {
  id: string;
  name: string;
  initials: string;
  plan: string;
  week: number;
  weeks: number;
  completed: number;
  sessions: number;
  status: "On track" | "Behind" | "Not started";
  activity: string;
  note: string;
};

export type SampleReport = {
  period: DashboardPeriod;
  name: string;
  range: string;
  clients: number;
  purchases: number;
  gross: number;
  fees: number;
  net: number;
  coach: number;
  kamee: number;
  eligible: number;
  pending: number;
  bars: readonly { label: string; amount: number }[];
  sales: readonly { title: string; price: number; count: number }[];
};

/** Fixed fictional roster; deliberately independent of the reporting month. */
export const SAMPLE_ROSTER_DATE = "October 19, 2026";
export const SAMPLE_ROSTER_TOTAL = 24;
export const SAMPLE_CLIENTS: readonly SampleClient[] = [
  { id: "andrea", name: "Andrea Santos", initials: "AS", plan: "Dumbbell Foundation", week: 3, weeks: 8, completed: 8, sessions: 24, status: "On track", activity: "Today", note: "Most recent workout: Full-body strength A." },
  { id: "miguel", name: "Miguel Cruz", initials: "MC", plan: "Run-Walk Foundation", week: 2, weeks: 6, completed: 3, sessions: 18, status: "Behind", activity: "4 days ago", note: "No workout logged in the past four days." },
  { id: "bianca", name: "Bianca Lim", initials: "BL", plan: "Dumbbell Foundation", week: 5, weeks: 8, completed: 14, sessions: 24, status: "On track", activity: "Yesterday", note: "Most recent workout: Full-body strength B." },
  { id: "paolo", name: "Paolo Reyes", initials: "PR", plan: "Run-Walk Foundation", week: 1, weeks: 6, completed: 0, sessions: 18, status: "Not started", activity: "Joined Oct 18", note: "The first workout is ready to start. No workouts logged yet." },
];

const REPORTS: Record<DashboardPeriod, SampleReport> = {
  october: {
    period: "october", name: "October 2026", range: "Oct 1–19 · month to date",
    clients: 24, purchases: 18, gross: 15750, fees: 3150, net: 12600,
    coach: 10080, kamee: 2520, eligible: 6720, pending: 3360,
    bars: [{ label: "Oct 1–4", amount: 1120 }, { label: "Oct 5–11", amount: 2240 }, { label: "Oct 12–18", amount: 3840 }, { label: "Oct 19", amount: 2880 }],
    sales: [{ title: "Dumbbell Foundation", price: 750, count: 9 }, { title: "Run-Walk Foundation", price: 1000, count: 9 }],
  },
  september: {
    period: "september", name: "September 2026", range: "Sep 1–30 · full month",
    clients: 20, purchases: 13, gross: 11500, fees: 2300, net: 9200,
    coach: 7360, kamee: 1840, eligible: 4800, pending: 2560,
    bars: [{ label: "Sep 1–6", amount: 1120 }, { label: "Sep 7–13", amount: 1600 }, { label: "Sep 14–20", amount: 1920 }, { label: "Sep 21–30", amount: 2720 }],
    sales: [{ title: "Dumbbell Foundation", price: 750, count: 6 }, { title: "Run-Walk Foundation", price: 1000, count: 7 }],
  },
};

export function getDashboardReport(period: string): SampleReport {
  return REPORTS[period === "september" ? "september" : "october"];
}

export function filterSampleClients(clients: readonly SampleClient[], query: string, filter: ClientFilter): SampleClient[] {
  const text = query.trim().toLocaleLowerCase("en-PH");
  return clients.filter((client) =>
    (filter === "all" || client.status !== "On track") &&
    (!text || client.name.toLocaleLowerCase("en-PH").includes(text) || client.plan.toLocaleLowerCase("en-PH").includes(text)),
  );
}

export function groupLatestDashboardPlans(plans: readonly DashboardPlan[]): DashboardPlan[] {
  const latest = new Map<string, DashboardPlan>();
  for (const plan of plans) {
    const key = plan.listingId || plan.id;
    const previous = latest.get(key);
    if (!previous || plan.versionNo > previous.versionNo) latest.set(key, plan);
  }
  return [...latest.values()];
}

export function formatDashboardMoney(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
