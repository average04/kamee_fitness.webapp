# Kamee `/me` v2 — Detail Pages & Progress

**Date:** 2026-06-23
**Status:** Approved (build)

## Goal

Turn the flat `/me` overview into a navigable stats hub: a clickable session
history feed, per-workout and per-track detail pages, per-exercise progression,
and progress-vs-last-session signals throughout. Builds directly on the existing
`/me` area (email-OTP auth, RLS reads, `lib/me/*` pure aggregation, Recharts +
hand-rolled SVG). Read-only — logging stays in the app.

## Decisions (locked in brainstorming)

- **Scope (all four):** session history feed, workout detail, exercise
  progression, track detail.
- **Track route:** enhanced **SVG** (no map tiles / API key).
- **Extras (all three):** estimated 1RM (Epley), dashboard momentum line,
  plan-progress card.
- **Phasing:** one spec; implementation in 4 shippable phases (feed+momentum+plan
  → workout detail → exercise progression → track detail).

## Routes

```
/me                    enhanced — momentum line, plan card, activity feed (links out)
/me/workouts/[id]      workout detail (server; requireUser; RLS)
/me/tracks/[id]        track detail
/me/exercises/[id]     exercise progression  ([id] = exercises.id)
```

All detail pages: `requireUser()` gate, RLS-scoped reads (a foreign id returns no
rows → `notFound()`), `params` is awaited (Next 16), back-link to `/me`.

## Data layer (pure, unit-tested — `lib/me/`)

New query fetchers in `queries.ts` (RLS-scoped, defensive `user_id`/ownership):

- `loadWorkoutDetail(supabase, userId, sessionId)` → the session, its
  `session_sets`, feedback `overall_rating`, the `plan_days.title`, and the
  **previous completed session with the same `day_id`** (for deltas). Resolves
  `plan_exercise_id → { exerciseId, name }`.
- `loadTrackDetail(supabase, userId, trackId)` → the track row (incl.
  `route_points`) and the **previous track with the same `mode`**.
- `loadExerciseHistory(supabase, userId, exerciseId)` → all of the user's sets
  for that exercise across sessions (with session date), plus the exercise name.
- `loadPlanProgress(supabase, userId)` → active `user_plans` (`completed_at`
  null, latest `started_at`) joined to `plans` (`title`, `weeks_count`); optional
  next `plan_days.title` at the current position (best-effort).

New pure aggregation modules (each with `*.test.ts`):

- `feed.ts` — `buildFeed(workouts, tracks)`: merge into one list sorted newest
  first; each item `{ kind:"workout"|"track", id, title, dateIso, metric, href }`
  (workout title = day title; track title = capitalized mode; metric = volume or
  distance). Excludes non-`completed` workouts.
- `workoutDetail.ts` — `summarizeWorkoutDetail(currentSets, previousSets, names, allTimeMaxByExercise)`:
  group sets by `exerciseId`; per exercise `{ name, exerciseId, sets:[{reps,weight}],
  topSetKg, volumeKg, topDeltaKg|null, volumeDeltaKg|null, isPr }`; plus
  `totalVolumeKg` and `totalVolumeDeltaKg`. `isPr` when this session's top set
  exceeds the all-time max **before** this session. Deltas vs the previous
  same-day session (null when none).
- `trackDetail.ts` — `computeSplits(routePoints, unitMeters)`: walk points,
  Haversine distance between consecutive points, accumulate; at each unit
  boundary emit `{ index, distanceM, durationS, paceSecPerUnit }` from point
  timestamps; trailing partial split included but flagged `partial:true`.
  `summarizeTrackDetail(track, previous)` → metrics + `paceDeltaSecPerUnit` etc.
- `exerciseHistory.ts` — `buildExerciseHistory(setsWithDate)` where each input set
  carries its session's `dateIso` (the query joins sets→session date): per session
  `{ dateIso, topSetKg, volumeKg, bestEst1RmKg }`; `prKg` + `prDateIso`;
  `timesTrained`. Series sorted ascending for charting.
- `oneRepMax.ts` — `epley1Rm(weightKg, reps)` = `weightKg * (1 + reps/30)`
  (reps ≤ 1 → weightKg). Used by `exerciseHistory`.
- `momentum.ts` — `buildMomentum(workouts, tracks, now)`: `daysSinceLastWorkout`,
  `workoutsThisWeek`, `workoutsLastWeek`, `distanceThisWeekM`, `distanceLastWeekM`
  (ISO weeks, completed workouts only).
- `plan.ts` — `summarizePlan(userPlan, plan)`: `{ title, currentWeek, totalWeeks,
  pct }` with `pct = clamp(round(currentWeek/totalWeeks*100), 0, 100)`; null when
  no active plan.

Reuses `units.ts` (kg/lb, km/mi, pace, duration), `range.ts`, `auth.ts`,
`avatars.ts`. `haversine` lives in `trackDetail.ts` (or a small `geo.ts`) and is
unit-tested.

## Components (`components/me/`)

- `ActivityFeed.tsx` + `FeedItem.tsx` — clickable cards (`next/link` to detail),
  icon per kind, date + metric.
- `MomentumBar.tsx` — “since your last workout” + “this week vs last” chips.
- `PlanProgressCard.tsx` — plan title, “Week X of Y”, progress bar; hidden when
  no active plan.
- `ExerciseSetTable.tsx` — per-exercise rows: sets list, top set, volume,
  `DeltaBadge`, PR star; exercise name links to `/me/exercises/[id]`.
- `DeltaBadge.tsx` — ▲/▼/— colored delta (leaf up, ember down, muted flat),
  reduced-motion safe.
- `RouteMap.tsx` — enhanced SVG route from `route_points` with ● start / ▲ end
  markers (extends the existing `route.ts` polyline logic).
- `SplitBars.tsx` — per-km/mi split rows with a proportional bar; fastest split
  highlighted.
- `ExerciseProgressionChart.tsx` — Recharts line: top-set weight + est-1RM trend.
- `BackLink.tsx` — “← Back” to `/me`.

Detail pages are server components; only chart components are client islands.

## Page content

**`/me` (enhanced):** `MomentumBar` and `PlanProgressCard` above the existing
heatmap/sections; an `ActivityFeed` (most recent ~20 workouts+tracks) near the
bottom. Existing sections, range toggle (incl. custom), and empty states stay.

**Workout detail:** header (day title, date, duration, avg HR, rating label from
`{too_easy:"Too easy", just_right:"Just right", too_hard:"Too hard"}`), total
volume + delta vs last time, then `ExerciseSetTable`. Empty/feedback-absent
states handled.

**Exercise progression:** header (name, PR + date, est-1RM, times trained),
`ExerciseProgressionChart`, and a compact per-session list. Empty state when the
exercise has no logged sets.

**Track detail:** header (mode, date, distance, duration, pace, elevation, HR) +
delta vs previous same-mode track, `RouteMap`, `SplitBars`.

## Design language

Reuses the `/me` system (ink/leaf/teal/ember/sun, Bricolage + Hanken). leaf =
workouts/strength, teal = outdoor, sun = streaks/PRs, ember = regressions/“down”
deltas. Dark, data-forward; respects `prefers-reduced-motion`.

## Security & testing

RLS-enforced ownership on every read; anon key + user session only; auth
re-checked per page. Pure modules (`feed`, `workoutDetail`, `trackDetail`/splits,
`exerciseHistory`/`oneRepMax`, `momentum`, `plan`, `geo`) get vitest fixtures →
expected output (vitest config already globs `lib/**/*.test.ts`). Pages/visual
components verify via `tsc`/`build`.

## Phasing (single spec, 4 plan phases)

1. **Hub:** `feed.ts`, `momentum.ts`, `plan.ts` + `ActivityFeed`/`FeedItem`,
   `MomentumBar`, `PlanProgressCard`; wire into `/me`.
2. **Workout detail:** `workoutDetail.ts`, `loadWorkoutDetail`, `ExerciseSetTable`,
   `DeltaBadge`, `/me/workouts/[id]`.
3. **Exercise progression:** `oneRepMax.ts`, `exerciseHistory.ts`,
   `loadExerciseHistory`, `ExerciseProgressionChart`, `/me/exercises/[id]`.
4. **Track detail:** `trackDetail.ts` (+ `computeSplits`, haversine),
   `loadTrackDetail`, `RouteMap`, `SplitBars`, `/me/tracks/[id]`.

## Out of scope (deferred)

- Editing data on the web (read-only).
- Real map tiles for routes (SVG only).
- Calories; community/social “labs” features (heatmap sharing, flyby).
- Notifications, CSV export.

## Schema references (project `ywkqixaobbjxdncvnqav`, all RLS-enabled)

- `workout_sessions(id, user_id, plan_id, day_id, started_at, duration_seconds,
  status, avg_hr)`; `plan_days(id, title, day_kind, week_id, index)`
- `session_sets(session_id, plan_exercise_id, set_index, reps_done, weight,
  completed_at)`; `plan_exercises(id, exercise_id)`; `exercises(id, name)`
- `workout_session_feedback(session_id, overall_rating ∈
  {too_easy, just_right, too_hard})`
- `track_sessions(id, user_id, mode, distance_meters, duration_seconds,
  route_points jsonb [{latitude, longitude, timestamp(ms)}], elevation_gain_meters,
  avg_hr, finished_at, created_at)`
- `user_plans(id, user_id, plan_id, started_at, current_week, current_day,
  completed_at)`; `plans(id, title, weeks_count)`; `plan_weeks(id, plan_id, index)`
