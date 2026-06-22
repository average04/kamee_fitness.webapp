import { haversineMeters } from "./geo";

type RawPoint = {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  timestamp?: number;
};

export type Split = {
  index: number;
  distanceM: number;
  durationS: number;
  paceSecPerUnit: number;
  partial: boolean;
};

function coerce(routePoints: unknown): { lat: number; lng: number; t: number }[] {
  if (!Array.isArray(routePoints)) return [];
  const out: { lat: number; lng: number; t: number }[] = [];
  for (const p of routePoints as RawPoint[]) {
    const lat = p.latitude ?? p.lat;
    const lng = p.longitude ?? p.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      out.push({ lat, lng, t: typeof p.timestamp === "number" ? p.timestamp : 0 });
    }
  }
  return out;
}

export function computeSplits(routePoints: unknown, unitMeters: number): Split[] {
  const pts = coerce(routePoints);
  if (pts.length < 2) return [];
  const splits: Split[] = [];
  let segStartT = pts[0].t;
  let accumulated = 0; // distance into the current split
  let index = 1;
  for (let i = 1; i < pts.length; i++) {
    const d = haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    accumulated += d;
    if (accumulated >= unitMeters) {
      const durationS = (pts[i].t - segStartT) / 1000;
      splits.push({
        index,
        distanceM: accumulated,
        durationS,
        paceSecPerUnit: durationS, // one full unit covered
        partial: false,
      });
      index++;
      segStartT = pts[i].t;
      accumulated = 0;
    }
  }
  if (accumulated > 0) {
    const durationS = (pts[pts.length - 1].t - segStartT) / 1000;
    splits.push({
      index,
      distanceM: accumulated,
      durationS,
      paceSecPerUnit: accumulated > 0 ? durationS / (accumulated / unitMeters) : 0,
      partial: true,
    });
  }
  return splits;
}

export type TrackDetailSummary = {
  paceSecPerKm: number;
  paceDeltaSecPerKm: number | null;
  distanceDeltaM: number | null;
  durationDeltaS: number | null;
};

const paceSecPerKm = (distanceM: number, durationS: number) =>
  distanceM > 0 ? durationS / (distanceM / 1000) : 0;

export function summarizeTrackDetail(
  current: { distanceM: number; durationS: number },
  previous: { distanceM: number; durationS: number } | null,
): TrackDetailSummary {
  const cur = paceSecPerKm(current.distanceM, current.durationS);
  if (!previous) {
    return {
      paceSecPerKm: cur,
      paceDeltaSecPerKm: null,
      distanceDeltaM: null,
      durationDeltaS: null,
    };
  }
  const prev = paceSecPerKm(previous.distanceM, previous.durationS);
  return {
    paceSecPerKm: cur,
    paceDeltaSecPerKm: cur - prev,
    distanceDeltaM: current.distanceM - previous.distanceM,
    durationDeltaS: current.durationS - previous.durationS,
  };
}
