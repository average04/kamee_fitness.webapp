import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  getUser: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.server,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: mocks.client }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    unstable_rethrow: actual.unstable_rethrow,
    redirect: (path: string) => {
      throw Object.assign(new Error(`redirect:${path}`), {
        digest: `NEXT_REDIRECT;replace;${path};307;`,
      });
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { setCoachStatus } from "./actions";

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COACH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EMAIL = "c1b-operator@fixtures.invalid";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubEnv("ADMIN_EMAILS", EMAIL);
  mocks.server.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: ACTOR, email: EMAIL } },
    error: null,
  });
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("coach status caller busy retry", () => {
  it("preserves the framework login redirect when verified Auth disappears during status backoff", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "55P03" } });
    const pending = setCoachStatus(COACH, "suspended", "").then(value => ({ value }), error => ({ error }));
    await vi.advanceTimersByTimeAsync(0);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await vi.runAllTimersAsync();
    const outcome = await pending;
    expect("error" in outcome && outcome.error instanceof Error && outcome.error.message).toBe("redirect:/admin/login");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("preserves the original status RPC arguments and invalidation on success", async () => {
    expect(await setCoachStatus(COACH, "suspended", " reviewed ")).toEqual({
      ok: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_coach_status", {
      p_user: COACH,
      p_actor: ACTOR,
      p_status: "suspended",
      p_note: "reviewed",
    });
    expect(mocks.revalidate.mock.calls).toEqual([
      [`/admin/coaches/${COACH}`],
      ["/admin/coaches"],
    ]);
  });

  it("runs the actual admin gate before constructing a service client", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: ACTOR, email: "member@fixtures.invalid" } },
      error: null,
    });
    await expect(setCoachStatus(COACH, "suspended", "")).rejects.toThrow(
      "redirect:/admin/login",
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("retries rolled-back busy status writes twice with the same target, actor, status and note", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ error: { code: "55P03" } })
      .mockResolvedValueOnce({ error: { code: "PT503" } })
      .mockResolvedValue({ error: null });
    const result = setCoachStatus(COACH, "suspended", "reviewed");
    await vi.advanceTimersByTimeAsync(99);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(300);
    expect(await result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
    expect(mocks.rpc.mock.calls[2]).toEqual(mocks.rpc.mock.calls[0]);
    expect(mocks.getUser).toHaveBeenCalledTimes(4);
  });

  it("stops before another service write when the actor changes during backoff", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "55P03" } });
    const result = setCoachStatus(COACH, "suspended", "");
    await vi.advanceTimersByTimeAsync(0);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: OTHER, email: EMAIL } },
      error: null,
    });
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ ok: false });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("caps repeated busy failures without claiming a status change", async () => {
    mocks.rpc.mockResolvedValue({
      error: { code: "55P03", message: "private lock detail" },
    });
    const result = setCoachStatus(COACH, "revoked", "");
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({ ok: false });
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each(["PT403", "PT409", "57014", "ETIMEDOUT"])(
    "does not retry %s",
    async (code) => {
      mocks.rpc.mockResolvedValue({
        error: { code, message: "private detail" },
      });
      expect(await setCoachStatus(COACH, "approved", "")).toEqual({
        ok: false,
        error: "Something went wrong. Please try again.",
      });
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it("does not retry a thrown transport error with unknown commit", async () => {
    mocks.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await setCoachStatus(COACH, "approved", "")).toMatchObject({
      ok: false,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
