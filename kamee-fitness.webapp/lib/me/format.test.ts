import { describe, expect, it } from "vitest";
import {
  fmtClock,
  fmtDistance,
  fmtDuration,
  fmtElevation,
  fmtPaceFromMeters,
  fmtWeight,
} from "./units";
import { inWindow, parseRange, resolveWindow } from "./range";

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
  it("formats elevation and clock times", () => {
    expect(fmtElevation(240, "metric")).toBe("240 m");
    expect(fmtElevation(305, "imperial")).toBe("1001 ft");
    expect(fmtClock(272)).toBe("4:32");
    expect(fmtClock(1450)).toBe("24:10");
    expect(fmtClock(3725)).toBe("1:02:05");
  });
});

describe("range", () => {
  const now = new Date("2026-06-23T12:00:00Z");
  it("parses with a safe default", () => {
    expect(parseRange("week")).toBe("week");
    expect(parseRange("custom")).toBe("custom");
    expect(parseRange("nonsense")).toBe("all");
    expect(parseRange(undefined)).toBe("all");
  });
  it("resolves preset windows", () => {
    expect(resolveWindow("all", now)).toEqual({ startMs: null, endMs: null });
    const week = resolveWindow("week", now);
    expect(week.endMs).toBeNull();
    expect(week.startMs).toBe(now.getTime() - 7 * 86_400_000);
  });
  it("resolves custom windows from day bounds", () => {
    const w = resolveWindow("custom", now, "2026-06-01", "2026-06-10");
    expect(w.startMs).toBe(Date.parse("2026-06-01T00:00:00"));
    expect(w.endMs).toBe(Date.parse("2026-06-10T23:59:59.999"));
    const open = resolveWindow("custom", now, "2026-06-01", undefined);
    expect(open.endMs).toBeNull();
  });
  it("includes/excludes timestamps by window bounds", () => {
    const w = resolveWindow("custom", now, "2026-06-01", "2026-06-10");
    expect(inWindow("2026-06-05T00:00:00Z", w)).toBe(true);
    expect(inWindow("2026-06-20T00:00:00Z", w)).toBe(false);
    expect(inWindow("2020-01-01T00:00:00Z", { startMs: null, endMs: null })).toBe(
      true,
    );
  });
});
