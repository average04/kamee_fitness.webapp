# Kamee `/me` v2 — Detail Pages & Progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/me` into a navigable hub — activity feed, momentum + plan cards, and workout/exercise/track detail pages with progress-vs-last-session signals.

**Architecture:** Build on the existing `/me` area. Pure aggregation in `lib/me/*` (vitest-tested), RLS-scoped query fetchers in `lib/me/queries.ts`, server-component detail pages under `app/me/*`, Recharts client islands, hand-rolled SVG for routes/splits/heatmap. All four phases land on one branch; merge once green.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, TypeScript, Supabase SSR (anon key + cookies + RLS), vitest (node), Recharts (already installed).

## Global Constraints

- **Security:** anon key + user cookie session only; RLS enforces ownership; queries also filter `user_id`/ownership defensively. A foreign id returns no rows → `notFound()`. Detail pages call `requireUser()`.
- **Next 16:** `params` and `searchParams` are Promises — `await` them. Read the bundled docs (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`) before coding.
- **No new dependencies.** Recharts is in; routes/splits are SVG.
- **Units:** every displayed number honors `profiles.units` via `lib/me/units.ts`.
- **Palette:** leaf = workouts/strength, teal = outdoor, sun = streaks/PRs, ember = “down” deltas. Bricolage + Hanken. Respect `prefers-reduced-motion`.
- **Tests:** pure modules under `lib/me/*.test.ts`; pages/visual verify via `tsc`/`build`.
- **Enums:** workout `status` count `completed` only; ratings `{too_easy, just_right, too_hard}`; route point = `{latitude, longitude, timestamp(ms)}`.
- **Commands in** `kamee-fitness.webapp/`. Branch: `feat/me-detail-progress`.

---

## PHASE 1 — Hub (feed + momentum + plan card)

### Task 1: Feed, momentum, plan summary (pure, TDD)

**Files:**
- Create: `lib/me/feed.ts`, `lib/me/momentum.ts`, `lib/me/plan.ts`
- Test: `lib/me/hub.test.ts`

**Interfaces:**
- Consumes: `WorkoutSessionRow`, `SessionSetRow`, `TrackSessionRow` from `./queries`.
- Produces:
  - `FeedItem` (union, below); `buildFeed(workouts, sets, tracks, dayTitleBySession, limit): FeedItem[]`
  - `Momentum`; `buildMomentum(workouts, tracks, now): Momentum`
  - `PlanProgressInput`, `PlanSummary`; `summarizePlan(input): PlanSummary | null`

- [ ] **Step 1: Write the failing test**

```ts
// lib/me/hub.test.ts
import { describe, expect, it } from "vitest";
import { buildFeed } from "./feed";
import { buildMomentum } from "./momentum";
import { summarizePlan } from "./plan";
import type { SessionSetRow, TrackSessionRow, WorkoutSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z"); // a Tuesday
const workouts: WorkoutSessionRow[] = [
  { id: "w1", started_at: "2026-06-22T08:00:00Z", duration_seconds: 1800, status: "completed", avg_hr: null },
  { id: "w2", started_at: "2026-06-15T08:00:00Z", duration_seconds: 1800, status: "completed", avg_hr: null },
  { id: "w3", started_at: "2026-06-21T08:00:00Z", duration_seconds: 1, status: "abandoned", avg_hr: null },
];
const sets: SessionSetRow[] = [
  { session_id: "w1", plan_exercise_id: "p1", reps_done: 10, weight: 50 },
  { session_id: "w1", plan_exercise_id: "p1", reps_done: 10, weight: 50 },
];
const tracks: TrackSessionRow[] = [
  { id: "t1", mode: "run", title: null, distance_meters: 5000, duration_seconds: 1500, elevation_gain_meters: 0, avg_hr: null, finished_at: "2026-06-23T07:00:00Z", created_at: "2026-06-23T07:00:00Z", route_points: [] },
];

describe("buildFeed", () => {
  it("merges completed workouts + tracks, newest first, with title + metric", () => {
    const feed = buildFeed(workouts, sets, tracks, { w1: "Full Body B" }, 10);
    expect(feed.map((f) => f.id)).toEqual(["t1", "w1", "w2"]); // w3 abandoned dropped
    const w1 = feed.find((f) => f.id === "w1")!;
    expect(w1).toMatchObject({ kind: "workout", title: "Full Body B", volumeKg: 1000 });
    const t1 = feed.find((f) => f.id === "t1")!;
    expect(t1).toMatchObject({ kind: "track", title: "Run", distanceM: 5000 });
  });
  it("respects the limit", () => {
    expect(buildFeed(workouts, sets, tracks, {}, 1)).toHaveLength(1);
  });
});

describe("buildMomentum", () => {
  it("computes days-since + this/last week counts (completed only)", () => {
    const m = buildMomentum(workouts, tracks, now);
    expect(m.daysSinceLastWorkout).toBe(1); // w1 on Jun 22
    expect(m.workoutsThisWeek).toBe(1); // week starts Mon Jun 22 -> w1
    expect(m.workoutsLastWeek).toBe(1); // Jun 15
    expect(m.distanceThisWeekM).toBe(5000); // t1 on Jun 23
  });
});

describe("summarizePlan", () => {
  it("computes percent and passes fields through", () => {
    expect(summarizePlan({ title: "X", currentWeek: 3, totalWeeks: 6 })).toEqual({
      title: "X", currentWeek: 3, totalWeeks: 6, pct: 50,
    });
  });
  it("is null when no active plan and clamps", () => {
    expect(summarizePlan(null)).toBeNull();
    expect(summarizePlan({ title: "X", currentWeek: 9, totalWeeks: 6 })!.pct).toBe(100);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run lib/me/hub.test.ts`).

- [ ] **Step 3: Implement**

```ts
// lib/me/feed.ts
import type { SessionSetRow, TrackSessionRow, WorkoutSessionRow } from "./queries";

export type FeedItem =
  | { kind: "workout"; id: string; title: string; dateIso: string; volumeKg: number }
  | { kind: "track"; id: string; title: string; dateIso: string; distanceM: number };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function buildFeed(
  workouts: WorkoutSessionRow[],
  sets: SessionSetRow[],
  tracks: TrackSessionRow[],
  dayTitleBySession: Record<string, string>,
  limit: number,
): FeedItem[] {
  const volBySession = new Map<string, number>();
  for (const s of sets) {
    volBySession.set(
      s.session_id,
      (volBySession.get(s.session_id) ?? 0) + (s.reps_done ?? 0) * (s.weight ?? 0),
    );
  }
  const items: FeedItem[] = [];
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    items.push({
      kind: "workout",
      id: w.id,
      title: dayTitleBySession[w.id] ?? "Workout",
      dateIso: w.started_at,
      volumeKg: volBySession.get(w.id) ?? 0,
    });
  }
  for (const t of tracks) {
    items.push({
      kind: "track",
      id: t.id,
      title: cap(t.mode),
      dateIso: t.finished_at ?? t.created_at,
      distanceM: t.distance_meters ?? 0,
    });
  }
  items.sort((a, b) => Date.parse(b.dateIso) - Date.parse(a.dateIso));
  return items.slice(0, limit);
}
```

```ts
// lib/me/momentum.ts
import type { TrackSessionRow, WorkoutSessionRow } from "./queries";

export type Momentum = {
  daysSinceLastWorkout: number | null;
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  distanceThisWeekM: number;
  distanceLastWeekM: number;
};

const DAY_MS = 86_400_000;

/** UTC Monday-00:00 ms for the week containing `ms`. */
function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

export function buildMomentum(
  workouts: WorkoutSessionRow[],
  tracks: TrackSessionRow[],
  now: Date,
): Momentum {
  const completed = workouts.filter((w) => w.status === "completed");
  const thisStart = weekStart(now.getTime());
  const lastStart = thisStart - 7 * DAY_MS;

  let last: number | null = null;
  let workoutsThisWeek = 0;
  let workoutsLastWeek = 0;
  for (const w of completed) {
    const t = Date.parse(w.started_at);
    if (Number.isNaN(t)) continue;
    if (last == null || t > last) last = t;
    if (t >= thisStart) workoutsThisWeek++;
    else if (t >= lastStart) workoutsLastWeek++;
  }

  let distanceThisWeekM = 0;
  let distanceLastWeekM = 0;
  for (const tr of tracks) {
    const t = Date.parse(tr.finished_at ?? tr.created_at);
    if (Number.isNaN(t)) continue;
    const d = tr.distance_meters ?? 0;
    if (t >= thisStart) distanceThisWeekM += d;
    else if (t >= lastStart) distanceLastWeekM += d;
  }

  return {
    daysSinceLastWorkout:
      last == null ? null : Math.floor((now.getTime() - last) / DAY_MS),
    workoutsThisWeek,
    workoutsLastWeek,
    distanceThisWeekM,
    distanceLastWeekM,
  };
}
```

```ts
// lib/me/plan.ts
export type PlanProgressInput = {
  title: string;
  currentWeek: number;
  totalWeeks: number;
} | null;

export type PlanSummary = {
  title: string;
  currentWeek: number;
  totalWeeks: number;
  pct: number;
};

export function summarizePlan(input: PlanProgressInput): PlanSummary | null {
  if (!input) return null;
  const { title, currentWeek, totalWeeks } = input;
  const pct =
    totalWeeks > 0
      ? Math.max(0, Math.min(100, Math.round((currentWeek / totalWeeks) * 100)))
      : 0;
  return { title, currentWeek, totalWeeks, pct };
}
```

- [ ] **Step 4: Run — expect PASS.** Commit:

```bash
git add lib/me/feed.ts lib/me/momentum.ts lib/me/plan.ts lib/me/hub.test.ts && git commit -m "feat(me): feed, momentum, plan summary aggregation"
```

---

### Task 2: Query additions — day titles + plan progress

**Files:**
- Modify: `lib/me/queries.ts`

**Interfaces:**
- Produces: `MeData` gains `dayTitleBySession: Record<string,string>`; `loadPlanProgress(supabase, userId): Promise<PlanProgressInput>`.

- [ ] **Step 1: Add `day_id` to the workouts select** in `loadMeData` (so we can resolve titles):

Change the `workout_sessions` select string to:
```ts
.select("id, started_at, duration_seconds, status, avg_hr, day_id")
```
and add `day_id: string | null` to `WorkoutSessionRow`.

- [ ] **Step 2: After fetching `workouts`, resolve day titles** (inside `loadMeData`, before the return):

```ts
  const dayTitleBySession: Record<string, string> = {};
  const dayIds = [...new Set(workouts.map((w) => w.day_id).filter(Boolean) as string[])];
  if (dayIds.length) {
    const daysRes = await supabase
      .from("plan_days")
      .select("id, title")
      .in("id", dayIds);
    const titleByDay = new Map(
      ((daysRes.data ?? []) as { id: string; title: string | null }[]).map((d) => [
        d.id,
        d.title ?? "Workout",
      ]),
    );
    for (const w of workouts) {
      if (w.day_id && titleByDay.has(w.day_id)) {
        dayTitleBySession[w.id] = titleByDay.get(w.day_id)!;
      }
    }
  }
```
Add `dayTitleBySession` to the `MeData` type and to the returned object.

- [ ] **Step 3: Add `loadPlanProgress`** (export from `queries.ts`):

```ts
import type { PlanProgressInput } from "./plan";

export async function loadPlanProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanProgressInput> {
  const { data: up } = await supabase
    .from("user_plans")
    .select("plan_id, current_week")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!up) return null;
  const { data: plan } = await supabase
    .from("plans")
    .select("title, weeks_count")
    .eq("id", (up as { plan_id: string }).plan_id)
    .maybeSingle();
  if (!plan) return null;
  const p = plan as { title: string | null; weeks_count: number | null };
  return {
    title: p.title ?? "Your plan",
    currentWeek: (up as { current_week: number | null }).current_week ?? 0,
    totalWeeks: p.weeks_count ?? 0,
  };
}
```

- [ ] **Step 4: Verify** (`npx tsc --noEmit`). Commit:

```bash
git add lib/me/queries.ts && git commit -m "feat(me): query day titles + active plan progress"
```

---

### Task 3: Hub components + wire into `/me`

**Files:**
- Create: `components/me/FeedItem.tsx`, `ActivityFeed.tsx`, `MomentumBar.tsx`, `PlanProgressCard.tsx`
- Modify: `app/me/page.tsx`

**Interfaces:**
- Consumes: `FeedItem` from `@/lib/me/feed`; `Momentum`; `PlanSummary`; `fmtDistance`, `fmtVolume`, `Units`.

- [ ] **Step 1: Write the components**

```tsx
// components/me/FeedItem.tsx
import Link from "next/link";
import type { FeedItem as Item } from "@/lib/me/feed";
import { fmtDistance, fmtVolume, type Units } from "@/lib/me/units";

export default function FeedItem({ item, units }: { item: Item; units: Units }) {
  const href =
    item.kind === "workout" ? `/me/workouts/${item.id}` : `/me/tracks/${item.id}`;
  const metric =
    item.kind === "workout"
      ? fmtVolume(item.volumeKg, units)
      : fmtDistance(item.distanceM, units);
  const date = item.dateIso.slice(0, 10);
  const accent = item.kind === "workout" ? "text-leaf-400" : "text-teal-500";
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-leaf-500/30"
    >
      <div className="min-w-0">
        <div className="truncate font-display text-sm font-semibold text-mist">
          {item.title}
        </div>
        <div className="text-xs text-muted">{date}</div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className={accent}>{metric}</span>
        <span className="text-muted" aria-hidden>→</span>
      </div>
    </Link>
  );
}
```

```tsx
// components/me/ActivityFeed.tsx
import type { FeedItem as Item } from "@/lib/me/feed";
import type { Units } from "@/lib/me/units";
import FeedItem from "./FeedItem";

export default function ActivityFeed({
  items,
  units,
}: {
  items: Item[];
  units: Units;
}) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={`${it.kind}-${it.id}`}>
          <FeedItem item={it} units={units} />
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// components/me/MomentumBar.tsx
import type { Momentum } from "@/lib/me/momentum";

export default function MomentumBar({ m }: { m: Momentum }) {
  const since =
    m.daysSinceLastWorkout == null
      ? "No workouts yet"
      : m.daysSinceLastWorkout === 0
        ? "Trained today"
        : `${m.daysSinceLastWorkout}d since last workout`;
  const delta = m.workoutsThisWeek - m.workoutsLastWeek;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  const arrowColor =
    delta > 0 ? "text-leaf-400" : delta < 0 ? "text-ember-400" : "text-muted";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-mist/85">
        {since}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-mist/85">
        {m.workoutsThisWeek} this week{" "}
        <span className={arrowColor} aria-label={`change ${delta}`}>
          {arrow}
          {delta !== 0 ? Math.abs(delta) : ""}
        </span>
      </span>
    </div>
  );
}
```

```tsx
// components/me/PlanProgressCard.tsx
import type { PlanSummary } from "@/lib/me/plan";

export default function PlanProgressCard({ plan }: { plan: PlanSummary }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-sm font-semibold text-mist">
          {plan.title}
        </div>
        <div className="text-xs text-muted">
          Week {plan.currentWeek} of {plan.totalWeeks}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-leaf-500"
          style={{ width: `${plan.pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `app/me/page.tsx`** — add imports, load plan progress + build feed/momentum, render near top + bottom.

Add imports:
```tsx
import { loadMeData, loadPlanProgress } from "@/lib/me/queries";
import { buildFeed } from "@/lib/me/feed";
import { buildMomentum } from "@/lib/me/momentum";
import { summarizePlan } from "@/lib/me/plan";
import MomentumBar from "@/components/me/MomentumBar";
import PlanProgressCard from "@/components/me/PlanProgressCard";
import ActivityFeed from "@/components/me/ActivityFeed";
```
After `const data = await loadMeData(...)` add:
```tsx
  const planInput = await loadPlanProgress(supabase, user.id);
  const plan = summarizePlan(planInput);
  const momentum = buildMomentum(data.workouts, data.tracks, now);
  const feed = buildFeed(
    data.workouts,
    data.sets,
    data.tracks,
    data.dayTitleBySession,
    20,
  );
```
Render `MomentumBar` + `PlanProgressCard` directly under `<MeHeader />`:
```tsx
      <div className="mt-6 space-y-3">
        <MomentumBar m={momentum} />
        {plan && <PlanProgressCard plan={plan} />}
      </div>
```
And add a Recent section just before the closing `<footer>`:
```tsx
      <section className="mt-12">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Recent
        </h2>
        <div className="mt-4">
          <ActivityFeed items={feed} units={units} />
        </div>
      </section>
```

- [ ] **Step 3: Verify** (`npx tsc --noEmit && npx vitest run && npm run build`). Commit:

```bash
git add components/me app/me/page.tsx && git commit -m "feat(me): momentum + plan card + clickable activity feed on /me"
```

---

## PHASE 2 — Workout detail

### Task 4: Workout detail aggregation (pure, TDD)

**Files:**
- Create: `lib/me/workoutDetail.ts`
- Test: `lib/me/workoutDetail.test.ts`

**Interfaces:**
- Produces: `SetWithExercise = { exerciseId: string; reps: number; weightKg: number }`; `ExerciseBlock`; `WorkoutDetailSummary`; `summarizeWorkoutDetail(current, previous, names, priorMaxByExercise): WorkoutDetailSummary`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/me/workoutDetail.test.ts
import { describe, expect, it } from "vitest";
import { summarizeWorkoutDetail, type SetWithExercise } from "./workoutDetail";

const cur: SetWithExercise[] = [
  { exerciseId: "e1", reps: 10, weightKg: 50 },
  { exerciseId: "e1", reps: 8, weightKg: 60 },
  { exerciseId: "e2", reps: 12, weightKg: 20 },
];
const prev: SetWithExercise[] = [
  { exerciseId: "e1", reps: 10, weightKg: 55 }, // prev top 55
  { exerciseId: "e2", reps: 12, weightKg: 20 },
];
const names = { e1: "Bench", e2: "Squat" };

describe("summarizeWorkoutDetail", () => {
  it("groups by exercise with volume, top set, and deltas vs previous", () => {
    const s = summarizeWorkoutDetail(cur, prev, names, { e1: 55 });
    const bench = s.exercises.find((e) => e.exerciseId === "e1")!;
    expect(bench.name).toBe("Bench");
    expect(bench.topSetKg).toBe(60);
    expect(bench.volumeKg).toBe(10 * 50 + 8 * 60);
    expect(bench.topDeltaKg).toBe(5); // 60 - 55
    expect(bench.isPr).toBe(true); // 60 > prior max 55
  });
  it("totals volume with delta; null deltas when no previous", () => {
    const s = summarizeWorkoutDetail(cur, [], names, {});
    expect(s.totalVolumeKg).toBe(10 * 50 + 8 * 60 + 12 * 20);
    expect(s.totalVolumeDeltaKg).toBeNull();
    expect(s.exercises[0].topDeltaKg).toBeNull();
    expect(s.exercises[0].isPr).toBe(false); // no prior history
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/me/workoutDetail.ts
export type SetWithExercise = {
  exerciseId: string;
  reps: number;
  weightKg: number;
};

export type ExerciseBlock = {
  exerciseId: string;
  name: string;
  sets: { reps: number; weightKg: number }[];
  topSetKg: number;
  volumeKg: number;
  topDeltaKg: number | null;
  volumeDeltaKg: number | null;
  isPr: boolean;
};

export type WorkoutDetailSummary = {
  totalVolumeKg: number;
  totalVolumeDeltaKg: number | null;
  exercises: ExerciseBlock[];
};

type Agg = { sets: { reps: number; weightKg: number }[]; top: number; vol: number };

function group(sets: SetWithExercise[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const s of sets) {
    const a = m.get(s.exerciseId) ?? { sets: [], top: 0, vol: 0 };
    a.sets.push({ reps: s.reps, weightKg: s.weightKg });
    a.top = Math.max(a.top, s.weightKg);
    a.vol += s.reps * s.weightKg;
    m.set(s.exerciseId, a);
  }
  return m;
}

export function summarizeWorkoutDetail(
  current: SetWithExercise[],
  previous: SetWithExercise[],
  names: Record<string, string>,
  priorMaxByExercise: Record<string, number>,
): WorkoutDetailSummary {
  const cur = group(current);
  const prev = group(previous);
  const hasPrev = previous.length > 0;

  const exercises: ExerciseBlock[] = [...cur.entries()].map(([exerciseId, a]) => {
    const p = prev.get(exerciseId);
    const priorMax = priorMaxByExercise[exerciseId];
    return {
      exerciseId,
      name: names[exerciseId] ?? "Exercise",
      sets: a.sets,
      topSetKg: a.top,
      volumeKg: a.vol,
      topDeltaKg: p ? a.top - p.top : null,
      volumeDeltaKg: p ? a.vol - p.vol : null,
      isPr: priorMax != null && a.top > priorMax,
    };
  });
  exercises.sort((x, y) => y.volumeKg - x.volumeKg);

  const totalVolumeKg = exercises.reduce((s, e) => s + e.volumeKg, 0);
  const prevTotal = [...prev.values()].reduce((s, a) => s + a.vol, 0);
  return {
    totalVolumeKg,
    totalVolumeDeltaKg: hasPrev ? totalVolumeKg - prevTotal : null,
    exercises,
  };
}
```

- [ ] **Step 4: Run — expect PASS.** Commit:

```bash
git add lib/me/workoutDetail.ts lib/me/workoutDetail.test.ts && git commit -m "feat(me): workout detail aggregation (deltas + PRs)"
```

---

### Task 5: `loadWorkoutDetail` query

**Files:**
- Modify: `lib/me/queries.ts`

**Interfaces:**
- Produces: `WorkoutDetailData` (`{ session, ratingLabel, dayTitle, summaryInput: { current, previous, names, priorMax } } | null`); `loadWorkoutDetail(supabase, userId, sessionId): Promise<WorkoutDetailData | null>`.

- [ ] **Step 1: Implement** (RLS scopes to owner; returns null when not found)

```ts
// add to lib/me/queries.ts
import type { SetWithExercise } from "./workoutDetail";

const RATING_LABEL: Record<string, string> = {
  too_easy: "Too easy",
  just_right: "Just right",
  too_hard: "Too hard",
};

export type WorkoutDetailData = {
  session: {
    id: string;
    startedAt: string;
    durationSeconds: number | null;
    avgHr: number | null;
  };
  dayTitle: string;
  ratingLabel: string | null;
  current: SetWithExercise[];
  previous: SetWithExercise[];
  names: Record<string, string>;
  priorMax: Record<string, number>;
};

/** Map raw session_sets rows + a planEx→exercise map into SetWithExercise. */
function toSets(
  rows: { plan_exercise_id: string | null; reps_done: number | null; weight: number | null }[],
  exByPlanEx: Map<string, { id: string; name: string }>,
): SetWithExercise[] {
  const out: SetWithExercise[] = [];
  for (const r of rows) {
    const ex = r.plan_exercise_id ? exByPlanEx.get(r.plan_exercise_id) : undefined;
    if (!ex) continue;
    out.push({ exerciseId: ex.id, reps: r.reps_done ?? 0, weightKg: r.weight ?? 0 });
  }
  return out;
}

export async function loadWorkoutDetail(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<WorkoutDetailData | null> {
  const { data: s } = await supabase
    .from("workout_sessions")
    .select("id, user_id, day_id, started_at, duration_seconds, avg_hr, status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!s) return null;
  const sess = s as {
    id: string; day_id: string | null; started_at: string;
    duration_seconds: number | null; avg_hr: number | null;
  };

  const [{ data: curRows }, { data: fb }, { data: day }] = await Promise.all([
    supabase
      .from("session_sets")
      .select("plan_exercise_id, reps_done, weight")
      .eq("session_id", sessionId),
    supabase
      .from("workout_session_feedback")
      .select("overall_rating")
      .eq("session_id", sessionId)
      .maybeSingle(),
    sess.day_id
      ? supabase.from("plan_days").select("title").eq("id", sess.day_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Previous completed session of the same workout day.
  let prevRows: typeof curRows = [];
  if (sess.day_id) {
    const { data: prevSession } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("day_id", sess.day_id)
      .eq("status", "completed")
      .lt("started_at", sess.started_at)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevSession) {
      const { data } = await supabase
        .from("session_sets")
        .select("plan_exercise_id, reps_done, weight")
        .eq("session_id", (prevSession as { id: string }).id);
      prevRows = data ?? [];
    }
  }

  // Resolve plan_exercise_id -> { exercise id, name } for all involved rows.
  const planExIds = [
    ...new Set(
      [...(curRows ?? []), ...(prevRows ?? [])]
        .map((r) => r.plan_exercise_id)
        .filter(Boolean) as string[],
    ),
  ];
  const exByPlanEx = new Map<string, { id: string; name: string }>();
  if (planExIds.length) {
    const { data: pe } = await supabase
      .from("plan_exercises")
      .select("id, exercise_id, exercises(id, name)")
      .in("id", planExIds);
    for (const row of (pe ?? []) as Array<{
      id: string;
      exercise_id: string;
      exercises: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
    }>) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      if (ex) exByPlanEx.set(row.id, { id: ex.id, name: ex.name ?? "Exercise" });
    }
  }

  const current = toSets(curRows ?? [], exByPlanEx);
  const previous = toSets(prevRows ?? [], exByPlanEx);
  const names: Record<string, string> = {};
  for (const v of exByPlanEx.values()) names[v.id] = v.name;

  // Prior all-time max weight per exercise BEFORE this session (for PRs).
  const priorMax: Record<string, number> = {};
  const exIds = [...new Set(current.map((c) => c.exerciseId))];
  if (exIds.length) {
    // plan_exercises for these exercise ids
    const { data: peIds } = await supabase
      .from("plan_exercises")
      .select("id, exercise_id")
      .in("exercise_id", exIds);
    const exByPe = new Map(
      ((peIds ?? []) as { id: string; exercise_id: string }[]).map((r) => [r.id, r.exercise_id]),
    );
    if (exByPe.size) {
      const { data: priorSessions } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .lt("started_at", sess.started_at);
      const priorIds = ((priorSessions ?? []) as { id: string }[]).map((r) => r.id);
      if (priorIds.length) {
        const { data: priorSets } = await supabase
          .from("session_sets")
          .select("plan_exercise_id, weight")
          .in("session_id", priorIds)
          .in("plan_exercise_id", [...exByPe.keys()]);
        for (const r of (priorSets ?? []) as { plan_exercise_id: string | null; weight: number | null }[]) {
          const ex = r.plan_exercise_id ? exByPe.get(r.plan_exercise_id) : undefined;
          if (!ex || r.weight == null) continue;
          priorMax[ex] = Math.max(priorMax[ex] ?? 0, r.weight);
        }
      }
    }
  }

  const dayTitle = (day as { title?: string | null } | null)?.title ?? "Workout";
  const ratingLabel =
    fb && (fb as { overall_rating?: string }).overall_rating
      ? RATING_LABEL[(fb as { overall_rating: string }).overall_rating] ?? null
      : null;

  return {
    session: {
      id: sess.id,
      startedAt: sess.started_at,
      durationSeconds: sess.duration_seconds,
      avgHr: sess.avg_hr,
    },
    dayTitle,
    ratingLabel,
    current,
    previous,
    names,
    priorMax,
  };
}
```

- [ ] **Step 2: Verify** (`npx tsc --noEmit`). Commit:

```bash
git add lib/me/queries.ts && git commit -m "feat(me): loadWorkoutDetail (sets, prev-session, PR baselines)"
```

---

### Task 6: Workout detail page + components

**Files:**
- Create: `components/me/DeltaBadge.tsx`, `components/me/ExerciseSetTable.tsx`, `components/me/BackLink.tsx`, `app/me/workouts/[id]/page.tsx`

**Interfaces:**
- Consumes: `WorkoutDetailSummary`, `summarizeWorkoutDetail`; `loadWorkoutDetail`; `fmtVolume`, `fmtWeight`, `fmtDuration`, `Units`.

- [ ] **Step 1: Shared bits**

```tsx
// components/me/BackLink.tsx
import Link from "next/link";

export default function BackLink({ href = "/me", label = "Back" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="text-sm text-muted hover:text-leaf-300">
      ← {label}
    </Link>
  );
}
```

```tsx
// components/me/DeltaBadge.tsx
export default function DeltaBadge({
  delta,
  format,
}: {
  delta: number | null;
  format: (n: number) => string;
}) {
  if (delta == null) return null;
  if (delta === 0) return <span className="text-xs text-muted">—</span>;
  const up = delta > 0;
  return (
    <span className={"text-xs " + (up ? "text-leaf-400" : "text-ember-400")}>
      {up ? "▲" : "▼"} {format(Math.abs(delta))}
    </span>
  );
}
```

```tsx
// components/me/ExerciseSetTable.tsx
import Link from "next/link";
import type { WorkoutDetailSummary } from "@/lib/me/workoutDetail";
import { fmtVolume, fmtWeight, type Units } from "@/lib/me/units";
import DeltaBadge from "./DeltaBadge";

export default function ExerciseSetTable({
  summary,
  units,
}: {
  summary: WorkoutDetailSummary;
  units: Units;
}) {
  return (
    <div className="space-y-3">
      {summary.exercises.map((e) => (
        <Link
          key={e.exerciseId}
          href={`/me/exercises/${e.exerciseId}`}
          className="block rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-leaf-500/30"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-display font-semibold text-mist">
              {e.name}
              {e.isPr && <span className="ml-2 text-sun-500" title="Personal record">★ PR</span>}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-leaf-400">{fmtWeight(e.topSetKg, units)}</span>
              <DeltaBadge delta={e.topDeltaKg} format={(n) => fmtWeight(n, units)} />
            </div>
          </div>
          <div className="mt-1 text-xs text-muted">
            {e.sets.map((s, i) => (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {s.reps}×{fmtWeight(s.weightKg, units)}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            vol {fmtVolume(e.volumeKg, units)}
            <DeltaBadge delta={e.volumeDeltaKg} format={(n) => fmtVolume(n, units)} />
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: The page**

```tsx
// app/me/workouts/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData, loadWorkoutDetail } from "@/lib/me/queries";
import { summarizeWorkoutDetail } from "@/lib/me/workoutDetail";
import { fmtDuration, fmtVolume } from "@/lib/me/units";
import BackLink from "@/components/me/BackLink";
import DeltaBadge from "@/components/me/DeltaBadge";
import ExerciseSetTable from "@/components/me/ExerciseSetTable";

export const metadata = { title: "Workout" };

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const [detail, me] = await Promise.all([
    loadWorkoutDetail(supabase, user.id, id),
    loadMeData(supabase, user.id),
  ]);
  if (!detail) notFound();
  const units = me.profile?.units ?? "metric";

  const summary = summarizeWorkoutDetail(
    detail.current,
    detail.previous,
    detail.names,
    detail.priorMax,
  );

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <header className="mt-4 border-b border-white/8 pb-6">
        <h1 className="font-display text-2xl font-bold text-mist">{detail.dayTitle}</h1>
        <p className="mt-1 text-sm text-muted">
          {detail.session.startedAt.slice(0, 10)}
          {detail.session.durationSeconds
            ? ` · ${fmtDuration(detail.session.durationSeconds)}`
            : ""}
          {detail.session.avgHr ? ` · ♥ ${detail.session.avgHr}` : ""}
          {detail.ratingLabel ? ` · ${detail.ratingLabel}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-display text-xl font-bold text-leaf-400">
            {fmtVolume(summary.totalVolumeKg, units)}
          </span>
          <DeltaBadge
            delta={summary.totalVolumeDeltaKg}
            format={(n) => fmtVolume(n, units)}
          />
          <span className="text-xs text-muted">total volume vs last time</span>
        </div>
      </header>
      <div className="mt-6">
        {summary.exercises.length ? (
          <ExerciseSetTable summary={summary} units={units} />
        ) : (
          <p className="text-sm text-muted">No sets logged for this session.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add components/me/DeltaBadge.tsx components/me/ExerciseSetTable.tsx components/me/BackLink.tsx "app/me/workouts/[id]/page.tsx" && git commit -m "feat(me): workout detail page"
```

---

## PHASE 3 — Exercise progression

### Task 7: Est-1RM + exercise history (pure, TDD)

**Files:**
- Create: `lib/me/oneRepMax.ts`, `lib/me/exerciseHistory.ts`
- Test: `lib/me/exerciseHistory.test.ts`

**Interfaces:**
- Produces: `epley1Rm(weightKg, reps): number`; `SetWithDate = { dateIso: string; reps: number; weightKg: number }`; `ExerciseHistory`; `buildExerciseHistory(sets): ExerciseHistory`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/me/exerciseHistory.test.ts
import { describe, expect, it } from "vitest";
import { epley1Rm } from "./oneRepMax";
import { buildExerciseHistory, type SetWithDate } from "./exerciseHistory";

describe("epley1Rm", () => {
  it("returns weight for a single rep and applies Epley otherwise", () => {
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe("buildExerciseHistory", () => {
  const sets: SetWithDate[] = [
    { dateIso: "2026-06-01", reps: 10, weightKg: 50 },
    { dateIso: "2026-06-01", reps: 8, weightKg: 55 },
    { dateIso: "2026-06-10", reps: 5, weightKg: 60 },
  ];
  it("builds per-session series, PR, and times trained", () => {
    const h = buildExerciseHistory(sets);
    expect(h.timesTrained).toBe(2);
    expect(h.series).toHaveLength(2);
    expect(h.series[0]).toMatchObject({ dateIso: "2026-06-01", topSetKg: 55 });
    expect(h.prKg).toBe(60);
    expect(h.prDateIso).toBe("2026-06-10");
    expect(h.series[1].bestEst1RmKg).toBeCloseTo(70, 0); // 60*(1+5/30)=70
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/me/oneRepMax.ts
/** Epley estimated one-rep max. reps <= 1 returns the weight unchanged. */
export function epley1Rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
```

```ts
// lib/me/exerciseHistory.ts
import { epley1Rm } from "./oneRepMax";

export type SetWithDate = { dateIso: string; reps: number; weightKg: number };

export type ExerciseSession = {
  dateIso: string;
  topSetKg: number;
  volumeKg: number;
  bestEst1RmKg: number;
};

export type ExerciseHistory = {
  series: ExerciseSession[];
  prKg: number;
  prDateIso: string | null;
  timesTrained: number;
};

export function buildExerciseHistory(sets: SetWithDate[]): ExerciseHistory {
  const byDate = new Map<string, ExerciseSession>();
  for (const s of sets) {
    const e =
      byDate.get(s.dateIso) ??
      { dateIso: s.dateIso, topSetKg: 0, volumeKg: 0, bestEst1RmKg: 0 };
    e.topSetKg = Math.max(e.topSetKg, s.weightKg);
    e.volumeKg += s.reps * s.weightKg;
    e.bestEst1RmKg = Math.max(e.bestEst1RmKg, epley1Rm(s.weightKg, s.reps));
    byDate.set(s.dateIso, e);
  }
  const series = [...byDate.values()].sort((a, b) =>
    a.dateIso.localeCompare(b.dateIso),
  );
  let prKg = 0;
  let prDateIso: string | null = null;
  for (const e of series) {
    if (e.topSetKg > prKg) {
      prKg = e.topSetKg;
      prDateIso = e.dateIso;
    }
  }
  return { series, prKg, prDateIso, timesTrained: series.length };
}
```

- [ ] **Step 4: Run — expect PASS.** Commit:

```bash
git add lib/me/oneRepMax.ts lib/me/exerciseHistory.ts lib/me/exerciseHistory.test.ts && git commit -m "feat(me): Epley 1RM + exercise history aggregation"
```

---

### Task 8: `loadExerciseHistory` + progression page

**Files:**
- Modify: `lib/me/queries.ts`
- Create: `components/me/ExerciseProgressionChart.tsx`, `app/me/exercises/[id]/page.tsx`

**Interfaces:**
- Produces: `loadExerciseHistory(supabase, userId, exerciseId): Promise<{ name: string; sets: SetWithDate[] } | null>`.

- [ ] **Step 1: Query** — add to `queries.ts`:

```ts
import type { SetWithDate } from "./exerciseHistory";

export async function loadExerciseHistory(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string,
): Promise<{ name: string; sets: SetWithDate[] } | null> {
  const { data: ex } = await supabase
    .from("exercises")
    .select("name")
    .eq("id", exerciseId)
    .maybeSingle();
  if (!ex) return null;

  const { data: peRows } = await supabase
    .from("plan_exercises")
    .select("id")
    .eq("exercise_id", exerciseId);
  const peIds = ((peRows ?? []) as { id: string }[]).map((r) => r.id);
  if (!peIds.length) {
    return { name: (ex as { name: string | null }).name ?? "Exercise", sets: [] };
  }

  // The user's completed sessions (RLS-scoped) keyed by date.
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("status", "completed");
  const dateById = new Map(
    ((sessions ?? []) as { id: string; started_at: string }[]).map((s) => [
      s.id,
      s.started_at.slice(0, 10),
    ]),
  );
  if (!dateById.size) {
    return { name: (ex as { name: string | null }).name ?? "Exercise", sets: [] };
  }

  const { data: setRows } = await supabase
    .from("session_sets")
    .select("session_id, reps_done, weight")
    .in("plan_exercise_id", peIds)
    .in("session_id", [...dateById.keys()]);

  const sets: SetWithDate[] = [];
  for (const r of (setRows ?? []) as {
    session_id: string; reps_done: number | null; weight: number | null;
  }[]) {
    const dateIso = dateById.get(r.session_id);
    if (!dateIso || r.weight == null) continue;
    sets.push({ dateIso, reps: r.reps_done ?? 0, weightKg: r.weight });
  }
  return { name: (ex as { name: string | null }).name ?? "Exercise", sets };
}
```

- [ ] **Step 2: Chart**

```tsx
// components/me/ExerciseProgressionChart.tsx
"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ExerciseProgressionChart({
  data,
}: {
  data: { dateIso: string; topSetKg: number; est1RmKg: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="dateIso"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            width={32}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0e1416",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#eef4f0",
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="topSetKg" stroke="#9bd2a8" strokeWidth={2} dot={false} name="Top set" />
          <Line type="monotone" dataKey="est1RmKg" stroke="#efb54e" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Est 1RM" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Page**

```tsx
// app/me/exercises/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadExerciseHistory, loadMeData } from "@/lib/me/queries";
import { buildExerciseHistory } from "@/lib/me/exerciseHistory";
import { fmtWeight } from "@/lib/me/units";
import BackLink from "@/components/me/BackLink";
import ExerciseProgressionChart from "@/components/me/ExerciseProgressionChart";

export const metadata = { title: "Exercise" };

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const [hist, me] = await Promise.all([
    loadExerciseHistory(supabase, user.id, id),
    loadMeData(supabase, user.id),
  ]);
  if (!hist) notFound();
  const units = me.profile?.units ?? "metric";
  const h = buildExerciseHistory(hist.sets);
  const chart = h.series.map((s) => ({
    dateIso: s.dateIso,
    topSetKg: Math.round(s.topSetKg),
    est1RmKg: Math.round(s.bestEst1RmKg),
  }));
  const bestEst1Rm = h.series.reduce((m, s) => Math.max(m, s.bestEst1RmKg), 0);

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <header className="mt-4">
        <h1 className="font-display text-2xl font-bold text-mist">{hist.name}</h1>
        {h.timesTrained > 0 ? (
          <p className="mt-1 text-sm text-muted">
            PR {fmtWeight(h.prKg, units)}
            {h.prDateIso ? ` (${h.prDateIso})` : ""} · est 1RM{" "}
            {fmtWeight(bestEst1Rm, units)} · trained {h.timesTrained}×
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">No sets logged yet.</p>
        )}
      </header>
      {chart.length > 1 && (
        <div className="mt-6">
          <ExerciseProgressionChart data={chart} />
        </div>
      )}
      {chart.length > 0 && (
        <ul className="mt-6 space-y-1 text-sm text-mist/85">
          {[...h.series].reverse().map((s) => (
            <li key={s.dateIso} className="flex justify-between gap-3">
              <span className="text-muted">{s.dateIso}</span>
              <span>top {fmtWeight(s.topSetKg, units)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add lib/me/queries.ts components/me/ExerciseProgressionChart.tsx "app/me/exercises/[id]/page.tsx" && git commit -m "feat(me): exercise progression page (weight + est-1RM)"
```

---

## PHASE 4 — Track detail

### Task 9: Geo + splits + track-detail summary (pure, TDD)

**Files:**
- Create: `lib/me/geo.ts`, `lib/me/trackDetail.ts`
- Test: `lib/me/trackDetail.test.ts`

**Interfaces:**
- Produces: `haversineMeters(aLat,aLng,bLat,bLng): number`; `Split`; `computeSplits(routePoints, unitMeters): Split[]`; `TrackDetailSummary`; `summarizeTrackDetail(current, previous): TrackDetailSummary`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/me/trackDetail.test.ts
import { describe, expect, it } from "vitest";
import { haversineMeters } from "./geo";
import { computeSplits, summarizeTrackDetail } from "./trackDetail";

describe("haversineMeters", () => {
  it("approximates a short distance", () => {
    // ~111.2 m per 0.001° latitude near the equator
    const d = haversineMeters(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });
});

describe("computeSplits", () => {
  it("emits one split per unit of distance using point timestamps", () => {
    // Walk north in 0.0005° steps (~55.6 m), 60s apart, ~1.1 km total.
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      pts.push({ latitude: i * 0.0005, longitude: 0, timestamp: i * 60_000 });
    }
    const splits = computeSplits(pts, 1000);
    expect(splits.length).toBeGreaterThanOrEqual(1);
    expect(splits[0].distanceM).toBeCloseTo(1000, -2); // ~1000 m
    expect(splits[0].durationS).toBeGreaterThan(0);
  });
  it("returns [] for too few points", () => {
    expect(computeSplits([], 1000)).toEqual([]);
  });
});

describe("summarizeTrackDetail", () => {
  it("computes pace and deltas vs previous", () => {
    const s = summarizeTrackDetail(
      { distanceM: 5000, durationS: 1500 },
      { distanceM: 5000, durationS: 1600 },
    );
    expect(s.paceSecPerKm).toBeCloseTo(300, 0); // 1500/5
    expect(s.paceDeltaSecPerKm).toBeCloseTo(-20, 0); // 20s/km faster
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// lib/me/geo.ts
const R = 6_371_000; // earth radius m
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
```

```ts
// lib/me/trackDetail.ts
import { haversineMeters } from "./geo";

type RawPoint = { latitude?: number; longitude?: number; lat?: number; lng?: number; timestamp?: number };

export type Split = {
  index: number;
  distanceM: number;
  durationS: number;
  paceSecPerUnit: number;
  partial: boolean;
};

function coerce(routePoints: unknown): { lat: number; lng: number; t: number }[] {
  if (!Array.isArray(routePoints)) return [];
  const out: { lat: number; lng: number; t: number }[] = [];
  for (const p of routePoints as RawPoint[]) {
    const lat = p.latitude ?? p.lat;
    const lng = p.longitude ?? p.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      out.push({ lat, lng, t: typeof p.timestamp === "number" ? p.timestamp : 0 });
    }
  }
  return out;
}

export function computeSplits(routePoints: unknown, unitMeters: number): Split[] {
  const pts = coerce(routePoints);
  if (pts.length < 2) return [];
  const splits: Split[] = [];
  let segStartT = pts[0].t;
  let accumulated = 0; // distance into the current split
  let index = 1;
  for (let i = 1; i < pts.length; i++) {
    const d = haversineMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    accumulated += d;
    if (accumulated >= unitMeters) {
      const durationS = (pts[i].t - segStartT) / 1000;
      splits.push({
        index,
        distanceM: accumulated,
        durationS,
        paceSecPerUnit: durationS, // one full unit
        partial: false,
      });
      index++;
      segStartT = pts[i].t;
      accumulated = 0;
    }
  }
  if (accumulated > 0) {
    const durationS = (pts[pts.length - 1].t - segStartT) / 1000;
    splits.push({
      index,
      distanceM: accumulated,
      durationS,
      paceSecPerUnit: accumulated > 0 ? durationS / (accumulated / unitMeters) : 0,
      partial: true,
    });
  }
  return splits;
}

export type TrackDetailSummary = {
  paceSecPerKm: number;
  paceDeltaSecPerKm: number | null;
  distanceDeltaM: number | null;
  durationDeltaS: number | null;
};

const paceSecPerKm = (distanceM: number, durationS: number) =>
  distanceM > 0 ? durationS / (distanceM / 1000) : 0;

export function summarizeTrackDetail(
  current: { distanceM: number; durationS: number },
  previous: { distanceM: number; durationS: number } | null,
): TrackDetailSummary {
  const cur = paceSecPerKm(current.distanceM, current.durationS);
  if (!previous) {
    return {
      paceSecPerKm: cur,
      paceDeltaSecPerKm: null,
      distanceDeltaM: null,
      durationDeltaS: null,
    };
  }
  const prev = paceSecPerKm(previous.distanceM, previous.durationS);
  return {
    paceSecPerKm: cur,
    paceDeltaSecPerKm: cur - prev,
    distanceDeltaM: current.distanceM - previous.distanceM,
    durationDeltaS: current.durationS - previous.durationS,
  };
}
```

- [ ] **Step 4: Run — expect PASS.** Commit:

```bash
git add lib/me/geo.ts lib/me/trackDetail.ts lib/me/trackDetail.test.ts && git commit -m "feat(me): haversine + splits + track-detail summary"
```

---

### Task 10: `loadTrackDetail` + track page + RouteMap + SplitBars

**Files:**
- Modify: `lib/me/queries.ts`
- Create: `components/me/RouteMap.tsx`, `components/me/SplitBars.tsx`, `app/me/tracks/[id]/page.tsx`

**Interfaces:**
- Produces: `loadTrackDetail(supabase, userId, trackId): Promise<{ track: TrackSessionRow; previous: { distanceM: number; durationS: number } | null } | null>`.

- [ ] **Step 1: Query** — add to `queries.ts`:

```ts
export async function loadTrackDetail(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
): Promise<{ track: TrackSessionRow; previous: { distanceM: number; durationS: number } | null } | null> {
  const { data: t } = await supabase
    .from("track_sessions")
    .select(
      "id, user_id, mode, title, distance_meters, duration_seconds, elevation_gain_meters, avg_hr, finished_at, created_at, route_points",
    )
    .eq("id", trackId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!t) return null;
  const track = t as TrackSessionRow & { user_id: string };
  const when = track.finished_at ?? track.created_at;

  const { data: prev } = await supabase
    .from("track_sessions")
    .select("distance_meters, duration_seconds, finished_at, created_at")
    .eq("user_id", userId)
    .eq("mode", track.mode)
    .neq("id", trackId)
    .or(`finished_at.lt.${when},and(finished_at.is.null,created_at.lt.${when})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previous = prev
    ? {
        distanceM: (prev as { distance_meters: number | null }).distance_meters ?? 0,
        durationS: (prev as { duration_seconds: number | null }).duration_seconds ?? 0,
      }
    : null;
  return { track, previous };
}
```

- [ ] **Step 2: RouteMap** (enhanced SVG; reuses the polyline math, adds markers)

```tsx
// components/me/RouteMap.tsx
import { routeToPolyline } from "@/lib/me/route";

const SIZE = 320;

export default function RouteMap({ routePoints }: { routePoints: unknown }) {
  const points = routeToPolyline(routePoints, SIZE);
  if (!points) {
    return (
      <div className="grid h-44 place-items-center rounded-2xl border border-white/8 bg-white/[0.02] text-xs text-muted">
        No route recorded
      </div>
    );
  }
  const coords = points.split(" ");
  const [sx, sy] = coords[0].split(",");
  const [ex, ey] = coords[coords.length - 1].split(",");
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full rounded-2xl border border-white/8 bg-white/[0.02]"
      role="img"
      aria-label="Route map"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-teal-500)"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={sx} cy={sy} r={5} fill="#9bd2a8" />
      <circle cx={ex} cy={ey} r={5} fill="#efb54e" />
    </svg>
  );
}
```

- [ ] **Step 3: SplitBars**

```tsx
// components/me/SplitBars.tsx
import type { Split } from "@/lib/me/trackDetail";
import type { Units } from "@/lib/me/units";

function pace(secPerUnit: number): string {
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SplitBars({
  splits,
  units,
}: {
  splits: Split[];
  units: Units;
}) {
  if (!splits.length) return null;
  const unit = units === "imperial" ? "mi" : "km";
  const full = splits.filter((s) => !s.partial);
  const fastest = full.length
    ? Math.min(...full.map((s) => s.paceSecPerUnit))
    : 0;
  const slowest = full.length
    ? Math.max(...full.map((s) => s.paceSecPerUnit))
    : 1;
  const span = Math.max(1, slowest - fastest);
  return (
    <ul className="space-y-1.5">
      {splits.map((s) => {
        const isFastest = !s.partial && s.paceSecPerUnit === fastest;
        const width = s.partial
          ? 40
          : 40 + (1 - (s.paceSecPerUnit - fastest) / span) * 60;
        return (
          <li key={s.index} className="flex items-center gap-3 text-xs">
            <span className="w-10 text-muted">
              {unit}
              {s.index}
              {s.partial ? "•" : ""}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
              <div
                className={"h-full rounded-full " + (isFastest ? "bg-sun-500" : "bg-teal-500")}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-12 text-right text-mist/85">
              {pace(s.paceSecPerUnit)}/{unit}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Page**

```tsx
// app/me/tracks/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData, loadTrackDetail } from "@/lib/me/queries";
import { computeSplits, summarizeTrackDetail } from "@/lib/me/trackDetail";
import { fmtDistance, fmtDuration } from "@/lib/me/units";
import BackLink from "@/components/me/BackLink";
import RouteMap from "@/components/me/RouteMap";
import SplitBars from "@/components/me/SplitBars";

export const metadata = { title: "Track" };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const [res, me] = await Promise.all([
    loadTrackDetail(supabase, user.id, id),
    loadMeData(supabase, user.id),
  ]);
  if (!res) notFound();
  const units = me.profile?.units ?? "metric";
  const { track, previous } = res;
  const distanceM = track.distance_meters ?? 0;
  const durationS = track.duration_seconds ?? 0;
  const unitMeters = units === "imperial" ? 1609.344 : 1000;
  const splits = computeSplits(track.route_points, unitMeters);
  const summary = summarizeTrackDetail({ distanceM, durationS }, previous);

  const paceDelta = summary.paceDeltaSecPerKm;
  const paceDeltaLabel =
    paceDelta == null
      ? null
      : paceDelta === 0
        ? "same pace as last"
        : `${Math.abs(Math.round(paceDelta))}s/km ${paceDelta < 0 ? "faster" : "slower"} vs last`;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <header className="mt-4 border-b border-white/8 pb-6">
        <h1 className="font-display text-2xl font-bold text-mist">
          {cap(track.mode)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {(track.finished_at ?? track.created_at).slice(0, 10)} ·{" "}
          {fmtDistance(distanceM, units)} · {fmtDuration(durationS)}
          {track.elevation_gain_meters
            ? ` · ↑${Math.round(track.elevation_gain_meters)}m`
            : ""}
          {track.avg_hr ? ` · ♥ ${track.avg_hr}` : ""}
        </p>
        {paceDeltaLabel && (
          <p
            className={
              "mt-2 text-sm " +
              (paceDelta != null && paceDelta < 0 ? "text-leaf-400" : "text-ember-400")
            }
          >
            {paceDeltaLabel}
          </p>
        )}
      </header>
      <div className="mt-6">
        <RouteMap routePoints={track.route_points} />
      </div>
      {splits.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-[0.16em] text-muted">Splits</h2>
          <div className="mt-3">
            <SplitBars splits={splits} units={units} />
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add lib/me/queries.ts components/me/RouteMap.tsx components/me/SplitBars.tsx "app/me/tracks/[id]/page.tsx" && git commit -m "feat(me): track detail page (route map + splits + vs-previous)"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: typecheck clean; all vitest pass (existing 62 + hub/workoutDetail/exerciseHistory/trackDetail); lint shows only the pre-existing errors; build lists `/me`, `/me/workouts/[id]`, `/me/exercises/[id]`, `/me/tracks/[id]` (all dynamic ƒ).

- [ ] **Step 2: Manual smoke** (`npm run dev`, logged in): from `/me`, click a feed workout → detail with sets + deltas; click an exercise → progression chart; click a feed track → route + splits; momentum + plan card render; reduced-motion intact.

---

## Self-Review

**Spec coverage:** session feed → T1,T3; momentum → T1,T3; plan card → T1,T2,T3; workout detail + vs-last + PR → T4,T5,T6; exercise progression + est-1RM → T7,T8; track detail + splits + vs-previous → T9,T10; enhanced SVG route → T10; units honored → all pages; RLS/auth/notFound → T5,T6,T8,T10; tests for every pure module → T1,T4,T7,T9. ✓

**Placeholder scan:** none. Empty-state copy ("No sets logged…", "No route recorded") is intentional UI.

**Type consistency:** `FeedItem`/`Momentum`/`PlanSummary`/`PlanProgressInput` (T1) consumed in T3 + queries (T2). `SetWithExercise`/`WorkoutDetailSummary` (T4) consumed by `loadWorkoutDetail` (T5) and page (T6). `SetWithDate`/`ExerciseHistory` (T7) consumed by `loadExerciseHistory` (T8) and page. `Split`/`TrackDetailSummary` (T9) consumed by `loadTrackDetail`/page (T10). `routeToPolyline` reused from existing `lib/me/route.ts`. `MeData.dayTitleBySession` (T2) consumed by `buildFeed` (T3). All consistent.
