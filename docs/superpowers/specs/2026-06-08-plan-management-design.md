# Plan Management — Design

Date: 2026-06-08

## Purpose

Give the Kamee admin full control of workout plans — the
`plans → plan_weeks → plan_days → plan_blocks → plan_exercises` tree — covering
both `system` (official library) and `custom` (user-built) plans. RLS blocks
users from writing system plans, so all admin mutations go through the
service-role client behind `requireAdmin()`.

Built in two phases; each ships working before the next begins.

## Route & navigation

- New section at `/admin/plans`.
- Header nav becomes: Dashboard · Plans · Exercises.

## Data model (reference)

- `plans`: title, summary, cover_image_path, goal, level (`experience`),
  weeks_count (1–52), est_minutes_per_session, price_cents, currency,
  is_published, is_default, required_equipment[], equipment_tier
  (`bodyweight|minimal|full_gym`), target_muscles[], review_status
  (`draft|in_review|approved|rejected`), kind (`system|custom`), author_id.
- `plan_weeks(plan_id, index)`, unique(plan_id, index).
- `plan_days(week_id, index, title, day_kind = workout|rest|active_recovery)`,
  unique(week_id, index).
- `plan_blocks(day_id, index, kind = warmup|main|cooldown|superset|circuit)`,
  unique(day_id, index).
- `plan_exercises(block_id, index, exercise_id, sets, reps, tempo,
  rest_seconds, weight_hint, notes)`, unique(block_id, index).

## Architecture (mirrors the exercises admin)

- `lib/admin/plans.ts` — pure, unit-tested: types (`PlanInput`, `Plan`, tree
  node types), enum option lists, `parsePlanForm`, `validatePlanInput`, and
  `resequence(ids, from, to)` for reorder math.
- `app/admin/(panel)/plans/queries.ts` — `listPlans(filters, page)`,
  `getPlan(id)`, `getPlanTree(id)`.
- `app/admin/(panel)/plans/actions.ts` — `"use server"`; every action calls
  `requireAdmin()` then uses `createAdminSupabase()`.
- Pages: `plans/page.tsx` (list), `plans/new/page.tsx`,
  `plans/[id]/edit/page.tsx` (metadata), `plans/[id]/page.tsx` (detail +
  builder).
- `components/admin/plans/` — `PlanTable`, `PlanFilters`, `PlanForm`, and the
  Phase-2 tree components.

## Phase 1 — list, metadata, lifecycle

- **List**: all plans; filter by `kind` (all/system/custom), `review_status`,
  and published; search by title. Columns: cover thumbnail, title, kind badge,
  level, weeks, equipment tier, price, published + review badges, default star.
  Paginated like the exercises list.
- **Create / edit metadata**: title, summary, goal, level, weeks_count,
  est_minutes_per_session, price_cents + currency, equipment_tier,
  required_equipment[], target_muscles[], kind, cover image (uploaded to the
  public `plan-covers` bucket, keyed by plan id).
- **Lifecycle actions**: publish/unpublish toggle; set review_status;
  set-as-default (clears `is_default` on all other plans first); delete (the
  tree cascades via FK `on delete cascade`).
- **Validation**: title required; weeks_count 1–52; price_cents ≥ 0; level,
  equipment_tier, kind, review_status must be valid enum values; currency
  defaults to USD.

## Phase 2 — tree builder (`plans/[id]`)

- **Weeks**: add (append), delete, move up/down.
- **Days** (within a week): add, delete, reorder; edit `day_kind` and title.
- **Blocks** (within a workout day): add, delete, reorder; edit `kind`.
- **Exercises** (within a block): add (pick from the exercise catalog), delete,
  reorder; edit sets, reps, tempo, rest_seconds, weight_hint, notes.
- **Ordering**: each level has `unique(parent, index)`. Because the constraints
  are immediate (not deferrable), reorder renumbers siblings in two passes —
  first offset every sibling into a high range, then assign final 0..n-1 — so
  no transient duplicate-index collision occurs. Adds append at `max+1`; deletes
  renumber to close gaps.
- **weeks_count sync**: adding/removing weeks updates `plans.weeks_count` to the
  current week count.

## States & styling

- Empty list / empty tree show friendly placeholders.
- Action errors surface inline (form state `{ errors?, message? }`); a failed
  query degrades rather than crashing.
- Dark panel styling: `#07090a` bg, zinc borders, emerald-600 accent — matches
  the existing admin.

## Testing

- Unit tests for the pure helpers (`validatePlanInput`, `parsePlanForm`,
  `resequence`).
- Live browser verification after each phase.

## Out of scope (YAGNI)

- Drag-and-drop reordering (move up/down buttons instead).
- Plan duplication / templating.
- Bulk actions, CSV import/export.
- Editing marketplace data (purchases, reviews, payouts).
