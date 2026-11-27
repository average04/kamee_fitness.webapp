import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
const m = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({
  auth: { getUser: m.getUser },
  from: (table: string) => { if (table !== "profiles") throw new Error("Unexpected table"); return { select: (columns: string) => { if (columns !== "role, coach_status") throw new Error("Unexpected columns"); return { eq: m.eq }; } }; },
}) }));
import { getPortalSession } from "./portal-session";
import { requireAdmin } from "@/lib/admin/auth";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", "admin@kamee.local");
  m.getUser.mockResolvedValue({ data: { user: { id: "own-user", email: "member@kamee.local", user_metadata: { role: "admin" } } }, error: null });
  m.eq.mockImplementation((column, value) => { if (column !== "id" || value !== "own-user") throw new Error("Read another account"); return { maybeSingle: m.profile }; });
  m.profile.mockResolvedValue({ data: { role: "user", coach_status: "none" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("verified portal capabilities", () => {
  it.each([
    ["user", "approved", false, "/me"],
    ["admin", "approved", false, "/me"],
    ["coach", "approved", true, "/coaching/dashboard"],
    ["coach", "onboarding", true, "/coaching/profile"],
    ["coach", "in_review", true, "/coaching/profile"],
    ["coach", "changes_requested", true, "/coaching/profile"],
    ["coach", "suspended", true, "/coaching/profile"],
    ["coach", "revoked", false, "/me"],
    ["coach", "none", false, "/me"],
    ["coach", "unknown", false, "/me"],
    ["user", "invited", false, "/coaching/invite"],
  ])("derives %s/%s capabilities from the verified user's own profile", async (role, status, hub, destination) => {
    m.profile.mockResolvedValue({ data: { role, coach_status: status }, error: null });
    const session = await getPortalSession();
    expect(session).toMatchObject({ isAdmin: false, canUseCoachHub: hub, defaultDestination: destination });
  });
  it("uses the allowlist for admins even when the profile role is ordinary", async () => {
    m.getUser.mockResolvedValue({ data: { user: { id: "own-user", email: "admin@kamee.local" } }, error: null });
    expect(await getPortalSession()).toMatchObject({ isAdmin: true, profileRole: "user", defaultDestination: "/admin" });
  });
  it("returns no capabilities for a stale returned user rejected by Auth", async () => {
    m.getUser.mockResolvedValue({ data: { user: { id: "own-user", email: "admin@kamee.local" } }, error: new Error("revoked") });
    expect(await getPortalSession()).toBeNull();
    expect(m.profile).not.toHaveBeenCalled();
  });
  it("never returns guessed capabilities from a failed own-profile read", async () => {
    m.profile.mockResolvedValue({ data: { role: "coach", coach_status: "approved" }, error: new Error("private provider detail") });
    await expect(getPortalSession()).rejects.toThrow("Could not load your account. Please retry.");
  });
});

describe("real administration gate", () => {
  it("routes a signed-in member to their role resolver", async () => {
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/auth/landing");
  });
  it("fails closed when Auth supplies a user with an error", async () => {
    m.getUser.mockResolvedValue({ data: { user: { id: "own-user", email: "admin@kamee.local" } }, error: new Error("invalid") });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("keeps allowlist authorization independent of profile availability", async () => {
    const user = { id: "own-user", email: "admin@kamee.local" };
    m.getUser.mockResolvedValue({ data: { user }, error: null });
    m.profile.mockRejectedValue(new Error("unavailable"));
    expect(await requireAdmin()).toEqual(user);
    expect(m.profile).not.toHaveBeenCalled();
  });
});
