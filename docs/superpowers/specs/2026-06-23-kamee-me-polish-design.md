# Kamee `/me` Polish — List, Details, Loading

**Date:** 2026-06-23
**Status:** Approved (build)

## Goal

Make the `/me` stats area feel responsive and complete: instant loading
skeletons on navigation, faster detail-page fetches, a richer clickable session
list, and more detail on the workout / exercise / track pages — all from data we
already store. Builds on the existing `/me` patterns; still read-only.

## Decisions (locked in brainstorming)

- **In scope (all):** loading skeletons; faster detail fetch (`loadUnits`);
  richer session list (icon, second metadata line, route thumbnail, date
  grouping); workout stat grid + muscle tags; exercise demo image + muscle +
  stats; track stat grid.
- **No new dependencies.** One config touch: add the Supabase Storage host to
  `next.config` `images.remotePatterns` for the exercise demo image.

## 1. Loading states

Add Next App-Router `loading.tsx` files (rendered instantly during navigation
while the async server page fetches):

```
app/me/loading.tsx
app/me/workouts/[id]/loading.tsx
app/me/tracks/[id]/loading.tsx
app/me/exercises/[id]/loading.tsx
app/me/records/loading.tsx
app/me/day/[date]/loading.tsx
```

A reusable `components/me/Skeleton.tsx` (a rounded shimmer block; the shimmer
animation is disabled under `prefers-reduced-motion`). Each `loading.tsx`
composes skeletons to roughly match its page (header bar + a few content blocks).

## 2. Faster detail pages

The workout, track, and exercise detail pages currently call `loadMeData` (which
loads **all** of the user's sessions, sets, and tracks) only to read
`profile.units`. Add:

```ts
loadUnits(supabase, userId): Promise<Units>   // single profiles select, defaults "metric"
```

and use it on `/me/workouts/[id]`, `/me/tracks/[id]`, `/me/exercises/[id]`.
`/me/records` and `/me/day/[date]` keep `loadMeData` (they need the full data).

## 3. Richer session list

- **`feed.ts`** — `FeedItem` gains shared `durationS` and, per kind: workout
  `setCount`; track `routePoints` (unknown). `buildFeed` computes `setCount`
  (sets per session) and passes through `duration_seconds` / `route_points`.
- **`feedGroups.ts`** (new, pure) — `groupFeedByDate(items, now): { label:
  string; items: FeedItem[] }[]` bucketing into **Today / Yesterday / Earlier**
  (UTC day compare), preserving newest-first order, dropping empty buckets.
- **`FeedItem.tsx`** v2 — a type icon (hand-rolled SVG: dumbbell for workout,
  route for track), a primary line (title + metric), a secondary line
  (workout: `N sets · {duration}`; track: `{pace}/unit · {duration}`), and a
  `RouteThumbnail` (small) for tracks. Links unchanged.
- **`ActivityFeed.tsx`** — render grouped sections (label heading + items).
  Used by `/me` and `/me/day/[date]` (the day page passes a single date's items;
  grouping there collapses to one "Today/…"-style or just the list — it stays
  correct).

## 4. Detail enrichments

- **`StatGrid.tsx`** (new, reusable) — a responsive grid of `{ label, value }`
  cells; used by workout + track detail.
- **Workout** (`workoutDetail.ts` + `loadWorkoutDetail` + page):
  - `loadWorkoutDetail` also selects `max_hr`, `ended_at`, and each exercise's
    `primary_muscle` (extend the `plan_exercises → exercises` select to
    `exercises(id, name, primary_muscle)`); returns `session.maxHr`,
    `session.endedAt`, and a `muscleByExercise: Record<string,string>`.
  - `summarizeWorkoutDetail` gains `totalSets` and `totalReps`; `ExerciseBlock`
    gains `primaryMuscle: string | null` (from a passed `muscleByExercise` map).
  - Page shows a `StatGrid` (sets, reps, duration, avg HR, max HR, time of day)
    and a muscle tag per exercise.
- **Exercise** (`exerciseHistory.ts` + `loadExerciseHistory` + page):
  - `loadExerciseHistory` also returns `demoImagePath: string | null` and
    `primaryMuscle: string | null` (from the `exercises` select).
  - `ExerciseHistory` gains `bestVolumeKg`, `lastWeightKg`, `totalReps`.
  - Page shows the demo image (via `next/image`, see config) + primary muscle,
    plus those stats next to the chart. A new `exerciseDemoUrl(path)` helper
    builds the public Storage URL from `NEXT_PUBLIC_SUPABASE_URL` +
    `exercise-demos` bucket.
- **Track** (`loadTrackDetail` + page):
  - `TrackSessionRow` + the `loadTrackDetail` select gain `max_hr` and
    `elevation_loss_meters`.
  - Page replaces the single metadata line with a `StatGrid` (distance,
    duration, avg pace, max HR, elevation gain, elevation loss, start time);
    keeps the route map + splits + vs-previous.

## Config

`next.config.ts` gains `images.remotePatterns` for the Supabase host (derived
from `NEXT_PUBLIC_SUPABASE_URL`) so the exercise demo image is optimized by
`next/image`. (The avatar stays a plain `<img>` — arbitrary host.)

## Design language

Reuses the `/me` system (ink/leaf/teal/sun/ember, Bricolage + Hanken). Icons are
small inline SVGs. Skeletons use a subtle shimmer, off under reduced motion.
Stat grids: muted label, bold value. Honest empty states unchanged.

## Security & testing

RLS + `requireUser()` unchanged. New/changed **pure** modules get vitest tests:
`feedGroups` (bucketing), `feed` (setCount + passthrough), `workoutDetail`
(`totalSets`/`totalReps` + `primaryMuscle`), `exerciseHistory`
(`bestVolumeKg`/`lastWeightKg`/`totalReps`). Pages, skeletons, and visual
components verify via `tsc`/`lint`/`build`.

## Out of scope (deferred)

- HR-over-distance / elevation-profile charts (route points store only
  lat/lng/timestamp — no per-point HR or elevation).
- Calories (not stored). Editing data on the web. Community features.

## Schema references (project `ywkqixaobbjxdncvnqav`, RLS-enabled)

- `workout_sessions(started_at, ended_at, duration_seconds, status, avg_hr,
  max_hr, day_id)`; `session_sets(session_id, plan_exercise_id, reps_done,
  weight)`
- `exercises(id, name, primary_muscle, demo_image_path)` in the public
  `exercise-demos` storage bucket; `plan_exercises(id, exercise_id)`
- `track_sessions(distance_meters, duration_seconds, avg_hr, max_hr,
  elevation_gain_meters, elevation_loss_meters, route_points, finished_at,
  created_at, mode)`
- `profiles(units)`
