import { beforeEach, describe, expect, it, vi } from "vitest";
import { HUB_STATES } from "./states";
vi.mock("server-only", () => ({}));

// React's `cache()` memoizes per render-request via AsyncLocalStorage in
// Next.js; outside that context (plain vitest) it would just memoize forever
// on the first call, since getCoachSession takes no arguments. Mock it to
// identity so each test's mocked Supabase response is actually read.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

// vi.mock factories are hoisted above this file's own top-level statements,
// so any state they close over must come from vi.hoisted() rather than a
// plain `let` (which would still be in its temporal dead zone).
const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as { role: string; coach_status: string } | null,
  authError: null as Error | null,
  profileError: null as Error | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mocks.user }, error: mocks.authError }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.profile, error: mocks.profileError }),
        }),
      }),
    }),
  }),
}));

const { requireCoach } = await import("./auth");

async function expectRedirect(p: Promise<unknown>, url: string) {
  await expect(p).rejects.toThrow(`REDIRECT:${url}`);
}

beforeEach(() => {
  mocks.user = null;
  mocks.profile = null;
  mocks.authError = null;
  mocks.profileError = null;
});

describe("requireCoach", () => {
  it("redirects signed-out users to /login?next=/coaching", async () => {
    mocks.user = null;
    await expectRedirect(requireCoach(), "/login?next=/coaching");
  });

  it("redirects an invited user to /coaching/invite when 'invited' is not in the allow-list", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "user", coach_status: "invited" };
    await expectRedirect(requireCoach(), "/coaching/invite");
  });

  it("returns for an invited user when the caller explicitly allows 'invited'", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "user", coach_status: "invited" };
    await expect(requireCoach(["invited"])).resolves.toEqual({
      user: mocks.user,
      status: "invited",
    });
  });

  for (const state of HUB_STATES) {
    it(`returns for a coach in hub state '${state}' (default allow-list)`, async () => {
      mocks.user = { id: "u1" };
      mocks.profile = { role: "coach", coach_status: state };
      await expect(requireCoach()).resolves.toEqual({
        user: mocks.user,
        status: state,
      });
    });
  }

  it("redirects a coach with a revoked status to their member landing", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "coach", coach_status: "revoked" };
    await expectRedirect(requireCoach(), "/auth/landing");
  });

  it("redirects a non-coach role even with an in-hub status to their own landing", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "user", coach_status: "onboarding" };
    await expectRedirect(requireCoach(), "/auth/landing");
  });

  it("redirects to the role landing when the allow-list excludes the current state", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "coach", coach_status: "approved" };
    await expectRedirect(requireCoach(["onboarding"]), "/auth/landing");
  });
  it.each(["onboarding", "in_review", "changes_requested", "suspended"])("keeps %s coaches out of approved-only routes while returning them to setup", async (status) => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "coach", coach_status: status };
    await expectRedirect(requireCoach(["approved"]), "/auth/landing");
  });
  it("rejects a returned user when Auth verification also reports an error", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "coach", coach_status: "approved" };
    mocks.authError = new Error("invalid session");
    await expectRedirect(requireCoach(), "/login?next=/coaching");
  });
  it("fails closed when a profile response contains an error and privileged data", async () => {
    mocks.user = { id: "u1" };
    mocks.profile = { role: "coach", coach_status: "approved" };
    mocks.profileError = new Error("profile unavailable");
    await expect(requireCoach()).rejects.toThrow("Could not load your account");
  });
});
