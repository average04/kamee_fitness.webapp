export type Units = "metric" | "imperial";

const KG_PER_LB = 0.45359237;
const M_PER_MI = 1609.344;

export function fmtWeight(kg: number, units: Units): string {
  return units === "imperial"
    ? `${Math.round(kg / KG_PER_LB)} lb`
    : `${Math.round(kg)} kg`;
}

export function fmtVolume(kg: number, units: Units): string {
  if (units === "imperial") {
    const lb = kg / KG_PER_LB;
    return lb >= 1000 ? `${(lb / 1000).toFixed(1)}k lb` : `${Math.round(lb)} lb`;
  }
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

export function fmtDistance(meters: number, units: Units): string {
  return units === "imperial"
    ? `${(meters / M_PER_MI).toFixed(1)} mi`
    : `${(meters / 1000).toFixed(1)} km`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fmtElevation(meters: number, units: Units): string {
  return units === "imperial"
    ? `${Math.round(meters / 0.3048)} ft`
    : `${Math.round(meters)} m`;
}

/** Clock time: m:ss, or h:mm:ss when >= 1 hour. */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return (h > 0 ? `${h}:` : "") + `${mm}:${String(sec).padStart(2, "0")}`;
}

export function fmtPaceFromMeters(
  meters: number,
  seconds: number,
  units: Units,
): string {
  if (meters <= 0 || seconds <= 0) return "—";
  const unitMeters = units === "imperial" ? M_PER_MI : 1000;
  const secPerUnit = seconds / (meters / unitMeters);
  const m = Math.floor(secPerUnit / 60);
  const sec = Math.round(secPerUnit % 60);
  const label = units === "imperial" ? "/mi" : "/km";
  return `${m}:${String(sec).padStart(2, "0")} ${label}`;
}
