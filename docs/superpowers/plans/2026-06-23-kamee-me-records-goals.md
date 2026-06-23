# Kamee `/me` Records & Goals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an all-time PRs page, a weekly-goal card with an 8-week consistency strip, and a clickable activity-heatmap day drill-down to `/me`.

**Architecture:** Pure tested aggregation in `lib/me/` (`records.ts`, `goal.ts`), reusing `epley1Rm`. Extend `loadMeData` with exercise-id maps + `days_per_week` so the records and day pages flatten existing data — no heavy new query. Server-component pages, RLS, units honored.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, TypeScript, Supabase SSR (RLS), vitest. No new deps.

## Global Constraints

- **Security:** anon key + user session; RLS; `requireUser()` per page; no service-role key.
- **Next 16:** `params` is a Promise — `await` it.
- **Target source:** `profiles.days_per_week` (read-only). Null/0 target → show count without a goal ring; `hit` is always false.
- **Units** honored via `lib/me/units.ts`. Palette: leaf = strength, sun = goal-hit. Reduced-motion respected.
- **Tests:** pure modules under `lib/me/*.test.ts`; pages/visual via tsc/build.
- **Commands in** `kamee-fitness.webapp/`. Branch: `feat/me-records-goals`.

---

### Task 1: Records + weekly goal aggregation (pure, TDD)

**Files:**
- Create: `lib/me/records.ts`, `lib/me/goal.ts`
- Test: `lib/me/recordsGoal.test.ts`

**Interfaces:**
- Consumes: `epley1Rm` from `./oneRepMax`; `WorkoutSessionRow` from `./queries`.
- Produces:
  - `RecordSet`, `ExerciseRecord`; `buildRecords(sets: RecordSet[]): ExerciseRecord[]`
  - `WeeklyGoal`; `buildWeeklyGoal(workouts, now, targetDays, weeks): WeeklyGoal`

- [ ] **Step 1: Write the failing test**

```ts
// lib/me/recordsGoal.test.ts
import { describe, expect, it } from "vitest";
import { buildRecords, type RecordSet } from "./records";
import { buildWeeklyGoal } from "./goal";
import type { WorkoutSessionRow } from "./queries";

describe("buildRecords", () => {
  const sets: RecordSet[] = [
    { exerciseId: "e1", name: "Bench", dateIso: "2026-06-01", reps: 8, weightKg: 60 },
    { exerciseId: "e1", name: "Bench", dateIso: "2026-06-10", reps: 5, weightKg: 70 },
    { exerciseId: "e2", name: "Squat", dateIso: "2026-06-05", reps: 5, weightKg: 100 },
  ];
  it("computes PR, est-1RM, times trained per exercise, sorted heaviest first", () => {
    const recs = buildRecords(sets);
    expect(recs.map((r) => r.name)).toEqual(["Squat", "Bench"]);
    const bench = recs.find((r) => r.exerciseId === "e1")!;
    expect(bench.prKg).toBe(70);
    expect(bench.prDateIso).toBe("2026-06-10");
    expect(bench.timesTrained).toBe(2);
    expect(bench.lastDoneIso).toBe("2026-06-10");
    expect(bench.est1RmKg).toBeCloseTo(81.67, 1); // 70*(1+5/30)
  });
});

describe("buildWeeklyGoal", () => {
  const now = new Date("2026-06-23T12:00:00Z"); // Tuesday
  const W = (id: string, started_at: string, status: "completed" | "abandoned" = "completed"): WorkoutSessionRow =>
    ({ id, started_at, duration_seconds: 0, status, avg_hr: null, day_id: null });
  const workouts = [
    W("a", "2026-06-22T08:00:00Z"), // this week
    W("b", "2026-06-23T08:00:00Z"), // this week
    W("c", "2026-06-16T08:00:00Z"), // last week
    W("d", "2026-06-15T08:00:00Z"), // last week
    W("e", "2026-06-17T08:00:00Z"), // last week
    W("x", "2026-06-23T09:00:00Z", "abandoned"), // ignored
  ];
  it("counts completed workouts per ISO week with hit flags", () => {
    const g = buildWeeklyGoal(workouts, now, 3, 8);
    expect(g.target).toBe(3);
    expect(g.history).toHaveLength(8);
    expect(g.thisWeekCount).toBe(2);
    const last = g.history[g.history.length - 1];
    expect(last.count).toBe(2);
    expect(last.hit).toBe(false); // 2 < 3
    const prev = g.history[g.history.length - 2];
    expect(prev.count).toBe(3);
    expect(prev.hit).toBe(true); // 3 >= 3
  });
  it("never hits when target is 0", () => {
    const g = buildWeeklyGoal(workouts, now, 0, 4);
    expect(g.target).toBe(0);
    expect(g.history.every((h) => h.hit === false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run lib/me/recordsGoal.test.ts`).

- [ ] **Step 3: Implement**

```ts
// lib/me/records.ts
import { epley1Rm } from "./oneRepMax";

export type RecordSet = {
  exerciseId: string;
  name: string;
  dateIso: string;
  reps: number;
  weightKg: number;
};

export type ExerciseRecord = {
  exerciseId: string;
  name: string;
  prKg: number;
  prDateIso: string | null;
  est1RmKg: number;
  timesTrained: number;
  lastDoneIso: string | null;
};

export function buildRecords(sets: RecordSet[]): ExerciseRecord[] {
  const byEx = new Map<
    string,
    {
      name: string;
      prKg: number;
      prDateIso: string | null;
      est1RmKg: number;
      dates: Set<string>;
      lastDoneIso: string | null;
    }
  >();
  for (const s of sets) {
    const r =
      byEx.get(s.exerciseId) ??
      { name: s.name, prKg: 0, prDateIso: null, est1RmKg: 0, dates: new Set<string>(), lastDoneIso: null };
    r.name = s.name;
    r.dates.add(s.dateIso);
    if (r.lastDoneIso == null || s.dateIso > r.lastDoneIso) r.lastDoneIso = s.dateIso;
    if (s.weightKg > 0) {
      if (s.weightKg > r.prKg) {
        r.prKg = s.weightKg;
        r.prDateIso = s.dateIso;
      }
      r.est1RmKg = Math.max(r.est1RmKg, epley1Rm(s.weightKg, s.reps));
    }
    byEx.set(s.exerciseId, r);
  }
  return [...byEx.entries()]
    .map(([exerciseId, r]) => ({
      exerciseId,
      name: r.name,
      prKg: r.prKg,
      prDateIso: r.prDateIso,
      est1RmKg: r.est1RmKg,
      timesTrained: r.dates.size,
      lastDoneIso: r.lastDoneIso,
    }))
    .sort((a, b) => b.prKg - a.prKg);
}
```

```ts
// lib/me/goal.ts
import type { WorkoutSessionRow } from "./queries";

export type WeeklyGoal = {
  target: number;
  thisWeekCount: number;
  history: { weekStartIso: string; count: number; hit: boolean }[];
};

const DAY_MS = 86_400_000;

/** UTC Monday-00:00 ms for the week containing `ms`. */
function weekStart(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
}

export function buildWeeklyGoal(
  workouts: WorkoutSessionRow[],
  now: Date,
  targetDays: number,
  weeks: number,
): WeeklyGoal {
  const thisStart = weekStart(now.getTime());
  const counts = new Map<number, number>();
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    const t = Date.parse(w.started_at);
    if (Number.isNaN(t)) continue;
    const ws = weekStart(t);
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  }
  const history: WeeklyGoal["history"] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = thisStart - i * 7 * DAY_MS;
    const count = counts.get(ws) ?? 0;
    history.push({
      weekStartIso: new Date(ws).toISOString().slice(0, 10),
      count,
      hit: targetDays > 0 && count >= targetDays,
    });
  }
  return {
    target: targetDays,
    thisWeekCount: counts.get(thisStart) ?? 0,
    history,
  };
}
```

- [ ] **Step 4: Run — expect PASS.** Commit:

```bash
git add lib/me/records.ts lib/me/goal.ts lib/me/recordsGoal.test.ts && git commit -m "feat(me): records + weekly-goal aggregation"
```

---

### Task 2: Extend `loadMeData` (exercise-id maps + days_per_week)

**Files:**
- Modify: `lib/me/queries.ts`

**Interfaces:**
- Produces: `ProfileRow` gains `days_per_week: number | null`; `MeData` gains
  `exerciseIdByPlanEx: Record<string,string>` and `nameByExercise:
  Record<string,string>`.

- [ ] **Step 1: Add `days_per_week` to `ProfileRow`** and the profiles select.

In `ProfileRow`, add `days_per_week: number | null;`. In `loadMeData`, change the profiles select to:
```ts
.select("display_name, avatar_url, units, target_weight_kg, target_date, weight_kg, is_premium, days_per_week")
```

- [ ] **Step 2: Capture exercise_id during the existing plan_exercises lookup.**

In `loadMeData`, find the block that resolves `exerciseNames`. Replace the select + loop so it also builds the new maps:

```ts
  const exerciseNames: Record<string, string> = {};
  const exerciseIdByPlanEx: Record<string, string> = {};
  const nameByExercise: Record<string, string> = {};
  const planExIds = [
    ...new Set(sets.map((s) => s.plan_exercise_id).filter(Boolean) as string[]),
  ];
  if (planExIds.length) {
    const nameRes = await supabase
      .from("plan_exercises")
      .select("id, exercise_id, exercises(name)")
      .in("id", planExIds);
    for (const row of (nameRes.data ?? []) as Array<{
      id: string;
      exercise_id: string | null;
      exercises: { name: string | null } | { name: string | null }[] | null;
    }>) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      const name = ex?.name ?? null;
      if (name) exerciseNames[row.id] = name;
      if (row.exercise_id) {
        exerciseIdByPlanEx[row.id] = row.exercise_id;
        if (name) nameByExercise[row.exercise_id] = name;
      }
    }
  }
```

- [ ] **Step 3: Add the maps to `MeData` and the returned object.**

Add to the `MeData` type:
```ts
  exerciseIdByPlanEx: Record<string, string>;
  nameByExercise: Record<string, string>;
```
Add to the `return { ... }`:
```ts
    exerciseIdByPlanEx,
    nameByExercise,
```

- [ ] **Step 4: Verify** (`npx tsc --noEmit`). Commit:

```bash
git add lib/me/queries.ts && git commit -m "feat(me): expose exercise-id maps + days_per_week from loadMeData"
```

---

### Task 3: Weekly goal card + heatmap links + Records link on `/me`

**Files:**
- Create: `components/me/WeeklyGoalCard.tsx`
- Modify: `components/me/ActivityHeatmap.tsx`, `app/me/page.tsx`

**Interfaces:**
- Consumes: `WeeklyGoal` from `@/lib/me/goal`; `buildWeeklyGoal`.

- [ ] **Step 1: WeeklyGoalCard**

```tsx
// components/me/WeeklyGoalCard.tsx
import type { WeeklyGoal } from "@/lib/me/goal";

export default function WeeklyGoalCard({ goal }: { goal: WeeklyGoal }) {
  const { target, thisWeekCount, history } = goal;
  const segs = Math.max(target, thisWeekCount, 1);
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-sm font-semibold text-mist">
          Weekly goal
        </div>
        <div className="text-xs text-muted">
          {thisWeekCount}
          {target > 0 ? ` / ${target}` : ""} this week
        </div>
      </div>
      {target > 0 && (
        <div className="mt-2 flex gap-1">
          {Array.from({ length: segs }).map((_, i) => (
            <div
              key={i}
              className={
                "h-2 flex-1 rounded-full " +
                (i < thisWeekCount ? "bg-leaf-500" : "bg-white/8")
              }
            />
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-1.5">
        {history.map((h) => (
          <span
            key={h.weekStartIso}
            title={`${h.weekStartIso}: ${h.count}${target > 0 ? `/${target}` : ""}`}
            className={
              "size-2.5 rounded-full " +
              (h.hit ? "bg-sun-500" : h.count > 0 ? "bg-leaf-500/40" : "bg-white/10")
            }
          />
        ))}
        <span className="ml-2 text-[0.6rem] uppercase tracking-[0.16em] text-muted">
          last {history.length} wks
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Make active heatmap cells link to the day page.**

In `components/me/ActivityHeatmap.tsx`, wrap the `<rect>` so active days become SVG links. Replace the `days.map(...)` body:

```tsx
        {days.map((d, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const cell = (
            <rect
              x={col * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={shade(d.count, maxCount)}
            >
              <title>{`${d.date}: ${d.count} ${d.count === 1 ? "activity" : "activities"}`}</title>
            </rect>
          );
          return d.count > 0 ? (
            <a key={d.date} href={`/me/day/${d.date}`}>
              {cell}
            </a>
          ) : (
            <g key={d.date}>{cell}</g>
          );
        })}
```

- [ ] **Step 3: Wire the goal card + a Records link into `app/me/page.tsx`.**

Add imports:
```tsx
import { buildWeeklyGoal } from "@/lib/me/goal";
import WeeklyGoalCard from "@/components/me/WeeklyGoalCard";
import Link from "next/link";
```
After the `momentum`/`feed` lines, add:
```tsx
  const weeklyGoal = buildWeeklyGoal(
    data.workouts,
    now,
    data.profile?.days_per_week ?? 0,
    8,
  );
```
Add `<WeeklyGoalCard>` to the cards stack under the header (alongside `MomentumBar`/`PlanProgressCard`):
```tsx
      <div className="mt-6 space-y-3">
        <MomentumBar m={momentum} />
        {plan && <PlanProgressCard plan={plan} />}
        <WeeklyGoalCard goal={weeklyGoal} />
      </div>
```
In the **Workouts** section heading, add a Records link. Change:
```tsx
        <h2 className="font-display text-xl font-bold text-leaf-400">Workouts</h2>
```
to:
```tsx
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-leaf-400">Workouts</h2>
          <Link href="/me/records" className="text-xs text-leaf-300 hover:text-leaf-200">
            Records →
          </Link>
        </div>
```

- [ ] **Step 4: Verify** (`npx tsc --noEmit && npx vitest run && npm run build`). Commit:

```bash
git add components/me/WeeklyGoalCard.tsx components/me/ActivityHeatmap.tsx app/me/page.tsx && git commit -m "feat(me): weekly goal card + clickable heatmap days + records link"
```

---

### Task 4: Records page

**Files:**
- Create: `components/me/RecordsList.tsx`, `app/me/records/page.tsx`

**Interfaces:**
- Consumes: `buildRecords`, `RecordSet`, `ExerciseRecord`; `loadMeData`; `fmtWeight`.

- [ ] **Step 1: RecordsList**

```tsx
// components/me/RecordsList.tsx
import Link from "next/link";
import type { ExerciseRecord } from "@/lib/me/records";
import { fmtWeight, type Units } from "@/lib/me/units";

export default function RecordsList({
  records,
  units,
}: {
  records: ExerciseRecord[];
  units: Units;
}) {
  return (
    <ul className="divide-y divide-white/8 border-y border-white/8">
      {records.map((r) => (
        <li key={r.exerciseId}>
          <Link
            href={`/me/exercises/${r.exerciseId}`}
            className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-leaf-300"
          >
            <span className="min-w-0 truncate font-display font-semibold text-mist">
              {r.name}
            </span>
            <span className="flex shrink-0 items-center gap-3 text-sm">
              <span className="text-leaf-400">{fmtWeight(r.prKg, units)}</span>
              <span className="hidden text-xs text-muted sm:inline">
                {r.prDateIso ?? ""} · 1RM {fmtWeight(r.est1RmKg, units)} · {r.timesTrained}×
              </span>
              <span className="text-muted" aria-hidden>→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Page** — flatten `MeData` into `RecordSet[]`

```tsx
// app/me/records/page.tsx
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { buildRecords, type RecordSet } from "@/lib/me/records";
import BackLink from "@/components/me/BackLink";
import RecordsList from "@/components/me/RecordsList";

export const metadata = { title: "Personal records" };

export default async function RecordsPage() {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const data = await loadMeData(supabase, user.id);
  const units = data.profile?.units ?? "metric";

  const dateBySession = new Map<string, string>();
  for (const w of data.workouts) {
    if (w.status === "completed") dateBySession.set(w.id, w.started_at.slice(0, 10));
  }
  const sets: RecordSet[] = [];
  for (const s of data.sets) {
    const dateIso = dateBySession.get(s.session_id);
    const exerciseId = s.plan_exercise_id
      ? data.exerciseIdByPlanEx[s.plan_exercise_id]
      : undefined;
    if (!dateIso || !exerciseId) continue;
    sets.push({
      exerciseId,
      name: data.nameByExercise[exerciseId] ?? "Exercise",
      dateIso,
      reps: s.reps_done ?? 0,
      weightKg: s.weight ?? 0,
    });
  }
  const records = buildRecords(sets).filter((r) => r.prKg > 0);

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <h1 className="mt-4 font-display text-2xl font-bold text-mist">
        Personal records
      </h1>
      <div className="mt-6">
        {records.length ? (
          <RecordsList records={records} units={units} />
        ) : (
          <p className="text-sm text-muted">
            No lifting records yet — log a weighted set in the app to start.
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add components/me/RecordsList.tsx app/me/records/page.tsx && git commit -m "feat(me): all-time personal records page"
```

---

### Task 5: Day drill-down page

**Files:**
- Create: `app/me/day/[date]/page.tsx`

**Interfaces:**
- Consumes: `loadMeData`; `buildFeed`; `ActivityFeed`; `BackLink`.

- [ ] **Step 1: Page** — filter `MeData` to the date and reuse the feed

```tsx
// app/me/day/[date]/page.tsx
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { buildFeed } from "@/lib/me/feed";
import BackLink from "@/components/me/BackLink";
import ActivityFeed from "@/components/me/ActivityFeed";

export const metadata = { title: "Day" };

function prettyDate(date: string): string {
  // date is YYYY-MM-DD; render in UTC to match stored day keys.
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const { date } = await params;
  const data = await loadMeData(supabase, user.id);
  const units = data.profile?.units ?? "metric";

  const workouts = data.workouts.filter((w) => w.started_at.slice(0, 10) === date);
  const tracks = data.tracks.filter(
    (t) => (t.finished_at ?? t.created_at).slice(0, 10) === date,
  );
  const feed = buildFeed(workouts, data.sets, tracks, data.dayTitleBySession, 50);

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <BackLink />
      <h1 className="mt-4 font-display text-2xl font-bold text-mist">
        {prettyDate(date)}
      </h1>
      <div className="mt-6">
        {feed.length ? (
          <ActivityFeed items={feed} units={units} />
        ) : (
          <p className="text-sm text-muted">Nothing logged on this day.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add "app/me/day/[date]/page.tsx" && git commit -m "feat(me): activity heatmap day drill-down page"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: typecheck clean; all vitest pass (75 prior + records/goal tests); lint shows only pre-existing errors; build lists `/me/records` and `/me/day/[date]` (dynamic ƒ).

- [ ] **Step 2: Manual smoke** (`npm run dev`, logged in): `/me` shows the weekly goal card + 8-week strip; "Records →" opens the PRs list (heaviest first, links to exercise pages); clicking a filled heatmap day opens `/me/day/[date]` listing that day's activity; an empty day shows the friendly message.

---

## Self-Review

**Spec coverage:** all-time PRs page → T1,T4; weekly goal + 8-week strip → T1,T3; heatmap day drill-down → T3 (links), T5 (page); `days_per_week` target + exercise-id maps via `loadMeData` → T2; units/RLS/requireUser → T4,T5; tests for pure modules → T1. ✓

**Placeholder scan:** none. Empty-state copy is intentional UI.

**Type consistency:** `RecordSet`/`ExerciseRecord` (T1) consumed by `RecordsList` (T4) and the records page; `WeeklyGoal` (T1) consumed by `WeeklyGoalCard` (T3); `MeData.exerciseIdByPlanEx`/`nameByExercise`/`days_per_week` (T2) consumed by T3 (goal target), T4 (record flattening). `buildFeed`/`ActivityFeed` reused from the prior phase in T5. All consistent.
