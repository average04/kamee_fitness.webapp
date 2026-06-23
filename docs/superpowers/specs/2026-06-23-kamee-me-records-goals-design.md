# Kamee `/me` — Records & Goals

**Date:** 2026-06-23
**Status:** Approved (build)

## Goal

Deepen the `/me` stats area with an all-time personal-records page, a weekly
training-goal card with an 8-week consistency strip, and a clickable activity
heatmap that drills into a single day. Builds on the existing `/me` patterns
(email-OTP auth, RLS reads, `lib/me/*` pure aggregation, units). Read-only.

## Decisions (locked in brainstorming)

- **Scope (all three):** all-time PRs page, weekly goal card (+ 8-week strip),
  heatmap day drill-down.
- **Weekly target:** the user's existing app setting `profiles.days_per_week`
  (read-only here); null target → show the count without a goal ring.
- **No new dependencies; reuses existing queries/aggregation.**

## Routes

```
/me                add WeeklyGoalCard; activity heatmap days become clickable
/me/records        all-time PRs — every exercise trained, heaviest first
/me/day/[date]     that day's workouts + tracks  ([date] = YYYY-MM-DD)
```

`/me/records` and `/me/day/[date]` are server components with `requireUser()`,
RLS-scoped reads, and a back-link to `/me`.

## Data layer (pure, unit-tested — `lib/me/`)

- **`records.ts`** — `RecordSet = { exerciseId: string; name: string; dateIso:
  string; reps: number; weightKg: number }`; `buildRecords(sets: RecordSet[]):
  ExerciseRecord[]` where `ExerciseRecord = { exerciseId, name, prKg, prDateIso,
  est1RmKg, timesTrained, lastDoneIso }`. `prKg` = max top-set weight; `prDateIso`
  = its date; `est1RmKg` = best Epley across all sets (reuses `epley1Rm`);
  `timesTrained` = distinct dates; `lastDoneIso` = latest date. Sorted by `prKg`
  desc. Sets with `weightKg <= 0` ignored for PR but counted for timesTrained.
- **`goal.ts`** — `WeeklyGoal = { target: number; thisWeekCount: number;
  history: { weekStartIso: string; count: number; hit: boolean }[] }`;
  `buildWeeklyGoal(workouts: WorkoutSessionRow[], now: Date, targetDays: number,
  weeks: number): WeeklyGoal`. Counts **completed** workouts per ISO week
  (UTC Monday start) for the last `weeks` weeks (oldest→newest, current last);
  `hit = target > 0 && count >= target`; `thisWeekCount` = the latest week's
  count.

## Query reuse (extend `loadMeData`)

The `plan_exercises` lookup `loadMeData` already runs gains `exercise_id`:
```ts
.select("id, exercise_id, exercises(name)")
```
`MeData` gains `exerciseIdByPlanEx: Record<string,string>` and
`nameByExercise: Record<string,string>` (existing `exerciseNames` kept). The
records page flattens existing `MeData` (`sets` + completed-workout dates +
these maps) into `RecordSet[]` — no new heavy query.

The day page calls `loadMeData`, filters `workouts`/`tracks` to the `[date]`
(by the day portion of `started_at` / `finished_at ?? created_at`), and reuses
`buildFeed` to render the day's items.

## Components (`components/me/`)

- **`WeeklyGoalCard`** — "{thisWeekCount} / {target}" with a segmented progress
  bar (or count-only when target is 0) plus an 8-dot hit/miss strip (filled =
  hit). Sits alongside `MomentumBar` / `PlanProgressCard` on `/me`.
- **`RecordsList`** — rows linking to `/me/exercises/[id]`: name · PR weight ·
  date · est-1RM · times trained. Empty state when no records.
- **`ActivityHeatmap`** (modify) — wrap **active** day cells (`count > 0`) in an
  SVG `<a href="/me/day/<date>">`; empty cells stay inert. Title tooltips kept.
- Pages: `app/me/records/page.tsx`, `app/me/day/[date]/page.tsx`.
- A small **"Records →"** link in the Workouts section heading on `/me`.

## Design language

Reuses the `/me` system (ink/leaf/teal/sun/ember, Bricolage + Hanken). leaf =
strength/PRs context, sun = goal-hit/achievement. Respects
`prefers-reduced-motion`. Honest empty states (no records / nothing on this day).

## Layout

```
WeeklyGoalCard:   Weekly goal  3 / 4  ▓▓▓░     ●●●○●●●○

/me/records:      ← Back · Personal records
                  Bench Press   100 kg · Jun 12 · 1RM 112 · 8×  →
                  Squat         140 kg · Jun 10 · 1RM 158 · 6×  →

/me/day/2026-06-20:  ← Back · Sat, Jun 20
                     ▸ Full Body B · 12.4 t  →
                     ▸ Run · 5.0 km          →
```

## Security & testing

RLS-enforced ownership; anon key + user session; `requireUser()` per page.
`buildRecords` and `buildWeeklyGoal` get vitest fixtures → expected output
(vitest globs `lib/**/*.test.ts`). Pages/visual verify via `tsc`/`build`.
A `/me/day/[date]` with no activity renders a friendly empty state (not 404).

## Out of scope (deferred)

- Editing the weekly target on the web (it mirrors the app setting).
- Records for outdoor tracks (this page is lifting PRs; track bests live on the
  track detail / dashboard).
- Sharing/export; community features.

## Schema references (project `ywkqixaobbjxdncvnqav`, RLS-enabled)

- `profiles(days_per_week int)`
- `workout_sessions(id, user_id, started_at, status)`;
  `session_sets(session_id, plan_exercise_id, reps_done, weight)`;
  `plan_exercises(id, exercise_id)`; `exercises(id, name)`;
  `track_sessions(id, user_id, mode, distance_meters, finished_at, created_at)`
