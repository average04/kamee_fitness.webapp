# Admin Dashboard — Design

Date: 2026-06-08

## Purpose

Give the Kamee admin a single overview screen of business and product health:
growth, monetization, engagement, and content-catalog metrics. It becomes the
landing screen of the admin panel.

## Route & navigation

- `/admin` stops redirecting to `/admin/exercises` and renders the dashboard.
- The panel header gains a **Dashboard** link (placed before **Exercises**).

## Data access

All aggregates read across every user, so they use the existing service-role
client `createAdminSupabase()` (bypasses RLS), behind `requireAdmin()`. No new
database migrations: exact totals use `count: "exact", head: true` queries;
30-day time series fetch only the relevant timestamp column for the window and
bucket by day in JS (bounded, cheap).

## Architecture

Mirrors the existing pure-vs-I/O split used by the exercise catalog.

- `lib/admin/metrics.ts` — pure, no I/O, unit-tested. `DashboardData` types plus
  helpers: `bucketByDay(timestamps, days, end)`, `pct(part, whole)`,
  `relativeTime(iso, now)`, `mergeActivity(...lists)` (merge + sort desc + cap).
- `app/admin/(panel)/metrics.ts` (`server-only`) — `loadDashboard()` runs every
  aggregate query in parallel (`Promise.all`) via `createAdminSupabase()` and
  returns a typed `DashboardData`. A failed sub-query degrades to a null/empty
  value rather than throwing the whole page.
- `app/admin/(panel)/page.tsx` — server component: `requireAdmin()` →
  `loadDashboard()` → render layout, passing data into client chart components.
- `components/admin/dashboard/` — `StatCard.tsx`, `ActivityFeed.tsx` (server),
  and Recharts client components (`"use client"`): `TrendChart`,
  `SessionsChart`, `StoreDonut`, `MuscleBars`.

## Layout (top → bottom)

1. **KPI row** — 6 cards, each with a 7-day delta where meaningful:
   Total users · New users (30d) · Waitlist (total + this week) ·
   Active subscriptions (+ premium conversion %) · Workouts (30d) ·
   Cardio sessions (30d).
2. **Charts:**
   - Signups — 30d (area): new users vs. waitlist, two series.
   - Sessions/day — 30d (stacked bar): workout vs. walk/run.
   - Subscriptions by store (donut) + will-renew vs. churning split.
   - Catalog: exercises by primary muscle (horizontal bars) + demo image/video
     coverage %.
3. **Recent activity feed** — newest ~15 events merged & time-sorted across:
   waitlist signups, new users, new subscriptions, workout sessions, exercises
   created. Each row: type icon, label, relative time.

## Metric definitions

| Metric | Source |
| --- | --- |
| Total users | `profiles` count |
| New users 30d / 7d | `profiles.created_at` in window |
| Waitlist total / this week | `waitlist` count, `created_at` |
| Active subscriptions | `subscriptions.status in (active, grace_period)` |
| Premium conversion % | active subs ÷ total users |
| Workouts 30d | `workout_sessions.started_at` in window |
| Cardio sessions 30d | `walk_run_sessions` in window |
| Subs by store | `subscriptions.store` group |
| Will-renew vs churn | `subscriptions.will_renew` among active |
| Exercises by muscle | `exercises.primary_muscle` group |
| Demo coverage | `exercises.demo_image_path` / `demo_video_path` not null |

## States

- Empty (zero rows): cards show `0`/`—`, charts show an empty placeholder.
- Sub-query error: that card/chart shows `—`; the page still renders.
- Styling matches the panel: `#07090a` bg, zinc borders, emerald-600 accent.

## Dependencies

- Add `recharts` (React 19 compatible) for the charts.

## Testing

- Unit tests for the pure helpers in `lib/admin/metrics.test.ts`
  (bucketing edges, percentage divide-by-zero, activity merge/cap, relative
  time).
- Live browser verification of the rendered dashboard via Browser MCP.

## Out of scope (YAGNI)

- Configurable date ranges / filters.
- Drill-down pages, CSV export.
- Realtime updates (page is server-rendered per request).
