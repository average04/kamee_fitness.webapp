import { newDay, type Day, type Week } from "./plans";

export const calendarDays = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"] as const;

/** Sequential positions remain fixed: filling Day 5 must never move it to Day 1. */
export function replaceCalendarDay(week: Week, index: number, day: Day): Week {
  if (!Number.isInteger(index) || index < 0 || index > 6) throw new Error("Invalid day position");
  return { ...week, days: calendarDays.map((_, i) => i === index ? day : week.days[i] ?? newDay("rest")) };
}
