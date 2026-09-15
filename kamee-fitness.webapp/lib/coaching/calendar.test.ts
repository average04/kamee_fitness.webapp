import { describe, expect, it } from "vitest";
import { replaceCalendarDay } from "./calendar";
import { newDay, type Week } from "./plans";

describe("weekday positions", () => {
  it("keeps a Friday session on Friday and fills gaps with rest", () => {
    const week: Week = { lineage_key: "week", role: "build", days: [] };
    const friday = { ...newDay("workout"), title: "Friday strength" };
    const next = replaceCalendarDay(week, 4, friday);
    expect(next.days).toHaveLength(7);
    expect(next.days[4]).toBe(friday);
    expect(next.days.filter((_, i) => i !== 4).every(d => d.day_kind === "rest")).toBe(true);
    expect(new Set(next.days.map(d => d.lineage_key)).size).toBe(7);
    expect(week.days).toHaveLength(0);
  });
  it("preserves existing content and lineage when another weekday changes", () => {
    const monday = { ...newDay("workout"), coaching_video_id: "private-video" };
    const week: Week = { lineage_key: "week", role: "taper", days: [monday] };
    const next = replaceCalendarDay(week, 6, newDay("run"));
    expect(next.days[0]).toBe(monday);
    expect(next.role).toBe("taper");
    expect(next.lineage_key).toBe("week");
    const changed = replaceCalendarDay(next, 6, newDay("rest"));
    expect(changed.days.slice(0, 6)).toEqual(next.days.slice(0, 6));
  });
  it("rejects invalid positions instead of shifting or deleting content", () => {
    const week: Week = { lineage_key: "week", role: "build", days: [] };
    for (const index of [-1, 7, 1.5, NaN]) expect(() => replaceCalendarDay(week, index, newDay())).toThrow();
  });
});
