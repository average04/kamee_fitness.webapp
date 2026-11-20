import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@next/mdx", () => ({ default: () => (config: unknown) => config }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function buildExposure(values: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries({
    CONTEXT: "", KAMEE_COACHING_PREVIEW: "", KAMEE_COACHING_LOCAL_QA: "",
    SITE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_COACHING_EXPOSURE: "preview", ...values,
  })) vi.stubEnv(key, value);
  const { default: config } = await import("../../../next.config");
  return config.env?.NEXT_PUBLIC_COACHING_EXPOSURE;
}

describe("coaching Preview exposure at build time", () => {
  it("allows an explicitly enabled Netlify deploy Preview", async () => {
    expect(await buildExposure({ CONTEXT: "deploy-preview", KAMEE_COACHING_PREVIEW: "true" })).toBe("preview");
  });
  it("defaults off and ignores an injected public exposure override", async () => {
    expect(await buildExposure()).toBe("off");
    expect(await buildExposure({ CONTEXT: "deploy-preview" })).toBe("off");
  });
  it.each(["production", "branch-deploy", "preview", "DEPLOY-PREVIEW", "unknown"])("keeps hosted %s off even with local flags", async context => {
    expect(await buildExposure({ CONTEXT: context, KAMEE_COACHING_PREVIEW: "true", KAMEE_COACHING_LOCAL_QA: "true",
      SITE_URL: "http://localhost:3082", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54840" })).toBe("off");
  });
  it("requires an explicit isolated local QA opt-in and two loopback endpoints", async () => {
    const local = { KAMEE_COACHING_PREVIEW: "true", KAMEE_COACHING_LOCAL_QA: "true", SITE_URL: "http://localhost:3082", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54840" };
    expect(await buildExposure(local)).toBe("preview");
    expect(await buildExposure({ ...local, KAMEE_COACHING_LOCAL_QA: "" })).toBe("off");
    expect(await buildExposure({ ...local, KAMEE_COACHING_PREVIEW: "false" })).toBe("off");
    expect(await buildExposure({ ...local, SITE_URL: "https://kamee.fit" })).toBe("off");
    expect(await buildExposure({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toBe("off");
  });
  it.each(["http://localhost.evil.test:3082", "http://user@localhost:3082", "http://localhost:3082/path", "http://localhost:3082/?query=1", "http://localhost:3082/#fragment", "file:///localhost", "not a URL"])("rejects a non-bare loopback endpoint: %s", async endpoint => {
    const local = { KAMEE_COACHING_PREVIEW: "true", KAMEE_COACHING_LOCAL_QA: "true", SITE_URL: "http://localhost:3082", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54840" };
    expect(await buildExposure({ ...local, SITE_URL: endpoint })).toBe("off");
    expect(await buildExposure({ ...local, NEXT_PUBLIC_SUPABASE_URL: endpoint })).toBe("off");
  });
  it("exposes only the sanitized public value to participant modules", async () => {
    vi.stubEnv("NEXT_PUBLIC_COACHING_EXPOSURE", "preview");
    vi.resetModules();
    expect((await import("./flags")).COACHING_CONVERSATIONS_ENABLED).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_COACHING_EXPOSURE", "off");
    vi.resetModules();
    expect((await import("./flags")).COACHING_CONVERSATIONS_ENABLED).toBe(false);
  });
});
