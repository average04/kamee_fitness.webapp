# Kamee `/me` — Outdoor Track Records

**Date:** 2026-06-23
**Status:** Approved (build)

## Goal

Add outdoor track records to `/me/records` (currently lifting-only): single-session
bests, GPS-derived best efforts (fastest 1K/5K), and lifetime totals. Read-only,
reuses existing `/me` patterns and data.

## Decisions (locked in brainstorming)

- **Include all three:** session bests, best efforts (1K/5K), lifetime totals.
- **Grouping:** one **overall** set of bests, each labeled with its activity mode
  (not split per mode).
- **Placement:** a second **Outdoor** section on `/me/records` (the page becomes
  "Records" with Lifting + Outdoor). No new route, no new query — the page
  already loads tracks (incl. `route_points`) via `loadMeData`.

## Data layer (pure, unit-tested — `lib/me/`)

- **`trackRecords.ts`**
  - `TrackBest = { trackId: string; mode: string; dateIso: string; value: number } | null`
  - `TrackRecords = { bests: { longestDistanceM, longestDurationS,
    fastestPaceSecPerKm, mostElevationM }, efforts: { fastest1kS, fastest5kS },
    totals: { distanceM, durationS, sessions, elevationM } }` — every `*Best`
    field is a `TrackBest` (nullable).
  - `buildTrackRecords(tracks: TrackSessionRow[]): TrackRecords`.
    - `dateIso(t)` = `(t.finished_at ?? t.created_at).slice(0,10)`.
    - **longestDistanceM:** max `distance_meters`.
    - **longestDurationS:** max `duration_seconds`.
    - **fastestPaceSecPerKm:** min pace (`durationS / (distanceM/1000)`) over
      tracks with `distance_meters >= 1000` (so a tiny session can't win); value
      is sec/km.
    - **mostElevationM:** max `elevation_gain_meters`.
    - **efforts:** for each track run `bestEffort(route_points, target)`; keep the
      session with the minimum time per target (1000 m, 5000 m); value is seconds.
    - **totals:** sums of distance/duration/elevation across all tracks +
      `sessions` count. (Totals count all tracks; bests/efforts skip zero/invalid.)
  - **`bestEffort(routePoints, targetMeters): number | null`** — the fastest time
    (seconds) to cover at least `targetMeters` of contiguous distance within one
    session. Build cumulative distance (haversine between consecutive points,
    reusing `lib/me/geo.ts`) and cumulative time (point timestamps); slide a
    window: for each end `j`, advance start `i` while the window distance `>=`
    target, tracking the minimum `t[j]-t[i]`. Returns `null` when the session's
    total distance `< target` or it has `< 2` points.
- **`units.ts`:** add `fmtElevation(meters, units)` → `"240 m"` / `"790 ft"`.

## Components

- **`TrackRecords.tsx`** (`components/me/`) — renders three sub-blocks:
  - **Session bests** rows: label · formatted value · `mode · date`, each a
    `Link` to `/me/tracks/[trackId]`. Skips null bests.
  - **Best efforts** rows: "Best 1K {time}", "Best 5K {time}" linking to the
    source track; hidden when both null.
  - **Lifetime totals**: reuse `StatGrid` (distance, moving time, sessions,
    elevation).
  - Renders nothing (or a one-line empty note) when the user has no tracks.
- **`/me/records` page**: keep the existing lifting list under a **Lifting**
  subheading; add an **Outdoor** subheading + `<TrackRecords>` below, computed
  from `buildTrackRecords(data.tracks)`. Rename the `<h1>` to "Records".

## Formatting

Values use existing `units` helpers: distance `fmtDistance`, duration
`fmtDuration`, pace `fmtPaceFromMeters` (or format sec/km directly), elevation
`fmtElevation`. Best-effort times shown as `m:ss` (sub-hour) via `fmtDuration`.

## Design language

Reuses the `/me` system; teal accent for outdoor (matches the rest of the track
UI), sun for a standout. Honest empty states. Respects reduced-motion.

## Security & testing

RLS + `requireUser()` unchanged (same page). `buildTrackRecords` and
`bestEffort` get vitest fixtures → expected output (incl. a synthetic
straight-line route for `bestEffort`, the ≥1 km pace guard, and null cases).
Page/visual via tsc/lint/build. No new dependencies.

## Out of scope (deferred)

- Per-mode record tables (overall set only for now).
- Milestone/achievement badges (first 5K, 100 km club, …).
- Other best-effort distances (400 m, 10 K, half).

## Schema references (project `ywkqixaobbjxdncvnqav`, RLS-enabled)

- `track_sessions(id, mode, distance_meters, duration_seconds,
  elevation_gain_meters, finished_at, created_at, route_points jsonb
  [{latitude, longitude, timestamp(ms)}])` — already loaded by `loadMeData`.
