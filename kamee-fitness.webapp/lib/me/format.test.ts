import { describe, expect, it } from "vitest";
import {
  fmtDistance,
  fmtDuration,
  fmtPaceFromMeters,
  fmtWeight,
} from "./units";
import { parseRange, withinRange } from "./range";

describe("units", () => {
  it("formats weight per unit system", () => {
    expect(fmtWeight(60, "metric")).toBe("60 kg");
    expect(fmtWeight(100, "imperial")).toBe("220 lb");
  });
  it("formats distance per unit system", () => {
    expect(fmtDistance(5000, "metric")).toBe("5.0 km");
    expect(fmtDistance(1609.34, "imperial")).toBe("1.0 mi");
  });
  it("formats duration h/m/s", () => {
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(90)).toBe("1m");
    expect(fmtDuration(3725)).toBe("1h 2m");
  });
  it("formats pace per km/mi", () => {
    expect(fmtPaceFromMeters(1000, 300, "metric")).toBe("5:00 /km");
    expect(fmtPaceFromMeters(0, 300, "metric")).toBe("—");
  });
});

describe("range", () => {
  const now = new Date("2026-06-23T12:00:00Z");
  it("parses with a safe default", () => {
    expect(parseRange("week")).toBe("week");
    expect(parseRange("nonsense")).toBe("all");
    expect(parseRange(undefined)).toBe("all");
  });
  it("windows timestamps", () => {
    expect(withinRange("2026-06-20T00:00:00Z", "week", now)).toBe(true);
    expect(withinRange("2026-06-01T00:00:00Z", "week", now)).toBe(false);
    expect(withinRange("2026-06-01T00:00:00Z", "month", now)).toBe(true);
    expect(withinRange("2020-01-01T00:00:00Z", "all", now)).toBe(true);
  });
});
