import { isMeasuredLiftingSet } from "./oneRepMax";
import { workoutTrainingIso } from "./workoutDate";
import type { SessionSetRow, TrackSessionRow, WorkoutSessionRow } from "./queries";

export type FeedItem =
  | {
      kind: "workout";
      id: string;
      title: string;
      dateIso: string;
      volumeKg: number | null;
      durationS: number | null;
      setCount: number;
    }
  | {
      kind: "track";
      id: string;
      title: string;
      dateIso: string;
      distanceM: number;
      durationS: number;
      routePoints: unknown;
    };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function buildFeed(
  workouts: WorkoutSessionRow[],
  sets: SessionSetRow[],
  tracks: TrackSessionRow[],
  dayTitleBySession: Record<string, string>,
  limit: number,
): FeedItem[] {
  const volBySession = new Map<string, number>();
  const countBySession = new Map<string, number>();
  for (const s of sets) {
    if (isMeasuredLiftingSet({ reps: s.reps_done, weightKg: s.weight, trackingType: s.tracking_type })) {
      volBySession.set(s.session_id, (volBySession.get(s.session_id) ?? 0) + s.reps_done! * s.weight!);
    }
    countBySession.set(s.session_id, (countBySession.get(s.session_id) ?? 0) + 1);
  }
  const items: FeedItem[] = [];
  const order = new Map<string, { precise: number; submitted: number }>();
  const instant = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.NEGATIVE_INFINITY;
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    order.set(`workout:${w.id}`, { precise: w.timestamp_precision === 'date' ? Number.NEGATIVE_INFINITY : instant(w.ended_at ?? w.started_at), submitted: instant(w.submitted_at) });
    items.push({
      kind: "workout",
      id: w.id,
      title: dayTitleBySession[w.id] ?? "Workout",
      dateIso: workoutTrainingIso(w),
      volumeKg: volBySession.get(w.id) ?? null,
      durationS: w.duration_seconds,
      setCount: countBySession.get(w.id) ?? 0,
    });
  }
  for (const t of tracks) {
    order.set(`track:${t.id}`, { precise: instant(t.finished_at ?? t.created_at), submitted: Number.NEGATIVE_INFINITY });
    items.push({
      kind: "track",
      id: t.id,
      title: cap(t.mode),
      dateIso: t.finished_at ?? t.created_at,
      distanceM: t.distance_meters ?? 0,
      durationS: t.duration_seconds ?? 0,
      routePoints: t.route_points,
    });
  }
  items.sort((a, b) => {
    const day = b.dateIso.slice(0, 10).localeCompare(a.dateIso.slice(0, 10));
    if (day) return day;
    const left = order.get(`${a.kind}:${a.id}`)!, right = order.get(`${b.kind}:${b.id}`)!;
    if (left.precise !== right.precise) return right.precise > left.precise ? 1 : -1;
    if (left.submitted !== right.submitted) return right.submitted > left.submitted ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === 'track' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return items.slice(0, limit);
}
