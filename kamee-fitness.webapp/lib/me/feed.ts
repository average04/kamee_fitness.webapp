import type { SessionSetRow, TrackSessionRow, WorkoutSessionRow } from "./queries";

export type FeedItem =
  | { kind: "workout"; id: string; title: string; dateIso: string; volumeKg: number }
  | { kind: "track"; id: string; title: string; dateIso: string; distanceM: number };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function buildFeed(
  workouts: WorkoutSessionRow[],
  sets: SessionSetRow[],
  tracks: TrackSessionRow[],
  dayTitleBySession: Record<string, string>,
  limit: number,
): FeedItem[] {
  const volBySession = new Map<string, number>();
  for (const s of sets) {
    volBySession.set(
      s.session_id,
      (volBySession.get(s.session_id) ?? 0) + (s.reps_done ?? 0) * (s.weight ?? 0),
    );
  }
  const items: FeedItem[] = [];
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    items.push({
      kind: "workout",
      id: w.id,
      title: dayTitleBySession[w.id] ?? "Workout",
      dateIso: w.started_at,
      volumeKg: volBySession.get(w.id) ?? 0,
    });
  }
  for (const t of tracks) {
    items.push({
      kind: "track",
      id: t.id,
      title: cap(t.mode),
      dateIso: t.finished_at ?? t.created_at,
      distanceM: t.distance_meters ?? 0,
    });
  }
  items.sort((a, b) => Date.parse(b.dateIso) - Date.parse(a.dateIso));
  return items.slice(0, limit);
}
