export type Range = "week" | "month" | "all";

export function parseRange(value: string | undefined | null): Range {
  return value === "week" || value === "month" ? value : "all";
}

const DAY_MS = 86_400_000;

export function withinRange(iso: string, range: Range, now: Date): boolean {
  if (range === "all") return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const days = range === "week" ? 7 : 30;
  return now.getTime() - t <= days * DAY_MS;
}
