import { describe, expect, it } from "vitest";
import { groupFeedByDate } from "./feedGroups";
import type { FeedItem } from "./feed";

const mk = (id: string, dateIso: string): FeedItem => ({
  kind: "track",
  id,
  title: "Run",
  dateIso,
  distanceM: 1000,
  durationS: 300,
  routePoints: [],
});

describe("groupFeedByDate", () => {
  const now = new Date("2026-06-23T12:00:00Z");
  it("buckets into Today / Yesterday / Earlier and drops empties", () => {
    const groups = groupFeedByDate(
      [
        mk("a", "2026-06-23T08:00:00Z"),
        mk("b", "2026-06-22T08:00:00Z"),
        mk("c", "2026-06-01T08:00:00Z"),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
  });
  it("omits buckets with no items", () => {
    const groups = groupFeedByDate([mk("a", "2026-06-23T08:00:00Z")], now);
    expect(groups.map((g) => g.label)).toEqual(["Today"]);
  });
});
