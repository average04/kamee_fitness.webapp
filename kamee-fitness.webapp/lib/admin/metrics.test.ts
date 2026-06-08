import { describe, expect, it } from "vitest";
import { bucketByDay, mergeActivity, pct, relativeTime } from "./metrics";

describe("bucketByDay", () => {
  const end = new Date("2026-06-08T12:00:00Z");

  it("creates one ascending bucket per day ending on `end`", () => {
    const b = bucketByDay([], 7, end);
    expect(b).toHaveLength(7);
    expect(b[0].date).toBe("2026-06-02");
    expect(b[6].date).toBe("2026-06-08");
    expect(b.every((x) => x.count === 0)).toBe(true);
  });

  it("counts timestamps into their UTC day", () => {
    const ts = [
      "2026-06-08T01:00:00Z",
      "2026-06-08T23:00:00Z",
      "2026-06-07T10:00:00Z",
    ];
    const b = bucketByDay(ts, 7, end);
    expect(b[6].count).toBe(2); // 06-08
    expect(b[5].count).toBe(1); // 06-07
  });

  it("ignores timestamps outside the window and unparseable values", () => {
    const ts = ["2026-05-01T00:00:00Z", "not-a-date", "2026-06-08T00:00:00Z"];
    const b = bucketByDay(ts, 7, end);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(1);
  });
});

describe("pct", () => {
  it("computes a rounded percentage", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(1, 3)).toBe(33);
  });
  it("returns 0 when whole is 0", () => {
    expect(pct(5, 0)).toBe(0);
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-06-08T12:00:00Z");
  it("formats recent times in coarse buckets", () => {
    expect(relativeTime("2026-06-08T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-06-08T11:55:00Z", now)).toBe("5m ago");
    expect(relativeTime("2026-06-08T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-06T12:00:00Z", now)).toBe("2d ago");
  });
  it("falls back to an ISO date for old timestamps", () => {
    expect(relativeTime("2026-01-01T00:00:00Z", now)).toBe("2026-01-01");
  });
});

describe("mergeActivity", () => {
  it("merges lists, sorts newest first, and caps to the limit", () => {
    const users = [{ type: "user" as const, label: "A", at: "2026-06-08T10:00:00Z" }];
    const waitlist = [
      { type: "waitlist" as const, label: "B", at: "2026-06-08T11:00:00Z" },
      { type: "waitlist" as const, label: "C", at: "2026-06-08T09:00:00Z" },
    ];
    const out = mergeActivity([users, waitlist], 2);
    expect(out.map((e) => e.label)).toEqual(["B", "A"]);
  });

  it("returns [] when given no events", () => {
    expect(mergeActivity([], 5)).toEqual([]);
  });
});
