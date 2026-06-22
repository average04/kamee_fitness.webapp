import { describe, expect, it } from "vitest";
import { routeToPolyline } from "./route";

describe("routeToPolyline", () => {
  it("returns empty for too-few points", () => {
    expect(routeToPolyline([], 100)).toBe("");
    expect(routeToPolyline([{ lat: 1, lng: 1 }], 100)).toBe("");
  });
  it("normalizes lat/lng into the box", () => {
    const pts = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
    ];
    const out = routeToPolyline(pts, 100);
    expect(out.split(" ")).toHaveLength(2);
    for (const pair of out.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
});
