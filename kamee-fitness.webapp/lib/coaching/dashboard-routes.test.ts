import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/coaching/dashboard-query", () => ({
  loadCoachDashboard: async () => ({ displayName: "Coach Jay", plans: [], plansError: false, canManagePlans: true }),
}));
vi.mock("@/components/coaching/dashboard/CoachBusinessDashboard", () => ({ CoachBusinessDashboard: () => null }));
import CoachEarningsPage from "@/app/coaching/(hub)/earnings/page";

describe("earnings report navigation", () => {
  it("opens the report selected by View breakdown", async () => {
    const page = await CoachEarningsPage({ searchParams: Promise.resolve({ period: "september" }) });
    expect(page.props.initialPeriod).toBe("september");
    expect(page.props.view).toBe("earnings");
  });
  it.each([{}, { period: "unknown" }, { period: ["september", "october"] }])(
    "normalizes absent or invalid report parameters safely", async (params) => {
      const page = await CoachEarningsPage({ searchParams: Promise.resolve(params) });
      expect(page.props.initialPeriod).toBe("october");
    },
  );
});
