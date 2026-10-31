import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCoachingSpecialtyOptions } from "./specialty-options-query";

const { rpc, createServerSupabase } = vi.hoisted(() => ({
  rpc: vi.fn(), createServerSupabase: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase }));

beforeEach(() => {
  vi.resetAllMocks();
  createServerSupabase.mockResolvedValue({ rpc });
});

describe("loadCoachingSpecialtyOptions", () => {
  it("returns the authoritative order and strings from the cookie-bound server client", async () => {
    rpc.mockResolvedValue({ data: ["Endurance", "Running"], error: null });
    expect(await loadCoachingSpecialtyOptions()).toEqual({ options: ["Endurance", "Running"], error: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("coaching_specialty_options");
  });

  it("reports a retryable failure instead of inventing presets on an RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function not deployed" } });
    expect(await loadCoachingSpecialtyOptions()).toEqual({ options: [], error: expect.stringMatching(/retry/i) });
  });

  it.each([
    { data: null }, { data: [] }, { data: "Running" }, { data: [""] },
    { data: ["x".repeat(161)] }, { data: ["Running", 1] }, { data: ["Running", " running "] },
  ])(
    "refuses malformed options $data without a fallback", async ({ data }) => {
      rpc.mockResolvedValue({ data, error: null });
      expect(await loadCoachingSpecialtyOptions()).toEqual({ options: [], error: expect.any(String) });
    },
  );

  it("isolates rejected requests so the rest of the profile can still load", async () => {
    rpc.mockRejectedValue(new Error("network unavailable"));
    expect(await loadCoachingSpecialtyOptions()).toEqual({ options: [], error: expect.any(String) });
  });
});
