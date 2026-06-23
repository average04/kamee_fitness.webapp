import { haversineMeters } from "./geo";
import type { TrackSessionRow } from "./queries";

export type TrackBest = {
  trackId: string;
  mode: string;
  dateIso: string;
  value: number;
} | null;

export type TrackRecords = {
  bests: {
    longestDistanceM: TrackBest;
    longestDurationS: TrackBest;
    fastestPaceSecPerKm: TrackBest;
    mostElevationM: TrackBest;
  };
  efforts: { fastest1kS: TrackBest; fastest5kS: TrackBest };
  totals: {
    distanceM: number;
    durationS: number;
    sessions: number;
    elevationM: number;
  };
};

type Pt = { lat: number; lng: number; t: number };

function coerce(routePoints: unknown): Pt[] {
  if (!Array.isArray(routePoints)) return [];
  const out: Pt[] = [];
  for (const p of routePoints as Array<Record<string, unknown>>) {
    if (!p || typeof p !== "object") continue;
    const lat = (p.latitude ?? p.lat) as unknown;
    const lng = (p.longitude ?? p.lng) as unknown;
    if (typeof lat === "number" && typeof lng === "number") {
      out.push({
        lat,
        lng,
        t: typeof p.timestamp === "number" ? p.timestamp : 0,
      });
    }
  }
  return out;
}

/** Fastest time (s) to cover >= targetMeters contiguously in one session; null if too short. */
export function bestEffort(
  routePoints: unknown,
  targetMeters: number,
): number | null {
  const pts = coerce(routePoints);
  if (pts.length < 2) return null;
  const cumD: number[] = [0];
  const cumT: number[] = [pts[0].t];
  for (let i = 1; i < pts.length; i++) {
    cumD[i] =
      cumD[i - 1] +
      haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    cumT[i] = pts[i].t;
  }
  if (cumD[cumD.length - 1] < targetMeters) return null;
  let best = Infinity;
  let i = 0;
  for (let j = 1; j < pts.length; j++) {
    while (i + 1 < j && cumD[j] - cumD[i + 1] >= targetMeters) i++;
    if (cumD[j] - cumD[i] >= targetMeters) {
      const dt = (cumT[j] - cumT[i]) / 1000;
      if (dt < best) best = dt;
    }
  }
  return Number.isFinite(best) ? best : null;
}

const when = (t: TrackSessionRow) => (t.finished_at ?? t.created_at).slice(0, 10);

function pick(
  cur: TrackBest,
  t: TrackSessionRow,
  value: number,
  dir: "max" | "min",
): TrackBest {
  const better = !cur || (dir === "max" ? value > cur.value : value < cur.value);
  return better ? { trackId: t.id, mode: t.mode, dateIso: when(t), value } : cur;
}

export function buildTrackRecords(tracks: TrackSessionRow[]): TrackRecords {
  let longestDistanceM: TrackBest = null;
  let longestDurationS: TrackBest = null;
  let fastestPaceSecPerKm: TrackBest = null;
  let mostElevationM: TrackBest = null;
  let fastest1kS: TrackBest = null;
  let fastest5kS: TrackBest = null;
  let distanceM = 0;
  let durationS = 0;
  let elevationM = 0;

  for (const t of tracks) {
    const dist = t.distance_meters ?? 0;
    const dur = t.duration_seconds ?? 0;
    const elev = t.elevation_gain_meters ?? 0;
    distanceM += dist;
    durationS += dur;
    elevationM += elev;

    if (dist > 0) longestDistanceM = pick(longestDistanceM, t, dist, "max");
    if (dur > 0) longestDurationS = pick(longestDurationS, t, dur, "max");
    if (elev > 0) mostElevationM = pick(mostElevationM, t, elev, "max");
    if (dist >= 1000 && dur > 0) {
      fastestPaceSecPerKm = pick(
        fastestPaceSecPerKm,
        t,
        dur / (dist / 1000),
        "min",
      );
    }
    const e1 = bestEffort(t.route_points, 1000);
    if (e1 != null) fastest1kS = pick(fastest1kS, t, e1, "min");
    const e5 = bestEffort(t.route_points, 5000);
    if (e5 != null) fastest5kS = pick(fastest5kS, t, e5, "min");
  }

  return {
    bests: {
      longestDistanceM,
      longestDurationS,
      fastestPaceSecPerKm,
      mostElevationM,
    },
    efforts: { fastest1kS, fastest5kS },
    totals: { distanceM, durationS, sessions: tracks.length, elevationM },
  };
}
