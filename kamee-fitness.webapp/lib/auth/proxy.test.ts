import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ user: null as { id: string; email: string } | null, error: null as Error | null, cookieBatches: 1 }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[]) => void } }) => ({
  auth: { getUser: async () => {
    for (let i = 0; i < m.cookieBatches; i++) options.cookies.setAll([{ name: `sb-session-${i}`, value: `refreshed-${i}`, options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } }]);
    return { data: { user: m.user }, error: m.error };
  } },
}) }));
import { proxy } from "@/proxy";
beforeEach(() => { m.user = null; m.error = null; m.cookieBatches = 1; vi.stubEnv("ADMIN_EMAILS", "admin@kamee.fit"); });
afterEach(() => vi.unstubAllEnvs());
describe("portal proxy redirect and session handoff", () => {
  it("routes a verified nonadmin to role resolution without a profile query", async () => {
    m.user = { id: "coach-id", email: "coach@kamee.fit" };
    const response = await proxy(new NextRequest("https://kamee.fit/admin/coaches?status=pending"));
    expect(response.headers.get("location")).toBe("https://kamee.fit/auth/landing");
    expect(response.cookies.get("sb-session-0")?.value).toBe("refreshed-0");
    expect(response.cookies.get("sb-session-0")?.httpOnly).toBe(true);
  });
  it.each([
    ["/admin/coaches?status=pending", "/admin/login", "/admin/coaches?status=pending"],
    ["/me/records?range=month", "/login", "/me/records?range=month"],
    ["/coaching/plans/plan-id?tab=weeks", "/login", "/coaching/plans/plan-id?tab=weeks"],
  ])("preserves the intended %s continuation and every refreshed cookie", async (path, login, continuation) => {
    m.cookieBatches = 2;
    const response = await proxy(new NextRequest(`https://kamee.fit${path}`));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe(login);
    expect(destination.searchParams.get("next")).toBe(continuation);
    expect(response.cookies.get("sb-session-0")?.value).toBe("refreshed-0");
    expect(response.cookies.get("sb-session-1")?.value).toBe("refreshed-1");
  });
  it("fails closed when an Auth error accompanies an allowlisted user", async () => {
    m.user = { id: "admin-id", email: "admin@kamee.fit" };
    m.error = new Error("invalid session");
    const response = await proxy(new NextRequest("https://kamee.fit/admin"));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });
  it.each(["/coaching/invite", "/coaching/invite/token?source=email", "/coaching/terms", "/delete-account"])("keeps %s public", async (path) => {
    const response = await proxy(new NextRequest(`https://kamee.fit${path}`));
    expect(response.headers.get("location")).toBeNull();
  });
  it("leaves plan Server Actions to their structured session-expiry gate", async () => {
    const response = await proxy(new NextRequest("https://kamee.fit/coaching/plans/plan-id", { method: "POST", headers: { "next-action": "action-id" } }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("sb-session-0")?.value).toBe("refreshed-0");
  });
});
