import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));

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
  it.each(["onboarding", "in_review", "changes_requested", "suspended"])("routes %s coaches to onboarding", async (status) => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: status }, error: null });
    expect(await getSignInDestination()).toBe("/coaching/profile");
    expect(eq).toHaveBeenCalledWith("id", "coach-id");
  });
  it("routes approved coaches to their business overview", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: "approved" }, error: null });
    expect(await getSignInDestination()).toBe("/coaching/dashboard");
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
  it.each([
    ["/admin", "/me"],
    ["/admin/coaches?status=pending#account", "/me"],
    ["/coaching/dashboard", "/me"],
    ["/auth/landing?next=/admin", "/me"],
    ["/auth/callback?code=old", "/me"],
    ["/login?next=/admin", "/me"],
    ["/admin/login", "/me"],
    ["https://evil.example/me", "/me"],
    ["/\\evil.example", "/me"],
    ["/me/records?range=month#personal-best", "/me/records?range=month#personal-best"],
    ["/coaching/invite/token?source=email#accept", "/coaching/invite/token?source=email#accept"],
    ["/coaching/terms?version=2#terms", "/coaching/terms?version=2#terms"],
    ["/delete-account?confirm=1#delete", "/delete-account?confirm=1#delete"],
  ])("resolves member continuation %s to %s", async (next, expected) => {
    getUser.mockResolvedValue({ data: { user: { id: "member-id", email: "member@kamee.local" } }, error: null });
    expect(await getSignInDestination(next, "https://kamee.fit")).toBe(expected);
  });
  it("preserves an approved coach's plan continuation", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: "approved" }, error: null });
    expect(await getSignInDestination("/coaching/plans/plan-id?edit=1#weeks", "https://kamee.fit")).toBe("/coaching/plans/plan-id?edit=1#weeks");
  });
  it("sends a nonapproved coach's private workspace continuation to their profile", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "coach-id", email: "coach@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: "onboarding" }, error: null });
    expect(await getSignInDestination("/coaching/plans/plan-id?edit=1", "https://kamee.fit")).toBe("/coaching/profile");
  });
  it("does not trust admin profile role or user metadata for administration", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "member-id", email: "member@kamee.local", user_metadata: { role: "admin" } } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "admin", coach_status: "approved" }, error: null });
    expect(await getSignInDestination("/admin", "https://kamee.fit")).toBe("/me");
  });
  it("fails closed on profile read errors instead of guessing a role", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "member-id", email: "member@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "coach", coach_status: "approved" }, error: new Error("database unavailable") });
    await expect(getSignInDestination("/admin", "https://kamee.fit")).rejects.toThrow("Could not load your account");
  });
  it("preserves the existing invited-user lifecycle before coach-role acceptance", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "invited-id", email: "invited@kamee.local" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: "user", coach_status: "invited" }, error: null });
    expect(await getSignInDestination()).toBe("/coaching/invite");
  });
});
