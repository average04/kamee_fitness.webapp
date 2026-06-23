import type { FeedItem } from "./feed";

export type FeedGroup = { label: string; items: FeedItem[] };

const DAY_MS = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function groupFeedByDate(items: FeedItem[], now: Date): FeedGroup[] {
  const todayMs = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  const today = dayKey(todayMs);
  const yesterday = dayKey(todayMs - DAY_MS);
  const buckets: Record<string, FeedItem[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };
  for (const it of items) {
    const d = it.dateIso.slice(0, 10);
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : "Earlier";
    buckets[label].push(it);
  }
  return (["Today", "Yesterday", "Earlier"] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0);
}
