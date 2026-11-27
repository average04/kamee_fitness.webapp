import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
const m = vi.hoisted(() => ({ user: null as { id: string; email: string } | null, error: null as Error | null, exchange: vi.fn(), profile: { role: "user", coach_status: "none" } }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: async () => ({
  auth: { getUser: async () => ({ data: { user: m.user }, error: m.error }), exchangeCodeForSession: m.exchange },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: m.profile, error: null }) }) }) }),
}) }));
import { GET } from "@/app/auth/callback/route";
import Landing from "@/app/auth/landing/page";
import AdminLogin from "@/app/admin/login/page";
import Login from "@/app/login/page";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ADMIN_EMAILS", "admin@kamee.fit"); m.user = null; m.error = null; m.profile = { role: "user", coach_status: "none" }; m.exchange.mockResolvedValue({ data: { user: null, session: null }, error: null }); });
afterEach(() => vi.unstubAllEnvs());
describe("PKCE completion", () => {
  it("passes explicit admin-next through the role resolver after exchange", async () => {
    const response = await GET(new NextRequest("https://kamee.fit/auth/callback?code=pkce-code&next=%2Fadmin"));
    expect(m.exchange).toHaveBeenCalledWith("pkce-code");
    expect(response.headers.get("location")).toBe("https://kamee.fit/auth/landing?next=%2Fadmin");
  });
  it("uses a role-aware default instead of an admin default without next", async () => {
    const response = await GET(new NextRequest("https://kamee.fit/auth/callback?code=pkce-code"));
    expect(response.headers.get("location")).toBe("https://kamee.fit/auth/landing");
  });
  it("preserves safe invitation query and fragment context", async () => {
    const response = await GET(new NextRequest("https://kamee.fit/auth/callback?code=pkce-code&next=%2Fcoaching%2Finvite%2Ftoken%3Fsource%3Demail%23accept"));
    expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe("/coaching/invite/token?source=email#accept");
  });
  it.each(["https://evil.example", "/auth/landing?next=/admin", "/login"])("drops unsafe or looping next %s", async (next) => {
    const response = await GET(new NextRequest(`https://kamee.fit/auth/callback?code=pkce-code&next=${encodeURIComponent(next)}`));
    expect(response.headers.get("location")).toBe("https://kamee.fit/auth/landing");
  });
  it("keeps valid continuation when exchange fails and shows the common form", async () => {
    m.exchange.mockResolvedValue({ data: { user: null, session: null }, error: new Error("expired") });
    const response = await GET(new NextRequest("https://kamee.fit/auth/callback?code=expired&next=%2Fdelete-account%3Ffrom%3Demail"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth");
    expect(location.searchParams.get("next")).toBe("/delete-account?from=email");
  });
});
describe("server sign-in entry points", () => {
  it("resolves a coach's explicit unauthorized admin-next to their dashboard", async () => {
    m.user = { id: "coach-id", email: "coach@kamee.fit" }; m.profile = { role: "coach", coach_status: "approved" };
    await expect(Landing({ searchParams: Promise.resolve({ next: "/admin" }) })).rejects.toThrow("REDIRECT:/coaching/dashboard");
  });
  it("preserves an anonymous landing visitor's invitation for sign-in", async () => {
    await expect(Landing({ searchParams: Promise.resolve({ next: "/coaching/invite/token?source=email#accept" }) })).rejects.toThrow("REDIRECT:/login?next=%2Fcoaching%2Finvite%2Ftoken%3Fsource%3Demail%23accept");
  });
  it("redirects an already signed-in member away from admin-login errors", async () => {
    m.user = { id: "member-id", email: "member@kamee.fit" };
    await expect(AdminLogin({ searchParams: Promise.resolve({ error: "not-authorized" }) })).rejects.toThrow("REDIRECT:/me");
  });
  it("preserves anonymous admin deep links through the shared form", async () => {
    await expect(AdminLogin({ searchParams: Promise.resolve({ next: "/admin/coaches?status=pending#account" }) })).rejects.toThrow("REDIRECT:/login?next=%2Fadmin%2Fcoaches%3Fstatus%3Dpending%23account");
  });
  it("routes an existing coach session from the shared login to their own dashboard", async () => {
    m.user = { id: "coach-id", email: "coach@kamee.fit" }; m.profile = { role: "coach", coach_status: "approved" };
    await expect(Login({ searchParams: Promise.resolve({ next: "/admin", error: "not-authorized" }) })).rejects.toThrow("REDIRECT:/coaching/dashboard");
  });
});
