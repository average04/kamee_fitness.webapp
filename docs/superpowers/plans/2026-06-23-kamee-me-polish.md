# Kamee `/me` Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add loading skeletons, faster detail fetches, a richer grouped session list, and fuller workout/exercise/track detail — all from existing data.

**Architecture:** Pure tested aggregation extended in `lib/me/`; lighter `loadUnits` for detail pages; Next `loading.tsx` skeletons; richer `FeedItem` + date grouping; reusable `StatGrid`/`Skeleton`. One `next.config` touch for the exercise demo image.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, TypeScript, Supabase SSR (RLS), vitest. No new deps.

## Global Constraints

- **Security:** anon key + user session; RLS; `requireUser()` per page.
- **Next 16:** `params` is a Promise — `await` it.
- **Units** honored via `lib/me/units.ts`. Palette ink/leaf/teal/sun/ember; Bricolage + Hanken. Reduced-motion: skeletons use `animate-pulse motion-reduce:animate-none`.
- **Tests:** pure modules under `lib/me/*.test.ts`; pages/skeletons/visual via tsc/lint/build.
- **Commands in** `kamee-fitness.webapp/`. Branch: `feat/me-polish`.

---

### Task 1: Enrich pure modules (feed, feedGroups, workoutDetail, exerciseHistory) — TDD

**Files:**
- Modify: `lib/me/feed.ts`, `lib/me/workoutDetail.ts`, `lib/me/exerciseHistory.ts`, `lib/me/hub.test.ts`, `lib/me/workoutDetail.test.ts`, `lib/me/exerciseHistory.test.ts`
- Create: `lib/me/feedGroups.ts`, `lib/me/feedGroups.test.ts`

**Interfaces:**
- `FeedItem` gains `durationS` (both kinds), workout `setCount`, track `routePoints`.
- `groupFeedByDate(items, now): { label: string; items: FeedItem[] }[]`.
- `summarizeWorkoutDetail(current, previous, names, priorMaxByExercise, muscleByExercise)` → summary gains `totalSets`, `totalReps`; `ExerciseBlock` gains `primaryMuscle`.
- `ExerciseHistory` gains `bestVolumeKg`, `lastWeightKg`, `totalReps`.

- [ ] **Step 1: Update `feed.ts`** (richer items)

Replace the `FeedItem` type and the two push blocks:
```ts
export type FeedItem =
  | { kind: "workout"; id: string; title: string; dateIso: string; volumeKg: number; durationS: number; setCount: number }
  | { kind: "track"; id: string; title: string; dateIso: string; distanceM: number; durationS: number; routePoints: unknown };
```
In `buildFeed`, also tally set counts and read the new fields:
```ts
  const countBySession = new Map<string, number>();
  for (const s of sets) {
    countBySession.set(s.session_id, (countBySession.get(s.session_id) ?? 0) + 1);
  }
```
workout push:
```ts
    items.push({
      kind: "workout",
      id: w.id,
      title: dayTitleBySession[w.id] ?? "Workout",
      dateIso: w.started_at,
      volumeKg: volBySession.get(w.id) ?? 0,
      durationS: w.duration_seconds ?? 0,
      setCount: countBySession.get(w.id) ?? 0,
    });
```
track push:
```ts
    items.push({
      kind: "track",
      id: t.id,
      title: cap(t.mode),
      dateIso: t.finished_at ?? t.created_at,
      distanceM: t.distance_meters ?? 0,
      durationS: t.duration_seconds ?? 0,
      routePoints: t.route_points,
    });
```

- [ ] **Step 2: Create `feedGroups.ts`**

```ts
// lib/me/feedGroups.ts
import type { FeedItem } from "./feed";

export type FeedGroup = { label: string; items: FeedItem[] };

const DAY_MS = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function groupFeedByDate(items: FeedItem[], now: Date): FeedGroup[] {
  const today = dayKey(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
  const yesterday = dayKey(Math.floor(now.getTime() / DAY_MS) * DAY_MS - DAY_MS);
  const buckets: Record<string, FeedItem[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const it of items) {
    const d = it.dateIso.slice(0, 10);
    const label = d === today ? "Today" : d === yesterday ? "Yesterday" : "Earlier";
    buckets[label].push(it);
  }
  return (["Today", "Yesterday", "Earlier"] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((g) => g.items.length > 0);
}
```

- [ ] **Step 3: Update `workoutDetail.ts`**

Add `primaryMuscle: string | null;` to `ExerciseBlock`; add `totalSets: number; totalReps: number;` to `WorkoutDetailSummary`; add a `muscleByExercise` param and compute the totals:
```ts
export function summarizeWorkoutDetail(
  current: SetWithExercise[],
  previous: SetWithExercise[],
  names: Record<string, string>,
  priorMaxByExercise: Record<string, number>,
  muscleByExercise: Record<string, string>,
): WorkoutDetailSummary {
```
In the `exercises` map, add `primaryMuscle: muscleByExercise[exerciseId] ?? null,`. After computing `totalVolumeKg`, add:
```ts
  const totalSets = current.length;
  const totalReps = current.reduce((s, x) => s + x.reps, 0);
```
and include `totalSets, totalReps` in the returned object.

- [ ] **Step 4: Update `exerciseHistory.ts`** (extra stats)

Add `bestVolumeKg: number; lastWeightKg: number; totalReps: number;` to `ExerciseHistory`. After building `series`, compute and return:
```ts
  const bestVolumeKg = series.reduce((m, e) => Math.max(m, e.volumeKg), 0);
  const lastWeightKg = series.length ? series[series.length - 1].topSetKg : 0;
  const totalReps = sets.reduce((s, x) => s + x.reps, 0);
```
Add `bestVolumeKg, lastWeightKg, totalReps` to the returned object.

- [ ] **Step 5: Update the tests** to cover the new fields.

`lib/me/feedGroups.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { groupFeedByDate } from "./feedGroups";
import type { FeedItem } from "./feed";

const mk = (id: string, dateIso: string): FeedItem =>
  ({ kind: "track", id, title: "Run", dateIso, distanceM: 1000, durationS: 300, routePoints: [] });

describe("groupFeedByDate", () => {
  const now = new Date("2026-06-23T12:00:00Z");
  it("buckets into Today / Yesterday / Earlier and drops empties", () => {
    const groups = groupFeedByDate(
      [mk("a", "2026-06-23T08:00:00Z"), mk("b", "2026-06-22T08:00:00Z"), mk("c", "2026-06-01T08:00:00Z")],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
  });
  it("omits buckets with no items", () => {
    const groups = groupFeedByDate([mk("a", "2026-06-23T08:00:00Z")], now);
    expect(groups.map((g) => g.label)).toEqual(["Today"]);
  });
});
```

In `lib/me/hub.test.ts`, extend the buildFeed assertion:
```ts
    expect(w1).toMatchObject({ kind: "workout", title: "Full Body B", volumeKg: 1000, setCount: 2 });
```

In `lib/me/workoutDetail.test.ts`, pass the new arg and assert:
- change both `summarizeWorkoutDetail(cur, prev, names, { e1: 55 })` calls to add a final `{ e1: "chest" }` (and `{}` for the no-prev case);
- add `expect(s.totalSets).toBe(3); expect(s.totalReps).toBe(10 + 8 + 12);` and `expect(bench.primaryMuscle).toBe("chest");`.

In `lib/me/exerciseHistory.test.ts`, add:
```ts
    expect(h.lastWeightKg).toBe(60);
    expect(h.totalReps).toBe(10 + 8 + 5);
    expect(h.bestVolumeKg).toBe(10 * 50 + 8 * 55);
```

- [ ] **Step 6: Run all pure tests — expect PASS.**

Run: `npx vitest run lib/me`
Expected: all pass (existing + `feedGroups`).

- [ ] **Step 7: Commit**

```bash
git add lib/me/feed.ts lib/me/feedGroups.ts lib/me/feedGroups.test.ts lib/me/workoutDetail.ts lib/me/exerciseHistory.ts lib/me/hub.test.ts lib/me/workoutDetail.test.ts lib/me/exerciseHistory.test.ts && git commit -m "feat(me): enrich feed items, date grouping, workout/exercise stats"
```

---

### Task 2: Query layer — loadUnits + detail enrichments + demo URL + config

**Files:**
- Modify: `lib/me/queries.ts`, `next.config.ts`

**Interfaces:**
- `loadUnits(supabase, userId): Promise<Units>`; `exerciseDemoUrl(path): string`.
- `TrackSessionRow` gains `max_hr`, `elevation_loss_meters`.
- `WorkoutDetailData.session` gains `maxHr`, `endedAt`; gains `muscleByExercise`.
- `loadExerciseHistory` return gains `demoImagePath`, `primaryMuscle`.

- [ ] **Step 1: `loadUnits` + `exerciseDemoUrl`** — add to `queries.ts`:

```ts
export async function loadUnits(
  supabase: SupabaseClient,
  userId: string,
): Promise<Units> {
  const { data } = await supabase
    .from("profiles")
    .select("units")
    .eq("id", userId)
    .maybeSingle();
  return ((data as { units?: Units } | null)?.units ?? "metric") as Units;
}

export function exerciseDemoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/exercise-demos/${path}`;
}
```

- [ ] **Step 2: `TrackSessionRow` + track selects** — add fields and select columns.

Add to `TrackSessionRow`:
```ts
  max_hr: number | null;
  elevation_loss_meters: number | null;
```
Add `max_hr, elevation_loss_meters` to **both** the `track_sessions` select in `loadMeData` and the one in `loadTrackDetail`.

- [ ] **Step 3: `loadWorkoutDetail` enrichment.**

Add `max_hr, ended_at` to the session select. Add `maxHr: number | null; endedAt: string | null;` to `WorkoutDetailData["session"]` and `muscleByExercise: Record<string,string>;` to `WorkoutDetailData`. Change the plan_exercises select to `id, exercise_id, exercises(id, name, primary_muscle)` and capture muscle:
```ts
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      if (ex) {
        exByPlanEx.set(row.id, { id: ex.id, name: ex.name ?? "Exercise" });
        if (ex.primary_muscle) muscleByExercise[ex.id] = ex.primary_muscle;
      }
```
(declare `const muscleByExercise: Record<string,string> = {};` next to `exByPlanEx`, and widen the row cast to include `exercises: { id: string; name: string | null; primary_muscle: string | null } | ...`). Return `maxHr: sess.max_hr`, `endedAt: sess.ended_at`, and `muscleByExercise`. Update the `sess` cast to include `max_hr` and `ended_at`, and the session select string to `"id, user_id, day_id, started_at, duration_seconds, avg_hr, max_hr, ended_at, status"`.

- [ ] **Step 4: `loadExerciseHistory` enrichment.**

Change the exercises select to `select("name, primary_muscle, demo_image_path")` and return them:
```ts
  const meta = ex as { name: string | null; primary_muscle: string | null; demo_image_path: string | null };
```
Return type becomes `{ name: string; primaryMuscle: string | null; demoImagePath: string | null; sets: SetWithDate[] }`; set `name: meta.name ?? "Exercise"`, `primaryMuscle: meta.primary_muscle`, `demoImagePath: meta.demo_image_path` in every return path.

- [ ] **Step 5: `next.config.ts`** — allow the Supabase Storage host for `next/image`:

```ts
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: supabaseHost
    ? { remotePatterns: [{ protocol: "https", hostname: supabaseHost }] }
    : undefined,
};
```

- [ ] **Step 6: Verify** (`npx tsc --noEmit`). Commit:

```bash
git add lib/me/queries.ts next.config.ts && git commit -m "feat(me): loadUnits + detail-query enrichments + demo image host"
```

---

### Task 3: Skeleton + loading.tsx for every /me route

**Files:**
- Create: `components/me/Skeleton.tsx`, and `loading.tsx` under `app/me/`, `app/me/workouts/[id]/`, `app/me/tracks/[id]/`, `app/me/exercises/[id]/`, `app/me/records/`, `app/me/day/[date]/`

- [ ] **Step 1: Skeleton**

```tsx
// components/me/Skeleton.tsx
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "animate-pulse rounded-2xl bg-white/8 motion-reduce:animate-none " +
        className
      }
    />
  );
}
```

- [ ] **Step 2: Detail loading skeleton** (shared shape) — `app/me/workouts/[id]/loading.tsx`:

```tsx
import Skeleton from "@/components/me/Skeleton";

export default function Loading() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </main>
  );
}
```

Create the same file (identical content) at `app/me/tracks/[id]/loading.tsx`,
`app/me/exercises/[id]/loading.tsx`, `app/me/records/loading.tsx`, and
`app/me/day/[date]/loading.tsx`.

- [ ] **Step 3: Dashboard loading** — `app/me/loading.tsx`:

```tsx
import Skeleton from "@/components/me/Skeleton";

export default function Loading() {
  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="h-12 w-full" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="mt-10 h-28 w-full" />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add components/me/Skeleton.tsx app/me/loading.tsx "app/me/workouts/[id]/loading.tsx" "app/me/tracks/[id]/loading.tsx" "app/me/exercises/[id]/loading.tsx" app/me/records/loading.tsx "app/me/day/[date]/loading.tsx" && git commit -m "feat(me): instant loading skeletons on all /me routes"
```

---

### Task 4: FeedItem v2 + grouped ActivityFeed

**Files:**
- Modify: `components/me/FeedItem.tsx`, `components/me/ActivityFeed.tsx`

**Interfaces:**
- Consumes: enriched `FeedItem`; `groupFeedByDate`; `RouteThumbnail`; `fmtDistance`, `fmtVolume`, `fmtDuration`, `fmtPaceFromMeters`.

- [ ] **Step 1: FeedItem v2**

```tsx
// components/me/FeedItem.tsx
import Link from "next/link";
import type { FeedItem as Item } from "@/lib/me/feed";
import {
  fmtDistance,
  fmtDuration,
  fmtPaceFromMeters,
  fmtVolume,
  type Units,
} from "@/lib/me/units";
import RouteThumbnail from "./RouteThumbnail";

function DumbbellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M4 9H2v6h2v-2h1v2h2V7H5v2H4V9zm16 0v2h-1V9h-2v8h2v-2h1v2h2V9h-2zM8 11h8v2H8v-2z" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M5 19c4 0 4-7 8-7s4 7 8 7" strokeLinecap="round" />
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function FeedItem({ item, units }: { item: Item; units: Units }) {
  const isWorkout = item.kind === "workout";
  const href = isWorkout ? `/me/workouts/${item.id}` : `/me/tracks/${item.id}`;
  const accent = isWorkout ? "text-leaf-400" : "text-teal-500";
  const metric = isWorkout
    ? fmtVolume(item.volumeKg, units)
    : fmtDistance(item.distanceM, units);
  const secondary = isWorkout
    ? `${item.setCount} ${item.setCount === 1 ? "set" : "sets"} · ${fmtDuration(item.durationS)}`
    : `${fmtPaceFromMeters(item.distanceM, item.durationS, units)} · ${fmtDuration(item.durationS)}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 transition-colors hover:border-leaf-500/30"
    >
      {isWorkout ? (
        <span className={"grid size-9 shrink-0 place-items-center rounded-xl bg-leaf-500/10 " + accent}>
          <DumbbellIcon />
        </span>
      ) : (
        <span className="shrink-0">
          <RouteThumbnail routePoints={item.routePoints} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold text-mist">
          {item.title}
        </div>
        <div className="text-xs text-muted">{secondary}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm">
        <span className={accent}>{metric}</span>
        <span className="text-muted" aria-hidden>→</span>
      </div>
    </Link>
  );
}
```

> Note: `RouteThumbnail` is 96px; in the feed it renders at its intrinsic size on the left. That's fine for the row height; if it feels large, wrap it in `className="size-12 overflow-hidden"` later — not required.

- [ ] **Step 2: Grouped ActivityFeed**

```tsx
// components/me/ActivityFeed.tsx
import type { FeedItem as Item } from "@/lib/me/feed";
import type { Units } from "@/lib/me/units";
import { groupFeedByDate } from "@/lib/me/feedGroups";
import FeedItem from "./FeedItem";

export default function ActivityFeed({
  items,
  units,
}: {
  items: Item[];
  units: Units;
}) {
  if (!items.length) return null;
  const groups = groupFeedByDate(items, new Date());
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-2 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
            {g.label}
          </h3>
          <ul className="space-y-2">
            {g.items.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <FeedItem item={it} units={units} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add components/me/FeedItem.tsx components/me/ActivityFeed.tsx && git commit -m "feat(me): richer grouped session list with icons + route thumbnails"
```

---

### Task 5: StatGrid + detail page updates (workout, track, exercise) + loadUnits swap

**Files:**
- Create: `components/me/StatGrid.tsx`
- Modify: `app/me/workouts/[id]/page.tsx`, `app/me/tracks/[id]/page.tsx`, `app/me/exercises/[id]/page.tsx`, `components/me/ExerciseSetTable.tsx`

- [ ] **Step 1: StatGrid**

```tsx
// components/me/StatGrid.tsx
export default function StatGrid({
  cells,
}: {
  cells: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cells.map((c) => (
        <div key={c.label} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
          <div className="text-[0.6rem] font-medium uppercase tracking-[0.16em] text-muted">
            {c.label}
          </div>
          <div className="mt-1 font-display text-lg font-bold text-mist">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Workout page** — use `loadUnits`, pass `muscleByExercise`, add `StatGrid`.

In `app/me/workouts/[id]/page.tsx`: swap `loadMeData` for `loadUnits`:
```tsx
import { loadUnits, loadWorkoutDetail } from "@/lib/me/queries";
import StatGrid from "@/components/me/StatGrid";
...
  const [detail, units] = await Promise.all([
    loadWorkoutDetail(supabase, user.id, id),
    loadUnits(supabase, user.id),
  ]);
  if (!detail) notFound();
  const summary = summarizeWorkoutDetail(
    detail.current,
    detail.previous,
    detail.names,
    detail.priorMax,
    detail.muscleByExercise,
  );
```
Replace the single total-volume line block with a `StatGrid` + the volume line. After the `<h1>`/date `<p>` in the header, add:
```tsx
        <div className="mt-4">
          <StatGrid
            cells={[
              { label: "Sets", value: String(summary.totalSets) },
              { label: "Reps", value: String(summary.totalReps) },
              { label: "Duration", value: detail.session.durationSeconds ? fmtDuration(detail.session.durationSeconds) : "—" },
              { label: "Avg HR", value: detail.session.avgHr ? `${detail.session.avgHr}` : "—" },
              { label: "Max HR", value: detail.session.maxHr ? `${detail.session.maxHr}` : "—" },
              { label: "Volume", value: fmtVolume(summary.totalVolumeKg, units) },
            ]}
          />
        </div>
```
Keep the existing `DeltaBadge` "total volume vs last time" line below the grid.

- [ ] **Step 3: Show the muscle tag in `ExerciseSetTable.tsx`.**

In the exercise name row, after the name (and PR star), add:
```tsx
              {e.primaryMuscle && (
                <span className="ml-2 text-xs font-normal capitalize text-muted">
                  {e.primaryMuscle}
                </span>
              )}
```

- [ ] **Step 4: Track page** — use `loadUnits`, replace the line with a `StatGrid`.

In `app/me/tracks/[id]/page.tsx`: swap to `loadUnits`:
```tsx
import { loadTrackDetail, loadUnits } from "@/lib/me/queries";
import StatGrid from "@/components/me/StatGrid";
import { fmtDistance, fmtDuration, fmtPaceFromMeters } from "@/lib/me/units";
...
  const [res, units] = await Promise.all([
    loadTrackDetail(supabase, user.id, id),
    loadUnits(supabase, user.id),
  ]);
```
Replace the metadata `<p>` (distance · duration · elev · HR) with a `StatGrid`:
```tsx
        <div className="mt-3">
          <StatGrid
            cells={[
              { label: "Distance", value: fmtDistance(distanceM, units) },
              { label: "Duration", value: fmtDuration(durationS) },
              { label: "Avg pace", value: fmtPaceFromMeters(distanceM, durationS, units) },
              { label: "Avg HR", value: track.avg_hr ? `${track.avg_hr}` : "—" },
              { label: "Max HR", value: track.max_hr ? `${track.max_hr}` : "—" },
              { label: "Elev ↑/↓", value: `${Math.round(track.elevation_gain_meters ?? 0)}/${Math.round(track.elevation_loss_meters ?? 0)}m` },
            ]}
          />
        </div>
```
Keep the date in a small line above and the `paceDeltaLabel` below the grid.

- [ ] **Step 5: Exercise page** — use `loadUnits`, show demo image + muscle + stats.

In `app/me/exercises/[id]/page.tsx`: swap to `loadUnits`; render the demo + stats:
```tsx
import Image from "next/image";
import { exerciseDemoUrl, loadExerciseHistory, loadUnits } from "@/lib/me/queries";
...
  const [hist, units] = await Promise.all([
    loadExerciseHistory(supabase, user.id, id),
    loadUnits(supabase, user.id),
  ]);
  if (!hist) notFound();
```
In the header, under the `<h1>`, add the muscle + demo + stats:
```tsx
        {hist.primaryMuscle && (
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-teal-500">
            {hist.primaryMuscle}
          </p>
        )}
        {hist.demoImagePath && (
          <Image
            src={exerciseDemoUrl(hist.demoImagePath)}
            alt={hist.name}
            width={320}
            height={320}
            className="mt-4 size-40 rounded-2xl border border-white/8 object-cover"
          />
        )}
```
And extend the stats line to include best volume + last weight when trained:
```tsx
            PR {fmtWeight(h.prKg, units)}
            {h.prDateIso ? ` (${h.prDateIso})` : ""} · est 1RM {fmtWeight(bestEst1Rm, units)} ·
            last {fmtWeight(h.lastWeightKg, units)} · best vol {fmtVolume(h.bestVolumeKg, units)} ·
            trained {h.timesTrained}×
```
(add `fmtVolume` to the units import.)

- [ ] **Step 6: Verify** (`npx tsc --noEmit && npm run build`). Commit:

```bash
git add components/me/StatGrid.tsx components/me/ExerciseSetTable.tsx "app/me/workouts/[id]/page.tsx" "app/me/tracks/[id]/page.tsx" "app/me/exercises/[id]/page.tsx" && git commit -m "feat(me): stat grids, muscle tags, exercise demo + stats; lighter detail fetches"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: typecheck clean; all vitest pass (78 prior + `feedGroups` + updated assertions); lint only pre-existing errors; build succeeds; every `/me*` route still listed.

- [ ] **Step 2: Manual smoke** (`npm run dev`, logged in): navigating to a detail page shows the skeleton instantly, then content; the session list shows icons + a second line + route thumbnails, grouped Today/Yesterday/Earlier; workout/track pages show the stat grid; exercise page shows the demo image + muscle + extra stats; detail pages feel faster.

---

## Self-Review

**Spec coverage:** loading skeletons → T3; faster fetch (`loadUnits`) → T2,T5; richer list (icon/metadata/thumbnail/grouping) → T1 (feed+feedGroups), T4; workout stat grid + muscle → T1,T2,T5; exercise demo+muscle+stats → T1,T2,T5; track stat grid → T2,T5; demo image host → T2; tests for pure modules → T1. ✓

**Placeholder scan:** none. The optional RouteThumbnail sizing note is guidance, not a placeholder.

**Type consistency:** enriched `FeedItem` (T1) consumed by `FeedItem.tsx`/grouping (T4); `groupFeedByDate` (T1) by `ActivityFeed` (T4); `summarizeWorkoutDetail` new `muscleByExercise` param + `totalSets`/`totalReps`/`primaryMuscle` (T1) produced by `loadWorkoutDetail.muscleByExercise` (T2) and consumed by the page (T5) + `ExerciseSetTable` (T5); `ExerciseHistory` new fields (T1) consumed by exercise page (T5); `loadUnits`/`exerciseDemoUrl` (T2) consumed by T5; `TrackSessionRow.max_hr`/`elevation_loss_meters` (T2) consumed by track page (T5). All consistent.
