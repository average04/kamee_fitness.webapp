import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireCoach } = vi.hoisted(() => ({ requireCoach: vi.fn() }));
vi.mock("@/lib/coaching/auth", () => ({ requireCoach }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import CoachingIndexPage from "@/app/coaching/page";

describe("coach workspace entry", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("opens Overview for approved coaches", async () => {
    requireCoach.mockResolvedValue({ status: "approved" });
    await expect(CoachingIndexPage()).rejects.toThrow("redirect:/coaching/dashboard");
    expect(requireCoach).toHaveBeenCalledOnce();
  });
  it.each(["onboarding", "in_review", "changes_requested", "suspended"])(
    "preserves profile setup for %s", async (status) => {
      requireCoach.mockResolvedValue({ status });
      await expect(CoachingIndexPage()).rejects.toThrow("redirect:/coaching/profile");
    },
  );
});
