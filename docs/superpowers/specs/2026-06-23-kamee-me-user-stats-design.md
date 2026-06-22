# Kamee Fitness — `/me` User Stats Area

**Date:** 2026-06-23
**Status:** Approved (build)

## Goal

Let an end user log in on the web with their existing Kamee account and see a
detailed, on-brand stats dashboard built from the data the mobile app already
writes to Supabase. This is phase one of a future "Strava Labs"-style area
(heatmaps, route replay) — out of scope here; this spec is **personal stats
only**.

## Decisions (locked in brainstorming)

- **Route:** `/me` (authenticated). Admin area at `/admin` is untouched.
- **Login:** **email OTP only** (magic-link / 6-digit code + Turnstile),
  reusing the existing flow. Google/Apple deferred.
- **Stat sections (v1):** Workouts, Outdoor tracks, Activity heatmap,
  Weight & body.
- **Charts:** a chart library (**Recharts**) for trend/bar/line charts;
  **hand-rolled SVG** for the activity heatmap and route thumbnails.
- **Landing link:** a subtle "Log in" link in the landing header.

## Stack & location

- Inside `kamee-fitness.webapp/` (Next.js 16 App Router, React 19, Tailwind 4,
  TS). Per `AGENTS.md`, skim the relevant `node_modules/next/dist/docs/` guides
  before coding.
- **One new dependency:** `recharts` (pin a React-19-compatible release; verify
  at install). Charts are client-only components. *Risk/mitigation:* if Recharts
  has a React 19 issue, fall back to `visx`; the chart components are isolated so
  the swap is contained.
- Reuses existing Supabase SSR clients (`lib/supabase/server.ts`,
  `lib/supabase/browser.ts`) and `app/auth/callback/route.ts`.

## Authentication & access

- **Login page** `app/login/page.tsx` (client): email field → Turnstile →
  `signInWithOtp({ email, options: { shouldCreateUser: false, captchaToken,
  emailRedirectTo: origin + '/auth/callback?next=/me' } })`, plus the 6-digit
  code path via `verifyOtp`. Modeled on `app/admin/login/page.tsx` but redirects
  to `/me` and has **no allowlist**. `shouldCreateUser: false` — only existing
  app accounts can sign in (no new users created from the web).
- **Callback:** reuse `app/auth/callback/route.ts` (already exchanges the PKCE
  code and honors `next`); we pass `next=/me`.
- **Gate** `lib/user/auth.ts` → `requireUser(): Promise<User>` — like
  `requireAdmin` (memoized via React `cache`) but **any authenticated user**;
  redirects to `/login` when there's no session. Re-checked in the page and in
  the sign-out action — never trust the proxy alone.
- **Sign out:** a Server Action (`app/me/actions.ts`) calling
  `supabase.auth.signOut()` then redirecting to `/`.
- **Security:** all reads use the **anon key + the user's cookie session**, so
  **RLS** enforces per-user ownership; queries also filter `user_id` defensively.
  The service-role key is never used in this path.

## Data layer (pure, unit-tested) — `lib/me/`

Server components fetch rows; pure functions aggregate; both are testable.

- `queries.ts` — typed fetchers given the server Supabase client + user id:
  profile, workout sessions (+ their sets), track sessions, streaks, weight log,
  subscription. RLS-scoped; explicit `.eq("user_id", …)` as defense.
- `workouts.ts` — from `workout_sessions` (status, started_at, duration_seconds,
  avg_hr) + `session_sets` (reps_done, weight, plan_exercise_id): completed
  sessions, **total volume** = Σ(reps_done × weight), time trained, per-week
  buckets, **top exercises** and **per-exercise PRs** (max weight), resolving
  exercise names via `plan_exercises → exercises`. Streak comes from
  `user_streaks` (current/longest).
- `tracks.ts` — from `track_sessions` (mode, distance_meters, duration_seconds,
  elevation_gain_meters, avg_hr, finished_at): total distance, duration, count,
  **avg pace**, elevation, splits by mode (walk/run/cycle); track streak from
  `user_streaks` (track_current_streak / track_longest_streak); recent routes
  (id, mode, distance, route_points) for thumbnails.
- `heatmap.ts` — merge workout `started_at` + track `finished_at` into a map of
  `YYYY-MM-DD → count`, plus helpers to lay out a 53-week × 7-day grid.
- `weight.ts` — `weight_log` (weight_kg, logged_at) as a time series + goal
  progress from `profiles.target_weight_kg` / `target_date`.
- `units.ts` — formatters honoring `profiles.units` (metric/imperial): weight
  (kg/lb), distance (km/mi), pace (min/km or min/mi), duration (h m), volume.
- `range.ts` — `Range = "week" | "month" | "all"`; pure date-window filter used
  by the headline stat cards.

Each module has a `*.test.ts` (node env) with row fixtures → expected output.
Vitest config already includes `lib/**/*.test.ts`.

## Page & components

- `app/me/page.tsx` (server): `requireUser()` → fetch via `queries.ts` →
  aggregate → render. Reads `?range` (default `all`) for headline stats; trend
  charts always show full history.
- `app/me/actions.ts` — `signOut` server action.
- `components/me/`:
  - `MeHeader.tsx` — avatar + display_name + premium badge (from
    `subscriptions`/`profiles.is_premium`) + `RangeToggle` + sign-out.
  - `RangeToggle.tsx` (client) — Week / Month / All, updates `?range`.
  - `StatCard.tsx` — label + big value + optional sub, accent (leaf/teal/sun).
  - `ActivityHeatmap.tsx` — hand-rolled SVG calendar (workouts + tracks),
    intensity shaded; `aria` summary.
  - `WorkoutsPerWeekChart.tsx` (client, Recharts bar).
  - `TopExercises.tsx`, `PersonalRecords.tsx` — lists.
  - `TrackList.tsx` + `RouteThumbnail.tsx` — hand-rolled SVG polyline from
    `route_points` (lat/lng normalized to a viewBox; no map tiles/API key).
  - `DistancePerWeekChart.tsx` (client, Recharts area).
  - `WeightChart.tsx` (client, Recharts line) + goal annotation.
  - `EmptyState.tsx` — friendly per-section "nothing logged yet" with an
    "open the app" nudge.
- `components/landing/Header.tsx` — add a subtle "Log in" link → `/login`.

Chart components are client islands fed plain serializable data from the server
page; everything else stays server-rendered.

## Design language

Reuses the landing system (ink backgrounds; Bricolage display + Hanken body;
leaf/teal/ember/sun tokens). Color semantics mirror the app: **leaf** = workouts,
**teal** = outdoor tracks, **sun** = streaks/achievements. Dark, data-forward,
Strava-Labs-ish: big numbers, clean charts, the heatmap as the hero band.
Respects `prefers-reduced-motion`.

## Layout

```
/me  (signed in)
┌──────────────────────────────────────────────────┐
│ ◍ Kamee   Jay ⬡PREMIUM    [Week|Month|All]    ⎋   │
├──────────────────────────────────────────────────┤
│ ACTIVITY  ▓▓░▓▓▓░░▓▓▓▓░  training-year heatmap     │
├──────────────────────────────────────────────────┤
│ WORKOUTS (leaf)                                    │
│ [42 sessions][🔥9 / 14 best][12.4 t][6h trained]  │
│ ▁▃▆█▅▂ workouts/week  ·  Top lifts  ·  PRs         │
├──────────────────────────────────────────────────┤
│ OUTDOOR TRACKS (teal)                              │
│ [38.2 km][12 runs][4:12/km][↑320 m][🔥10]         │
│ recent routes ◠◡ ◜◝ ⌇   ·  ▁▂▅▇ distance/week     │
├──────────────────────────────────────────────────┤
│ WEIGHT & BODY                                      │
│ 63 → 60 kg   ●╲╲╲● trend   −3 kg to go             │
└──────────────────────────────────────────────────┘

/login → email code (Turnstile) → /auth/callback?next=/me → /me
```

## Out of scope (deferred)

- Google / Apple web sign-in (email OTP only for now).
- Calories (not stored; the app shows a rough estimate — omit rather than
  fabricate; add an estimate formula later if wanted).
- Strava-Labs features: community heatmap, route replay / flyby, public
  profiles, sharing.
- Editing data on the web (read-only dashboard; logging stays in the app).
- A real map tile view for routes (v1 uses lightweight SVG polylines).

## Notable schema references (project `ywkqixaobbjxdncvnqav`)

- `workout_sessions(user_id, plan_id, day_id, started_at, ended_at,
  duration_seconds, status, avg_hr, max_hr)`
- `session_sets(session_id, plan_exercise_id, set_index, reps_done, weight,
  completed_at)`
- `track_sessions(user_id, mode, title, distance_meters, duration_seconds,
  route_points jsonb, finished_at, avg_hr, elevation_gain_meters, …)`
- `user_streaks(user_id, current_streak, longest_streak, last_session_date,
  track_current_streak, track_longest_streak, track_last_date)`
- `weight_log(user_id, weight_kg, logged_at)`
- `profiles(id, display_name, avatar_url, units, target_weight_kg, target_date,
  is_premium, …)`
- `subscriptions(user_id, status, current_period_end, will_renew)`
- All listed tables have **RLS enabled**.
