import { describe, expect, it } from "vitest";
import { buildWeightSeries } from "./weight";

describe("buildWeightSeries", () => {
  it("builds a series with current + goal delta", () => {
    const out = buildWeightSeries(
      [
        { weight_kg: 65, logged_at: "2026-05-01T00:00:00Z" },
        { weight_kg: 63, logged_at: "2026-06-01T00:00:00Z" },
      ],
      { target_weight_kg: 60 } as never,
    );
    expect(out.points).toHaveLength(2);
    expect(out.currentKg).toBe(63);
    expect(out.targetKg).toBe(60);
    expect(out.toGoKg).toBe(3);
  });
  it("handles empty log", () => {
    const out = buildWeightSeries([], { target_weight_kg: null } as never);
    expect(out.currentKg).toBeNull();
    expect(out.toGoKg).toBeNull();
  });
});
