import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { localLoginOriginRedirect } from "./local-login-origin";

// The redirect must run before hosted Auth; reaching this boundary is a bug.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => { throw new Error("Local origin redirect initialized hosted Auth"); },
}));

afterEach(() => vi.unstubAllEnvs());

describe("opt-in local sign-in origin", () => {
  it("preserves an absolute local redirect through Next only with the explicit dev opt-in", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.resetModules();
    const { default: config } = await import("@/next.config");
    expect(config.skipProxyUrlNormalize).toBe(true);
  });

  it.each([
    ["production", "http://localhost:3000"],
    ["development", "https://kamee.fit"],
    ["development", "http://localhost:3000/path"],
    ["development", undefined],
  ])("keeps standard Next normalization outside the opt-in (%s %s)", async (mode, siteUrl) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("SITE_URL", siteUrl);
    vi.resetModules();
    const { default: config } = await import("@/next.config");
    expect(config.skipProxyUrlNormalize).toBe(false);
  });

  it("redirects the old loopback login URL before rendering its unauthorized challenge", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/login?next=%2Fcoaching%2Fprofile&error=auth", { headers: { host: "127.0.0.1:3000" } }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fcoaching%2Fprofile&error=auth");
  });

  it("keeps a coach invite path and encoded query on a HEAD redirect", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/coaching/invite/token-123?next=%2Fcoaching&x=one%20two", { method: "HEAD", headers: { host: "127.0.0.1:3000" } }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/coaching/invite/token-123?next=%2Fcoaching&x=one%20two");
  });

  it.each([
    ["production", "GET", "http://127.0.0.1:3000/login", "http://localhost:3000"],
    ["test", "GET", "http://127.0.0.1:3000/login", "http://localhost:3000"],
    ["development", "POST", "http://127.0.0.1:3000/coaching/plans", "http://localhost:3000"],
    ["development", "PUT", "http://127.0.0.1:3000/login", "http://localhost:3000"],
    ["development", "GET", "http://localhost:3000/login", "http://localhost:3000"],
    ["development", "GET", "https://kamee.fit/login", "http://localhost:3000"],
    ["development", "GET", "http://127.0.0.1:3000/login", "https://kamee.fit"],
    ["development", "GET", "http://127.0.0.1:3000/login", undefined],
    ["development", "GET", "http://127.0.0.1:3000/login", "http://localhost:3001"],
    ["development", "GET", "http://127.0.0.1:3000/login", "https://localhost:3000"],
    ["development", "GET", "http://127.0.0.1:3000/login", "http://localhost:3000/path"],
    ["development", "GET", "http://127.0.0.1:3000/login", "http://localhost:3000/?x=1"],
    ["development", "GET", "http://127.0.0.1:3000/login", "http://user@localhost:3000"],
    ["development", "GET", "http://127.0.0.1:3000/login", "http://localhost.evil.test:3000"],
    ["development", "GET", "http://127.0.0.1:3000/login", "not a URL"],
    ["development", "GET", "http://127.0.0.1:3000/api/plans", "http://localhost:3000"],
    ["development", "GET", "http://127.0.0.1:3000/_next/static/app.js", "http://localhost:3000"],
    ["development", "GET", "http://127.0.0.1:3000/coaching/assets/avatar.png", "http://localhost:3000"],
    ["development", "GET", "http://127.0.0.1:3000/coaching-other", "http://localhost:3000"],
  ])("leaves an unsafe or unrelated request unchanged (%s %s %s %s)", (mode, method, url, siteUrl) => {
    expect(localLoginOriginRedirect(url, method, mode, siteUrl)).toBeNull();
  });

  it("uses an explicitly configured matching nondefault local port", () => {
    expect(localLoginOriginRedirect("http://127.0.0.1:4100/coaching/profile?tab=gallery", "GET", "development", "http://localhost:4100")?.href)
      .toBe("http://localhost:4100/coaching/profile?tab=gallery");
  });
});
