import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { getUser, maybeSingle, eq } = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser }, from: () => ({ select: () => ({ eq }) }) }),
}));
import { getSignInDestination } from "./landing";

describe("default sign-in destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_EMAILS", "admin@kamee.local");
    eq.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: { role: "user", coach_status: "none" }, error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("routes an authenticated allowlisted admin to the dashboard", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "admin@kamee.local" } }, error: null });
    expect(await getSignInDestination()).toBe("/admin");
  });
  it("keeps ordinary members on their stats page", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "member@kamee.local" } }, error: null });
    expect(await getSignInDestination()).toBe("/me");
  });
  it("requires a verified session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getSignInDestination()).toBe("/login");
  });
  it.each(["onboarding", "in_review", "changes_requested", "approved", "suspended"])("routes %s coaches to onboarding", async (status) => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: status }, error: null });
    expect(await getSignInDestination()).toBe("/coaching/profile");
    expect(eq).toHaveBeenCalledWith("id", "coach-id");
  });
  it("routes invited coaches to acceptance", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: "invited" }, error: null });
    expect(await getSignInDestination()).toBe("/coaching/invite");
  });
  it.each(["revoked", "none"])("does not route %s accounts into the hub", async (status) => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: status }, error: null });
    expect(await getSignInDestination()).toBe("/me");
  });
  it("fails closed when the auth service rejects the session", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "admin@kamee.local" } }, error: new Error("invalid") });
    expect(await getSignInDestination()).toBe("/login");
  });
});
