# Per-plan web + app links — design

**Date:** 2026-07-22 · **Status:** approved (chat) · **Branch:** `feat/plan-links`

## Goal

Give the partner API (and anyone else) two links per plan: one that shows the
plan on kamee.fit, and one that deep-links into the Kamee mobile app.

## Decisions (made with owner)

- **Web link → a real public plan page** at `https://kamee.fit/plans/<id>`
  (not a bare interstitial, not deferred).
- **App link → custom scheme** `kamee://plan/<id>` — works today with zero
  mobile-app changes; the app's expo-router `plan/[id]` screen fetches by the
  same `plans.id` UUID the API returns. Universal links (https opening the app
  directly) are explicitly **phase 2**: they need `associatedDomains`/intent
  filters in the app, an AASA file on kamee.fit, and a store release.

## Changes

### 1. Shared module `lib/public-plans.ts`

The API route and the new page need the same constants. Route files may not
export arbitrary names, so lift them into a small shared lib: `SITE_URL`,
`DISCIPLINES`, `DISCIPLINE_LABELS` (strength→Workouts, running→Outdoor),
`PLAN_COLUMNS` (the fixed 9-column public projection), `PlanRow` type, and
`planCoverUrl()` / `planWebUrl()` / `planAppUrl()` builders.

### 2. API: `app/api/plans/route.ts`

Each plan gains `webUrl` (`https://kamee.fit/plans/<id>`) and `appUrl`
(`kamee://plan/<id>`), built from the shared helpers. No auth, caching, or
filter changes — two computed strings only.

### 3. Public page `app/plans/[id]/page.tsx`

- Server component. `getPlan(id)` wrapped in React `cache()`: UUID-shape guard
  (garbage ids short-circuit to 404 instead of erroring in Postgres), then a
  fixed-column anon-client select with the explicit
  `is_published + review_status='approved'` filter; RLS is the second net.
  Missing/unpublished/error → `notFound()`.
- Renders: back-to-home link, cover image via `next/image` (Supabase host is
  already allowlisted; skipped when null), discipline badge, title, summary,
  stat chips (weeks, days/week, ~min/session, level — nulls and level "none"
  hidden), then CTAs: primary "Open in the Kamee app" (`kamee://plan/<id>`)
  plus the existing `StoreBadge` pair (iOS live, Android early access).
- `generateMetadata`: title (layout template appends "· Kamee Fitness"),
  description from summary, canonical `/plans/<id>`, OG image from the cover.
- Styling follows the landing conventions (ink-950 background, leaf accents,
  `font-display` headings).

### 4. SEO plumbing

- `app/sitemap.ts` becomes async: appends one entry per published+approved
  plan (`priority 0.6`, `lastModified` from `updated_at`), falling back to the
  static list if the query fails. Built at deploy time — fresh enough since
  every content change ships via a deploy anyway, and Netlify rebuilds it.
- `robots.ts` already allows `/plans` — no change.

### 5. Docs

`docs/PARTNER.md`: document both fields; guidance that `webUrl` is always safe
to render, `appUrl` only acts on a device with the app installed (the web page
itself carries the app CTAs for everyone else).

## Out of scope

Universal links (phase 2 above), a `/plans` index page, per-plan Android
deep-link QA beyond the scheme mapping.

## Verification

Local: API response carries both links; `/plans/<real id>` renders all
sections; garbage id and unpublished id → 404; lint + tsc + `next build`
green. Ship: merge → push → Netlify deploy → live checks on kamee.fit
(API fields + page + 404 + sitemap entries).
