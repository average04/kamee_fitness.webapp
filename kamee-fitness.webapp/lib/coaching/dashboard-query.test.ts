import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCoach: vi.fn(),
  from: vi.fn(),
  profileEq: vi.fn(),
  profileResult: vi.fn(),
  planEq: vi.fn(),
  planResult: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/coaching/auth", () => ({ requireCoach: mocks.requireCoach }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({ from: mocks.from }) }));

import { loadCoachDashboard } from "./dashboard-query";

describe("coach dashboard data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCoach.mockResolvedValue({ user: { id: "my-coach" }, status: "approved" });
    mocks.profileResult.mockResolvedValue({ data: { display_name: "Coach Jay" }, error: null });
    mocks.profileEq.mockReturnValue({ maybeSingle: mocks.profileResult });
    const plans = { eq: mocks.planEq, order: mocks.planResult };
    mocks.planEq.mockReturnValue(plans);
    mocks.planResult.mockResolvedValue({ data: [{
      id: "version-2", listing_id: "listing", title: "My own plan", version_no: 2,
      version_state: "draft", weeks_count: 8, discipline: "strength",
    }], error: null });
    mocks.from.mockImplementation((table: string) => ({ select: () => table === "profiles" ? { eq: mocks.profileEq } : plans }));
  });

  it("checks the coach session before loading any account data", async () => {
    mocks.requireCoach.mockRejectedValue(new Error("redirect to login"));
    await expect(loadCoachDashboard()).rejects.toThrow("redirect to login");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("loads only the signed-in coach's plans and profile", async () => {
    const data = await loadCoachDashboard();
    expect(mocks.profileEq).toHaveBeenCalledWith("id", "my-coach");
    expect(mocks.planEq).toHaveBeenCalledWith("author_id", "my-coach");
    expect(mocks.planEq).toHaveBeenCalledWith("kind", "coach");
    expect(data).toMatchObject({ displayName: "Coach Jay", canManagePlans: true, plansError: false, plans: [{
      id: "version-2", listingId: "listing", title: "My own plan", versionNo: 2,
      state: "draft", weeksCount: 8, discipline: "strength",
    }] });
  });

  it.each(["onboarding", "in_review", "changes_requested", "suspended"])(
    "keeps %s coaches out of the plan-authoring data path", async (status) => {
      mocks.requireCoach.mockResolvedValue({ user: { id: "my-coach" }, status });
      const data = await loadCoachDashboard();
      expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["profiles"]);
      expect(data).toMatchObject({ canManagePlans: false, plans: [], plansError: false });
    },
  );

  it("reports plan-read failure rather than pretending the coach has no plans", async () => {
    mocks.planResult.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect(await loadCoachDashboard()).toMatchObject({ plansError: true, plans: [] });
  });

  it("fails honestly when the account profile cannot be read", async () => {
    mocks.profileResult.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(loadCoachDashboard()).rejects.toThrow("Could not load your coach account");
  });
});
