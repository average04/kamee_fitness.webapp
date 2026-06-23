# Kamee `/me` Outdoor Track Records — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Outdoor section to `/me/records` — single-session bests, GPS best efforts (fastest 1K/5K), and lifetime totals.

**Architecture:** A pure tested `lib/me/trackRecords.ts` (`buildTrackRecords` + `bestEffort`, reusing `lib/me/geo.ts`) over the tracks `loadMeData` already returns; a `TrackRecords` component reusing `StatGrid`; the records page gains a second section. No new query, no new deps.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, TypeScript, vitest.

## Global Constraints

- **Security:** RLS + `requireUser()` unchanged (same `/me/records` page).
- **Units** via `lib/me/units.ts`. Teal accent for outdoor.
- **Tests:** pure modules under `lib/me/*.test.ts`; page/visual via tsc/lint/build.
- **Commands in** `kamee-fitness.webapp/`. Branch: `feat/me-track-records`.

---

### Task 1: Track records aggregation + formatters (pure, TDD)

**Files:**
- Create: `lib/me/trackRecords.ts`
- Modify: `lib/me/units.ts` (add `fmtElevation`, `fmtClock`)
- Test: `lib/me/trackRecords.test.ts`, `lib/me/format.test.ts`

**Interfaces:**
- Consumes: `haversineMeters` from `./geo`; `TrackSessionRow` from `./queries`; `Units` from `./units`.
- Produces: `TrackBest`, `TrackRecords`; `bestEffort(routePoints, targetMeters): number | null`; `buildTrackRecords(tracks): TrackRecords`; `fmtElevation(meters, units)`, `fmtClock(seconds)`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/me/trackRecords.test.ts
import { describe, expect, it } from "vitest";
import { bestEffort, buildTrackRecords } from "./trackRecords";
import type { TrackSessionRow } from "./queries";

const T = (over: Partial<TrackSessionRow> & { id: string }): TrackSessionRow => ({
  id: over.id,
  mode: over.mode ?? "run",
  title: null,
  distance_meters: over.distance_meters ?? 0,
  duration_seconds: over.duration_seconds ?? 0,
  elevation_gain_meters: over.elevation_gain_meters ?? 0,
  elevation_loss_meters: 0,
  avg_hr: null,
  max_hr: null,
  finished_at: over.finished_at ?? "2026-06-20T07:00:00Z",
  created_at: over.created_at ?? "2026-06-20T07:00:00Z",
  route_points: over.route_points ?? [],
});

// ~55.6 m per 0.0005° lat near the equator; 60 s between points.
const line = (n: number) =>
  Array.from({ length: n + 1 }, (_, i) => ({
    latitude: i * 0.0005,
    longitude: 0,
    timestamp: i * 60_000,
  }));

describe("bestEffort", () => {
  it("returns null for too-few points or too-short routes", () => {
    expect(bestEffort([], 1000)).toBeNull();
    expect(bestEffort(line(5), 1000)).toBeNull(); // ~278 m < 1000
  });
  it("finds the fastest 1 km window", () => {
    const e = bestEffort(line(20), 1000); // ~1.11 km total
    expect(e).not.toBeNull();
    expect(e!).toBeGreaterThanOrEqual(1000);
    expect(e!).toBeLessThanOrEqual(1140);
  });
});

describe("buildTrackRecords", () => {
  const tracks = [
    T({ id: "a", mode: "run", distance_meters: 5000, duration_seconds: 1500, elevation_gain_meters: 40 }),
    T({ id: "b", mode: "walk", distance_meters: 8000, duration_seconds: 4800, elevation_gain_meters: 10 }),
    T({ id: "c", mode: "run", distance_meters: 500, duration_seconds: 60, elevation_gain_meters: 5 }),
  ];
  it("computes session bests, ignoring sub-1km for pace, and lifetime totals", () => {
    const r = buildTrackRecords(tracks);
    expect(r.bests.longestDistanceM!.trackId).toBe("b");
    expect(r.bests.longestDurationS!.trackId).toBe("b");
    expect(r.bests.mostElevationM!.trackId).toBe("a");
    // pace: a = 1500/5 = 300 s/km; b = 4800/8 = 600; c excluded (<1km)
    expect(r.bests.fastestPaceSecPerKm!.trackId).toBe("a");
    expect(r.bests.fastestPaceSecPerKm!.value).toBeCloseTo(300, 0);
    expect(r.totals.distanceM).toBe(13500);
    expect(r.totals.sessions).toBe(3);
    expect(r.totals.elevationM).toBe(55);
  });
});
```

In `lib/me/format.test.ts`, add to the `units` describe:
```ts
import { fmtClock, fmtElevation } from "./units";
// ...
  it("formats elevation and clock times", () => {
    expect(fmtElevation(240, "metric")).toBe("240 m");
    expect(fmtElevation(305, "imperial")).toBe("1001 ft");
    expect(fmtClock(272)).toBe("4:32");
    expect(fmtClock(1450)).toBe("24:10");
    expect(fmtClock(3725)).toBe("1:02:05");
  });
```
(extend the existing `import { ... } from "./units";` line to include `fmtClock, fmtElevation`.)

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run lib/me/trackRecords.test.ts lib/me/format.test.ts`).

- [ ] **Step 3: Add the formatters** to `lib/me/units.ts`:

```ts
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
```

- [ ] **Step 4: Implement `trackRecords.ts`**

```ts
// lib/me/trackRecords.ts
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
      out.push({ lat, lng, t: typeof p.timestamp === "number" ? p.timestamp : 0 });
    }
  }
  return out;
}

/** Fastest time (s) to cover >= targetMeters contiguously in one session; null if too short. */
export function bestEffort(routePoints: unknown, targetMeters: number): number | null {
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
      fastestPaceSecPerKm = pick(fastestPaceSecPerKm, t, dur / (dist / 1000), "min");
    }
    const e1 = bestEffort(t.route_points, 1000);
    if (e1 != null) fastest1kS = pick(fastest1kS, t, e1, "min");
    const e5 = bestEffort(t.route_points, 5000);
    if (e5 != null) fastest5kS = pick(fastest5kS, t, e5, "min");
  }

  return {
    bests: { longestDistanceM, longestDurationS, fastestPaceSecPerKm, mostElevationM },
    efforts: { fastest1kS, fastest5kS },
    totals: { distanceM, durationS, sessions: tracks.length, elevationM },
  };
}
```

- [ ] **Step 5: Run — expect PASS** (`npx vitest run lib/me`).
- [ ] **Step 6: Commit**

```bash
git add lib/me/trackRecords.ts lib/me/trackRecords.test.ts lib/me/units.ts lib/me/format.test.ts && git commit -m "feat(me): track records aggregation + bestEffort + elevation/clock formatters"
```

---

### Task 2: TrackRecords component + records page section

**Files:**
- Create: `components/me/TrackRecords.tsx`
- Modify: `app/me/records/page.tsx`

**Interfaces:**
- Consumes: `TrackRecords`, `TrackBest` from `@/lib/me/trackRecords`; `buildTrackRecords`; `StatGrid`; `fmtDistance`, `fmtDuration`, `fmtElevation`, `fmtClock`, `Units`.

- [ ] **Step 1: TrackRecords component**

```tsx
// components/me/TrackRecords.tsx
import Link from "next/link";
import type { TrackBest, TrackRecords as Records } from "@/lib/me/trackRecords";
import {
  fmtClock,
  fmtDistance,
  fmtDuration,
  fmtElevation,
  type Units,
} from "@/lib/me/units";
import StatGrid from "./StatGrid";

function paceLabel(secPerKm: number, units: Units): string {
  const secPerUnit = units === "imperial" ? secPerKm * 1.609344 : secPerKm;
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")} ${units === "imperial" ? "/mi" : "/km"}`;
}

function BestRow({
  label,
  best,
  value,
}: {
  label: string;
  best: TrackBest;
  value: string;
}) {
  if (!best) return null;
  return (
    <Link
      href={`/me/tracks/${best.trackId}`}
      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-leaf-300"
    >
      <span className="font-display font-semibold text-mist">{label}</span>
      <span className="flex items-center gap-3 text-sm">
        <span className="text-teal-500">{value}</span>
        <span className="hidden text-xs capitalize text-muted sm:inline">
          {best.mode} · {best.dateIso}
        </span>
        <span className="text-muted" aria-hidden>→</span>
      </span>
    </Link>
  );
}

export default function TrackRecords({
  records,
  units,
}: {
  records: Records;
  units: Units;
}) {
  const { bests, efforts, totals } = records;
  const anyBest =
    bests.longestDistanceM ||
    bests.longestDurationS ||
    bests.fastestPaceSecPerKm ||
    bests.mostElevationM;
  if (!totals.sessions) {
    return (
      <p className="text-sm text-muted">
        No outdoor activities yet — start a walk or run in the app.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {anyBest && (
        <div className="divide-y divide-white/8 border-y border-white/8">
          <BestRow
            label="Longest distance"
            best={bests.longestDistanceM}
            value={bests.longestDistanceM ? fmtDistance(bests.longestDistanceM.value, units) : ""}
          />
          <BestRow
            label="Longest duration"
            best={bests.longestDurationS}
            value={bests.longestDurationS ? fmtDuration(bests.longestDurationS.value) : ""}
          />
          <BestRow
            label="Fastest pace"
            best={bests.fastestPaceSecPerKm}
            value={bests.fastestPaceSecPerKm ? paceLabel(bests.fastestPaceSecPerKm.value, units) : ""}
          />
          <BestRow
            label="Most elevation"
            best={bests.mostElevationM}
            value={bests.mostElevationM ? `↑ ${fmtElevation(bests.mostElevationM.value, units)}` : ""}
          />
        </div>
      )}

      {(efforts.fastest1kS || efforts.fastest5kS) && (
        <div>
          <h4 className="mb-2 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted">
            Best efforts
          </h4>
          <div className="divide-y divide-white/8 border-y border-white/8">
            <BestRow
              label="Fastest 1K"
              best={efforts.fastest1kS}
              value={efforts.fastest1kS ? fmtClock(efforts.fastest1kS.value) : ""}
            />
            <BestRow
              label="Fastest 5K"
              best={efforts.fastest5kS}
              value={efforts.fastest5kS ? fmtClock(efforts.fastest5kS.value) : ""}
            />
          </div>
        </div>
      )}

      <StatGrid
        cells={[
          { label: "Total distance", value: fmtDistance(totals.distanceM, units) },
          { label: "Moving time", value: fmtDuration(totals.durationS) },
          { label: "Sessions", value: String(totals.sessions) },
          { label: "Total climb", value: fmtElevation(totals.elevationM, units) },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire into `app/me/records/page.tsx`**

Add imports:
```tsx
import { buildTrackRecords } from "@/lib/me/trackRecords";
import TrackRecords from "@/components/me/TrackRecords";
```
After computing `records` (the lifting list), add:
```tsx
  const trackRecords = buildTrackRecords(data.tracks);
```
Change the `<h1>` text from `Personal records` to `Records`. Replace the single results block with two sections:
```tsx
      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-leaf-400">Lifting</h2>
        <div className="mt-3">
          {records.length ? (
            <RecordsList records={records} units={units} />
          ) : (
            <p className="text-sm text-muted">
              No lifting records yet — log a weighted set in the app to start.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-teal-500">Outdoor</h2>
        <div className="mt-3">
          <TrackRecords records={trackRecords} units={units} />
        </div>
      </section>
```
(Remove the old `<div className="mt-6">…RecordsList…</div>` block that this replaces.)

- [ ] **Step 3: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add components/me/TrackRecords.tsx app/me/records/page.tsx && git commit -m "feat(me): Outdoor records section on /me/records"
```

---

### Task 3: Final verification

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: typecheck clean; all vitest pass (80 prior + trackRecords/bestEffort + format additions); lint only pre-existing errors; build succeeds; `/me/records` still listed.

- [ ] **Step 2: Manual smoke** (`npm run dev`, logged in): `/me/records` shows a **Lifting** section (PRs) and an **Outdoor** section with session bests (each linking to its track), best 1K/5K when runs have GPS, and a totals grid; a user with no tracks sees the friendly outdoor empty note.

---

## Self-Review

**Spec coverage:** session bests (distance/duration/pace≥1km/elevation) → T1 `buildTrackRecords`, T2 rows; best efforts 1K/5K via sliding window → T1 `bestEffort`, T2 rows; lifetime totals → T1 totals, T2 StatGrid; overall set, mode-labeled → `TrackBest.mode` shown in rows; Outdoor section on `/me/records` → T2; `fmtElevation` → T1; tests → T1. ✓

**Placeholder scan:** none. Empty-state copy is intentional.

**Type consistency:** `TrackBest`/`TrackRecords` (T1) consumed by `TrackRecords.tsx` (T2) and the page; `bestEffort` (T1) used inside `buildTrackRecords` (T1) and tested; `fmtElevation`/`fmtClock` (T1) used by the component (T2); `TrackSessionRow` fields (`distance_meters`, `duration_seconds`, `elevation_gain_meters`, `route_points`, `finished_at`/`created_at`, `mode`, `id`) all exist on the type. `StatGrid` reused from the prior phase. Consistent.
