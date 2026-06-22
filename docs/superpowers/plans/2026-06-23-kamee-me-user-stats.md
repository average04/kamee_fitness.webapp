# Kamee `/me` User Stats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An authenticated `/me` dashboard where a Kamee user logs in (email OTP) and sees detailed workout, outdoor-track, activity-heatmap, and weight stats built from the existing Supabase tables.

**Architecture:** Mostly server-rendered. `app/me/page.tsx` (server) calls `requireUser()`, loads the user's rows via `lib/me/queries.ts` (RLS-scoped through the user's session), aggregates with pure tested functions in `lib/me/*`, and renders sections. Charts are Recharts client islands fed plain data; the activity heatmap and route thumbnails are hand-rolled SVG. Login reuses the existing email-OTP + Turnstile + `/auth/callback` flow.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, TypeScript, Supabase SSR (anon key + cookies), vitest (node env), **Recharts** (new dep).

## Global Constraints

- **Read first:** skim `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and `12-images.md` before coding (modified Next.js 16 per `AGENTS.md`).
- **Security:** all reads use the **anon key + user cookie session**; RLS enforces ownership; queries also filter `user_id` defensively. **Never** the service-role key. `/me` is gated by `requireUser()` (re-checked server-side, not just the proxy).
- **Auth:** email OTP only (`signInWithOtp` / `verifyOtp`) with Turnstile; `shouldCreateUser: false`. No Google/Apple.
- **One new dependency:** `recharts` (React-19-compatible). Chart components are `"use client"`. If a React-19 peer conflict appears, install with the project's standard resolution and pin a compatible version; isolated so swappable.
- **Enums (verbatim):** `workout_sessions.status` ∈ {`completed`,`abandoned`,`active`} — count **completed** only. `profiles.units` ∈ {`metric`,`imperial`}. `track_sessions.mode` ∈ {`run`,`walk`,`treadmill`,…} (treat as free string).
- **No calories** in v1 (not stored). **Units:** every displayed number honors `profiles.units`.
- **Palette/type:** reuse existing tokens (ink/leaf/teal/ember/sun, Bricolage + Hanken). leaf = workouts, teal = tracks, sun = streaks. Respect `prefers-reduced-motion`.
- **Tests:** pure modules under `lib/me/*.test.ts` (vitest, node env, already globbed). Visual/IO tasks verify via `tsc`/`build`.
- **Commands run in** `kamee-fitness.webapp/`. Branch: `feat/me-user-stats`.

---

### Task 1: User auth gate + proxy session refresh for `/me`

**Files:**
- Create: `kamee-fitness.webapp/lib/user/auth.ts`
- Modify: `kamee-fitness.webapp/proxy.ts`

**Interfaces:**
- Consumes: `createServerSupabase` from `@/lib/supabase/server`.
- Produces: `requireUser(): Promise<import("@supabase/supabase-js").User>` — returns the authenticated user or `redirect("/login")`.

- [ ] **Step 1: Write the gate**

```ts
// kamee-fitness.webapp/lib/user/auth.ts
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Data Access Layer gate for the end-user `/me` area. Returns the authenticated
 * user or redirects to /login. Memoized per-request via React `cache`. No
 * allowlist — any signed-in Kamee user. Re-checked in server actions; never
 * trust the proxy alone.
 */
export const requireUser = cache(async (): Promise<User> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});
```

- [ ] **Step 2: Extend the proxy** to refresh the session on `/me` + `/login` and gate `/me`.

In `kamee-fitness.webapp/proxy.ts`, replace the gating block and matcher:

```ts
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  if (pathname.startsWith("/admin") && !isLogin) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    if (!isAllowed(user.email, parseAllowlist(process.env.ADMIN_EMAILS))) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("error", "not-authorized");
      return NextResponse.redirect(url);
    }
  }

  // End-user stats area: any authenticated user; unauthenticated -> /login.
  if (pathname.startsWith("/me") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/me/:path*", "/login"],
};
```

- [ ] **Step 3: Verify typecheck**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd kamee-fitness.webapp && git add lib/user/auth.ts proxy.ts && git commit -m "feat(me): requireUser gate + proxy session refresh for /me"
```

---

### Task 2: Email-OTP login page + sign-out action

**Files:**
- Create: `kamee-fitness.webapp/app/login/page.tsx`
- Create: `kamee-fitness.webapp/app/me/actions.ts`

**Interfaces:**
- Consumes: `createBrowserSupabase` from `@/lib/supabase/browser`; `createServerSupabase` from `@/lib/supabase/server`.
- Produces: `signOut()` server action (redirects to `/`).

- [ ] **Step 1: Sign-out action**

```ts
// kamee-fitness.webapp/app/me/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
```

- [ ] **Step 2: Login page** (email OTP + Turnstile, modeled on `app/admin/login/page.tsx`, redirecting to `/me`, no allowlist)

```tsx
// kamee-fitness.webapp/app/login/page.tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAADSfFsj2UkEr0f3Z";
const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
          theme?: "auto" | "light" | "dark";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    function render() {
      if (!window.turnstile || !widgetEl.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widgetEl.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        theme: "dark",
        callback: (token) => setCaptchaToken(token),
        "error-callback": () => setCaptchaToken(null),
        "expired-callback": () => setCaptchaToken(null),
      });
    }
    if (window.turnstile) {
      render();
      return;
    }
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SRC}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => script?.removeEventListener("load", render);
  }, []);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) {
      setMessage("Still verifying you're human — give it a moment and retry.");
      return;
    }
    setStatus("sending");
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/me`,
        captchaToken,
      },
    });
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      setCaptchaToken(null);
    }
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setVerifying(false);
      setMessage(error.message);
      return;
    }
    window.location.href = "/me";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 text-mist">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="font-display text-xl font-semibold">Your Kamee stats</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in with the email on your Kamee account.
        </p>

        <form onSubmit={onSend} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-leaf-600"
          />
          <div ref={widgetEl} />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-leaf-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-leaf-500"
          >
            {status === "sending" ? "Sending…" : "Send magic link / code"}
          </button>
        </form>

        {status === "sent" && (
          <p className="mt-3 rounded-lg bg-leaf-950/40 px-3 py-2 text-sm text-leaf-300">
            Check your inbox — click the link, or enter the 6-digit code below.
          </p>
        )}

        <form onSubmit={onVerify} className="mt-4 space-y-2">
          <label className="block text-xs text-muted">
            Have a code from your email?
          </label>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              className="w-32 rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm tracking-widest outline-none focus:border-leaf-600"
            />
            <button
              type="submit"
              disabled={verifying || code.length < 6}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Verify code"}
            </button>
          </div>
        </form>

        {message && <p className="mt-3 text-sm text-red-400">{message}</p>}

        <p className="mt-6 text-xs text-muted/70">
          New here? Create your account in the Kamee app first.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit && npm run build`
Expected: clean; `/login` listed in routes.

- [ ] **Step 4: Commit**

```bash
cd kamee-fitness.webapp && git add app/login/page.tsx app/me/actions.ts && git commit -m "feat(me): email-OTP login page + sign-out action"
```

---

### Task 3: Units & range helpers (TDD)

**Files:**
- Create: `kamee-fitness.webapp/lib/me/units.ts`, `kamee-fitness.webapp/lib/me/range.ts`
- Test: `kamee-fitness.webapp/lib/me/format.test.ts`

**Interfaces:**
- Produces: `Units = "metric" | "imperial"`; `fmtWeight(kg, units)`, `fmtDistance(meters, units)`, `fmtPace(secondsPerKmOrMi…)` → use `fmtPaceFromMeters(meters, seconds, units)`, `fmtDuration(seconds)`, `fmtVolume(kg, units)`. `Range = "week"|"month"|"all"`; `withinRange(iso, range, now): boolean`; `parseRange(value): Range`.

- [ ] **Step 1: Write the failing test**

```ts
// kamee-fitness.webapp/lib/me/format.test.ts
import { describe, expect, it } from "vitest";
import {
  fmtDistance,
  fmtDuration,
  fmtPaceFromMeters,
  fmtWeight,
} from "./units";
import { parseRange, withinRange } from "./range";

describe("units", () => {
  it("formats weight per unit system", () => {
    expect(fmtWeight(60, "metric")).toBe("60 kg");
    expect(fmtWeight(100, "imperial")).toBe("220 lb");
  });
  it("formats distance per unit system", () => {
    expect(fmtDistance(5000, "metric")).toBe("5.0 km");
    expect(fmtDistance(1609.34, "imperial")).toBe("1.0 mi");
  });
  it("formats duration h/m/s", () => {
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(90)).toBe("1m");
    expect(fmtDuration(3725)).toBe("1h 2m");
  });
  it("formats pace per km/mi", () => {
    // 1000 m in 300 s -> 5:00 /km
    expect(fmtPaceFromMeters(1000, 300, "metric")).toBe("5:00 /km");
    expect(fmtPaceFromMeters(0, 300, "metric")).toBe("—");
  });
});

describe("range", () => {
  const now = new Date("2026-06-23T12:00:00Z");
  it("parses with a safe default", () => {
    expect(parseRange("week")).toBe("week");
    expect(parseRange("nonsense")).toBe("all");
    expect(parseRange(undefined)).toBe("all");
  });
  it("windows timestamps", () => {
    expect(withinRange("2026-06-20T00:00:00Z", "week", now)).toBe(true);
    expect(withinRange("2026-06-01T00:00:00Z", "week", now)).toBe(false);
    expect(withinRange("2026-06-01T00:00:00Z", "month", now)).toBe(true);
    expect(withinRange("2020-01-01T00:00:00Z", "all", now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`cd kamee-fitness.webapp && npx vitest run lib/me/format.test.ts`).

- [ ] **Step 3: Implement**

```ts
// kamee-fitness.webapp/lib/me/units.ts
export type Units = "metric" | "imperial";

const KG_PER_LB = 0.45359237;
const M_PER_MI = 1609.344;

export function fmtWeight(kg: number, units: Units): string {
  return units === "imperial"
    ? `${Math.round(kg / KG_PER_LB)} lb`
    : `${Math.round(kg)} kg`;
}

export function fmtVolume(kg: number, units: Units): string {
  if (units === "imperial") {
    const lb = kg / KG_PER_LB;
    return lb >= 1000 ? `${(lb / 1000).toFixed(1)}k lb` : `${Math.round(lb)} lb`;
  }
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`;
}

export function fmtDistance(meters: number, units: Units): string {
  return units === "imperial"
    ? `${(meters / M_PER_MI).toFixed(1)} mi`
    : `${(meters / 1000).toFixed(1)} km`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fmtPaceFromMeters(
  meters: number,
  seconds: number,
  units: Units,
): string {
  if (meters <= 0 || seconds <= 0) return "—";
  const unitMeters = units === "imperial" ? M_PER_MI : 1000;
  const secPerUnit = seconds / (meters / unitMeters);
  const m = Math.floor(secPerUnit / 60);
  const sec = Math.round(secPerUnit % 60);
  const label = units === "imperial" ? "/mi" : "/km";
  return `${m}:${String(sec).padStart(2, "0")} ${label}`;
}
```

```ts
// kamee-fitness.webapp/lib/me/range.ts
export type Range = "week" | "month" | "all";

export function parseRange(value: string | undefined | null): Range {
  return value === "week" || value === "month" ? value : "all";
}

const DAY_MS = 86_400_000;

export function withinRange(iso: string, range: Range, now: Date): boolean {
  if (range === "all") return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const days = range === "week" ? 7 : 30;
  return now.getTime() - t <= days * DAY_MS;
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**

```bash
cd kamee-fitness.webapp && git add lib/me/units.ts lib/me/range.ts lib/me/format.test.ts && git commit -m "feat(me): unit + range formatting helpers"
```

---

### Task 4: Query layer + shared row types

**Files:**
- Create: `kamee-fitness.webapp/lib/me/queries.ts`

**Interfaces:**
- Consumes: a Supabase client (`Awaited<ReturnType<typeof createServerSupabase>>`).
- Produces: row types `ProfileRow`, `WorkoutSessionRow`, `SessionSetRow`, `TrackSessionRow`, `StreakRow`, `WeightRow`; bundle type `MeData`; `loadMeData(supabase, userId): Promise<MeData>`.

- [ ] **Step 1: Implement** (parallel reads; RLS-scoped + explicit `user_id` filter; resolve exercise names with graceful degradation)

```ts
// kamee-fitness.webapp/lib/me/queries.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Units = "metric" | "imperial";

export type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  units: Units;
  target_weight_kg: number | null;
  target_date: string | null;
  weight_kg: number | null;
  is_premium: boolean | null;
};

export type WorkoutSessionRow = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  status: "completed" | "abandoned" | "active";
  avg_hr: number | null;
};

export type SessionSetRow = {
  session_id: string;
  plan_exercise_id: string | null;
  reps_done: number | null;
  weight: number | null;
};

export type TrackSessionRow = {
  id: string;
  mode: string;
  title: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  elevation_gain_meters: number | null;
  avg_hr: number | null;
  finished_at: string | null;
  created_at: string;
  route_points: unknown;
};

export type StreakRow = {
  current_streak: number;
  longest_streak: number;
  track_current_streak: number;
  track_longest_streak: number;
} | null;

export type WeightRow = { weight_kg: number; logged_at: string };

export type MeData = {
  profile: ProfileRow | null;
  workouts: WorkoutSessionRow[];
  sets: SessionSetRow[];
  exerciseNames: Record<string, string>;
  tracks: TrackSessionRow[];
  streaks: StreakRow;
  weights: WeightRow[];
};

export async function loadMeData(
  supabase: SupabaseClient,
  userId: string,
): Promise<MeData> {
  const [profileRes, workoutsRes, tracksRes, streaksRes, weightsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, avatar_url, units, target_weight_kg, target_date, weight_kg, is_premium",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds, status, avg_hr")
        .eq("user_id", userId)
        .order("started_at", { ascending: true }),
      supabase
        .from("track_sessions")
        .select(
          "id, mode, title, distance_meters, duration_seconds, elevation_gain_meters, avg_hr, finished_at, created_at, route_points",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("user_streaks")
        .select(
          "current_streak, longest_streak, track_current_streak, track_longest_streak",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("weight_log")
        .select("weight_kg, logged_at")
        .eq("user_id", userId)
        .order("logged_at", { ascending: true }),
    ]);

  const workouts = (workoutsRes.data ?? []) as WorkoutSessionRow[];

  // Sets for this user's sessions (RLS scopes by session ownership).
  const sessionIds = workouts.map((w) => w.id);
  let sets: SessionSetRow[] = [];
  if (sessionIds.length) {
    const setsRes = await supabase
      .from("session_sets")
      .select("session_id, plan_exercise_id, reps_done, weight")
      .in("session_id", sessionIds);
    sets = (setsRes.data ?? []) as SessionSetRow[];
  }

  // Resolve plan_exercise_id -> exercise name. Degrades to {} if RLS blocks.
  const exerciseNames: Record<string, string> = {};
  const planExIds = [
    ...new Set(sets.map((s) => s.plan_exercise_id).filter(Boolean) as string[]),
  ];
  if (planExIds.length) {
    const nameRes = await supabase
      .from("plan_exercises")
      .select("id, exercises(name)")
      .in("id", planExIds);
    for (const row of (nameRes.data ?? []) as Array<{
      id: string;
      exercises: { name: string | null } | { name: string | null }[] | null;
    }>) {
      const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
      if (ex?.name) exerciseNames[row.id] = ex.name;
    }
  }

  return {
    profile: (profileRes.data ?? null) as ProfileRow | null,
    workouts,
    sets,
    exerciseNames,
    tracks: (tracksRes.data ?? []) as TrackSessionRow[],
    streaks: (streaksRes.data ?? null) as StreakRow,
    weights: (weightsRes.data ?? []) as WeightRow[],
  };
}
```

- [ ] **Step 2: Verify typecheck** (`cd kamee-fitness.webapp && npx tsc --noEmit`) — Expected: no errors.
- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add lib/me/queries.ts && git commit -m "feat(me): RLS-scoped query layer + row types"
```

---

### Task 5: Workouts aggregation (TDD)

**Files:**
- Create: `kamee-fitness.webapp/lib/me/workouts.ts`
- Test: `kamee-fitness.webapp/lib/me/workouts.test.ts`

**Interfaces:**
- Consumes: `WorkoutSessionRow`, `SessionSetRow`, `StreakRow` from `./queries`; `Range`, `withinRange` from `./range`.
- Produces: `WorkoutSummary` (`{ sessions:number; currentStreak:number; longestStreak:number; totalVolumeKg:number; timeTrainedSeconds:number; perWeek:{week:string;count:number}[]; topExercises:{name:string;sets:number}[]; prs:{name:string;weightKg:number}[] }`); `summarizeWorkouts(workouts, sets, exerciseNames, streaks, range, now): WorkoutSummary`.

- [ ] **Step 1: Write the failing test**

```ts
// kamee-fitness.webapp/lib/me/workouts.test.ts
import { describe, expect, it } from "vitest";
import { summarizeWorkouts } from "./workouts";
import type { SessionSetRow, WorkoutSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z");

const workouts: WorkoutSessionRow[] = [
  { id: "s1", started_at: "2026-06-20T10:00:00Z", duration_seconds: 1800, status: "completed", avg_hr: 120 },
  { id: "s2", started_at: "2026-06-10T10:00:00Z", duration_seconds: 2400, status: "completed", avg_hr: null },
  { id: "s3", started_at: "2026-06-09T10:00:00Z", duration_seconds: 999, status: "abandoned", avg_hr: null },
];
const sets: SessionSetRow[] = [
  { session_id: "s1", plan_exercise_id: "pe1", reps_done: 10, weight: 50 },
  { session_id: "s1", plan_exercise_id: "pe1", reps_done: 8, weight: 60 },
  { session_id: "s2", plan_exercise_id: "pe2", reps_done: 12, weight: 20 },
];
const names = { pe1: "Bench Press", pe2: "Squat" };
const streaks = { current_streak: 9, longest_streak: 14, track_current_streak: 0, track_longest_streak: 0 };

describe("summarizeWorkouts", () => {
  it("counts only completed sessions in range", () => {
    const all = summarizeWorkouts(workouts, sets, names, streaks, "all", now);
    expect(all.sessions).toBe(2); // s3 abandoned excluded
    const week = summarizeWorkouts(workouts, sets, names, streaks, "week", now);
    expect(week.sessions).toBe(1); // only s1 within 7 days
  });
  it("sums volume = reps*weight and time across completed sessions", () => {
    const all = summarizeWorkouts(workouts, sets, names, streaks, "all", now);
    expect(all.totalVolumeKg).toBe(10 * 50 + 8 * 60 + 12 * 20); // 1220
    expect(all.timeTrainedSeconds).toBe(1800 + 2400);
  });
  it("passes streaks through and computes PRs + top exercises by name", () => {
    const all = summarizeWorkouts(workouts, sets, names, streaks, "all", now);
    expect(all.currentStreak).toBe(9);
    expect(all.longestStreak).toBe(14);
    expect(all.prs).toContainEqual({ name: "Bench Press", weightKg: 60 });
    expect(all.topExercises[0]).toEqual({ name: "Bench Press", sets: 2 });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// kamee-fitness.webapp/lib/me/workouts.ts
import type { SessionSetRow, StreakRow, WorkoutSessionRow } from "./queries";
import { withinRange, type Range } from "./range";

export type WorkoutSummary = {
  sessions: number;
  currentStreak: number;
  longestStreak: number;
  totalVolumeKg: number;
  timeTrainedSeconds: number;
  perWeek: { week: string; count: number }[];
  topExercises: { name: string; sets: number }[];
  prs: { name: string; weightKg: number }[];
};

/** ISO week-start (Monday) UTC date key for a timestamp. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * 86_400_000;
  return new Date(monday).toISOString().slice(0, 10);
}

export function summarizeWorkouts(
  workouts: WorkoutSessionRow[],
  sets: SessionSetRow[],
  exerciseNames: Record<string, string>,
  streaks: StreakRow,
  range: Range,
  now: Date,
): WorkoutSummary {
  const completed = workouts.filter(
    (w) => w.status === "completed" && withinRange(w.started_at, range, now),
  );
  const ids = new Set(completed.map((w) => w.id));
  const inSets = sets.filter((s) => ids.has(s.session_id));

  const totalVolumeKg = inSets.reduce(
    (sum, s) => sum + (s.reps_done ?? 0) * (s.weight ?? 0),
    0,
  );
  const timeTrainedSeconds = completed.reduce(
    (sum, w) => sum + (w.duration_seconds ?? 0),
    0,
  );

  const perWeekMap = new Map<string, number>();
  for (const w of completed) {
    const k = weekKey(w.started_at);
    perWeekMap.set(k, (perWeekMap.get(k) ?? 0) + 1);
  }
  const perWeek = [...perWeekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, count]) => ({ week, count }));

  const setCount = new Map<string, number>();
  const prByName = new Map<string, number>();
  for (const s of inSets) {
    const name = s.plan_exercise_id
      ? exerciseNames[s.plan_exercise_id]
      : undefined;
    if (!name) continue;
    setCount.set(name, (setCount.get(name) ?? 0) + 1);
    if (s.weight != null) {
      prByName.set(name, Math.max(prByName.get(name) ?? 0, s.weight));
    }
  }
  const topExercises = [...setCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, sets]) => ({ name, sets }));
  const prs = [...prByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, weightKg]) => ({ name, weightKg }));

  return {
    sessions: completed.length,
    currentStreak: streaks?.current_streak ?? 0,
    longestStreak: streaks?.longest_streak ?? 0,
    totalVolumeKg,
    timeTrainedSeconds,
    perWeek,
    topExercises,
    prs,
  };
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**

```bash
cd kamee-fitness.webapp && git add lib/me/workouts.ts lib/me/workouts.test.ts && git commit -m "feat(me): workouts aggregation (volume, streaks, PRs, top exercises)"
```

---

### Task 6: Tracks aggregation (TDD)

**Files:**
- Create: `kamee-fitness.webapp/lib/me/tracks.ts`
- Test: `kamee-fitness.webapp/lib/me/tracks.test.ts`

**Interfaces:**
- Consumes: `TrackSessionRow`, `StreakRow` from `./queries`; `Range`, `withinRange` from `./range`.
- Produces: `TrackSummary` (`{ count:number; totalDistanceM:number; totalDurationS:number; totalElevationM:number; currentStreak:number; longestStreak:number; byMode:{mode:string;count:number;distanceM:number}[]; perWeek:{week:string;distanceM:number}[]; recent:{id:string;mode:string;distanceM:number;durationS:number;routePoints:unknown}[] }`); `summarizeTracks(tracks, streaks, range, now): TrackSummary`.

- [ ] **Step 1: Write the failing test**

```ts
// kamee-fitness.webapp/lib/me/tracks.test.ts
import { describe, expect, it } from "vitest";
import { summarizeTracks } from "./tracks";
import type { TrackSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z");
const tracks: TrackSessionRow[] = [
  { id: "t1", mode: "run", title: null, distance_meters: 5000, duration_seconds: 1500, elevation_gain_meters: 30, avg_hr: 150, finished_at: "2026-06-21T07:00:00Z", created_at: "2026-06-21T07:00:00Z", route_points: [] },
  { id: "t2", mode: "walk", title: null, distance_meters: 2000, duration_seconds: 1800, elevation_gain_meters: 5, avg_hr: null, finished_at: "2026-06-01T07:00:00Z", created_at: "2026-06-01T07:00:00Z", route_points: [] },
];
const streaks = { current_streak: 0, longest_streak: 0, track_current_streak: 10, track_longest_streak: 12 };

describe("summarizeTracks", () => {
  it("totals distance/duration/elevation and splits by mode", () => {
    const all = summarizeTracks(tracks, streaks, "all", now);
    expect(all.count).toBe(2);
    expect(all.totalDistanceM).toBe(7000);
    expect(all.totalDurationS).toBe(3300);
    expect(all.totalElevationM).toBe(35);
    expect(all.byMode).toContainEqual({ mode: "run", count: 1, distanceM: 5000 });
    expect(all.currentStreak).toBe(10);
  });
  it("respects the range window", () => {
    const week = summarizeTracks(tracks, streaks, "week", now);
    expect(week.count).toBe(1); // only t1 within 7 days
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// kamee-fitness.webapp/lib/me/tracks.ts
import type { StreakRow, TrackSessionRow } from "./queries";
import { withinRange, type Range } from "./range";

export type TrackSummary = {
  count: number;
  totalDistanceM: number;
  totalDurationS: number;
  totalElevationM: number;
  currentStreak: number;
  longestStreak: number;
  byMode: { mode: string; count: number; distanceM: number }[];
  perWeek: { week: string; distanceM: number }[];
  recent: {
    id: string;
    mode: string;
    distanceM: number;
    durationS: number;
    routePoints: unknown;
  }[];
};

function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * 86_400_000;
  return new Date(monday).toISOString().slice(0, 10);
}

function when(t: TrackSessionRow): string {
  return t.finished_at ?? t.created_at;
}

export function summarizeTracks(
  tracks: TrackSessionRow[],
  streaks: StreakRow,
  range: Range,
  now: Date,
): TrackSummary {
  const inRange = tracks.filter((t) => withinRange(when(t), range, now));

  let totalDistanceM = 0;
  let totalDurationS = 0;
  let totalElevationM = 0;
  const modeMap = new Map<string, { count: number; distanceM: number }>();
  const weekMap = new Map<string, number>();

  for (const t of inRange) {
    const dist = t.distance_meters ?? 0;
    totalDistanceM += dist;
    totalDurationS += t.duration_seconds ?? 0;
    totalElevationM += t.elevation_gain_meters ?? 0;
    const m = modeMap.get(t.mode) ?? { count: 0, distanceM: 0 };
    m.count += 1;
    m.distanceM += dist;
    modeMap.set(t.mode, m);
    const wk = weekKey(when(t));
    weekMap.set(wk, (weekMap.get(wk) ?? 0) + dist);
  }

  const byMode = [...modeMap.entries()]
    .map(([mode, v]) => ({ mode, ...v }))
    .sort((a, b) => b.distanceM - a.distanceM);
  const perWeek = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, distanceM]) => ({ week, distanceM }));
  const recent = [...inRange]
    .sort((a, b) => Date.parse(when(b)) - Date.parse(when(a)))
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      mode: t.mode,
      distanceM: t.distance_meters ?? 0,
      durationS: t.duration_seconds ?? 0,
      routePoints: t.route_points,
    }));

  return {
    count: inRange.length,
    totalDistanceM,
    totalDurationS,
    totalElevationM,
    currentStreak: streaks?.track_current_streak ?? 0,
    longestStreak: streaks?.track_longest_streak ?? 0,
    byMode,
    perWeek,
    recent,
  };
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**

```bash
cd kamee-fitness.webapp && git add lib/me/tracks.ts lib/me/tracks.test.ts && git commit -m "feat(me): tracks aggregation (distance, pace inputs, by-mode, streaks)"
```

---

### Task 7: Activity heatmap data (TDD)

**Files:**
- Create: `kamee-fitness.webapp/lib/me/heatmap.ts`
- Test: `kamee-fitness.webapp/lib/me/heatmap.test.ts`

**Interfaces:**
- Consumes: `WorkoutSessionRow`, `TrackSessionRow` from `./queries`.
- Produces: `HeatmapDay = { date:string; count:number }`; `buildHeatmap(workouts, tracks, weeks, now): { days: HeatmapDay[]; maxCount:number }` — `days` length = `weeks*7`, oldest→newest, ending on `now`'s UTC date.

- [ ] **Step 1: Write the failing test**

```ts
// kamee-fitness.webapp/lib/me/heatmap.test.ts
import { describe, expect, it } from "vitest";
import { buildHeatmap } from "./heatmap";
import type { TrackSessionRow, WorkoutSessionRow } from "./queries";

const now = new Date("2026-06-23T12:00:00Z");
const workouts = [
  { id: "s1", started_at: "2026-06-23T08:00:00Z", duration_seconds: 0, status: "completed", avg_hr: null },
  { id: "s2", started_at: "2026-06-22T08:00:00Z", duration_seconds: 0, status: "abandoned", avg_hr: null },
] as WorkoutSessionRow[];
const tracks = [
  { id: "t1", mode: "run", title: null, distance_meters: 0, duration_seconds: 0, elevation_gain_meters: 0, avg_hr: null, finished_at: "2026-06-23T09:00:00Z", created_at: "2026-06-23T09:00:00Z", route_points: [] },
] as TrackSessionRow[];

describe("buildHeatmap", () => {
  it("counts workouts (any status) + tracks per day", () => {
    const { days, maxCount } = buildHeatmap(workouts, tracks, 8, now);
    expect(days.length).toBe(8 * 7);
    const today = days[days.length - 1];
    expect(today.date).toBe("2026-06-23");
    expect(today.count).toBe(2); // s1 + t1
    expect(maxCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// kamee-fitness.webapp/lib/me/heatmap.ts
import type { TrackSessionRow, WorkoutSessionRow } from "./queries";

export type HeatmapDay = { date: string; count: number };

const DAY_MS = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const utcDay = (ms: number) => Math.floor(ms / DAY_MS) * DAY_MS;

export function buildHeatmap(
  workouts: WorkoutSessionRow[],
  tracks: TrackSessionRow[],
  weeks: number,
  now: Date,
): { days: HeatmapDay[]; maxCount: number } {
  const total = weeks * 7;
  const endDay = utcDay(now.getTime());
  const counts = new Map<string, number>();
  const bump = (iso: string | null) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return;
    const k = dayKey(utcDay(t));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const w of workouts) bump(w.started_at);
  for (const t of tracks) bump(t.finished_at ?? t.created_at);

  const days: HeatmapDay[] = [];
  let maxCount = 0;
  for (let i = total - 1; i >= 0; i--) {
    const key = dayKey(endDay - i * DAY_MS);
    const count = counts.get(key) ?? 0;
    if (count > maxCount) maxCount = count;
    days.push({ date: key, count });
  }
  return { days, maxCount };
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit**

```bash
cd kamee-fitness.webapp && git add lib/me/heatmap.ts lib/me/heatmap.test.ts && git commit -m "feat(me): activity heatmap data builder"
```

---

### Task 8: Weight series + route geometry (TDD)

**Files:**
- Create: `kamee-fitness.webapp/lib/me/weight.ts`, `kamee-fitness.webapp/lib/me/route.ts`
- Test: `kamee-fitness.webapp/lib/me/weight.test.ts`, `kamee-fitness.webapp/lib/me/route.test.ts`

**Interfaces:**
- Produces: `buildWeightSeries(weights, profile): { points:{date:string;kg:number}[]; currentKg:number|null; targetKg:number|null; toGoKg:number|null }`. `routeToPolyline(routePoints, size): string` — normalized SVG points string, `""` when <2 points.

- [ ] **Step 1: Write the failing tests**

```ts
// kamee-fitness.webapp/lib/me/weight.test.ts
import { describe, expect, it } from "vitest";
import { buildWeightSeries } from "./weight";

describe("buildWeightSeries", () => {
  it("builds a series with current + goal delta", () => {
    const out = buildWeightSeries(
      [
        { weight_kg: 65, logged_at: "2026-05-01T00:00:00Z" },
        { weight_kg: 63, logged_at: "2026-06-01T00:00:00Z" },
      ],
      { target_weight_kg: 60 } as never,
    );
    expect(out.points).toHaveLength(2);
    expect(out.currentKg).toBe(63);
    expect(out.targetKg).toBe(60);
    expect(out.toGoKg).toBe(3);
  });
  it("handles empty log", () => {
    const out = buildWeightSeries([], { target_weight_kg: null } as never);
    expect(out.currentKg).toBeNull();
    expect(out.toGoKg).toBeNull();
  });
});
```

```ts
// kamee-fitness.webapp/lib/me/route.test.ts
import { describe, expect, it } from "vitest";
import { routeToPolyline } from "./route";

describe("routeToPolyline", () => {
  it("returns empty for too-few points", () => {
    expect(routeToPolyline([], 100)).toBe("");
    expect(routeToPolyline([{ lat: 1, lng: 1 }], 100)).toBe("");
  });
  it("normalizes lat/lng into the box", () => {
    const pts = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
    ];
    const out = routeToPolyline(pts, 100);
    // two coordinate pairs
    expect(out.split(" ")).toHaveLength(2);
    // every coordinate within [0, 100]
    for (const pair of out.split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run both — expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// kamee-fitness.webapp/lib/me/weight.ts
import type { ProfileRow, WeightRow } from "./queries";

export type WeightSeries = {
  points: { date: string; kg: number }[];
  currentKg: number | null;
  targetKg: number | null;
  toGoKg: number | null;
};

export function buildWeightSeries(
  weights: WeightRow[],
  profile: Pick<ProfileRow, "target_weight_kg"> | null,
): WeightSeries {
  const points = weights
    .map((w) => ({ date: w.logged_at.slice(0, 10), kg: w.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const currentKg = points.length ? points[points.length - 1].kg : null;
  const targetKg = profile?.target_weight_kg ?? null;
  const toGoKg =
    currentKg != null && targetKg != null
      ? Math.round((currentKg - targetKg) * 10) / 10
      : null;
  return { points, currentKg, targetKg, toGoKg };
}
```

```ts
// kamee-fitness.webapp/lib/me/route.ts
type LatLng = { lat: number; lng: number };

/** Coerce a jsonb route_points value into an array of {lat,lng}. */
function coerce(routePoints: unknown): LatLng[] {
  if (!Array.isArray(routePoints)) return [];
  const out: LatLng[] = [];
  for (const p of routePoints) {
    if (p && typeof p === "object") {
      const lat = (p as Record<string, unknown>).lat ?? (p as Record<string, unknown>).latitude;
      const lng = (p as Record<string, unknown>).lng ?? (p as Record<string, unknown>).longitude;
      if (typeof lat === "number" && typeof lng === "number") out.push({ lat, lng });
    }
  }
  return out;
}

/**
 * Normalize GPS points into an SVG `points` string within a `size`×`size` box,
 * preserving aspect via uniform scale + centering. `""` when fewer than 2 points.
 */
export function routeToPolyline(routePoints: unknown, size: number): string {
  const pts = coerce(routePoints);
  if (pts.length < 2) return "";
  const xs = pts.map((p) => p.lng);
  const ys = pts.map((p) => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = size * 0.1;
  const inner = size - pad * 2;
  const scale = inner / Math.max(spanX, spanY);
  const offX = pad + (inner - spanX * scale) / 2;
  const offY = pad + (inner - spanY * scale) / 2;
  return pts
    .map((p) => {
      const x = offX + (p.lng - minX) * scale;
      // invert Y so north is up
      const y = size - (offY + (p.lat - minY) * scale);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
```

- [ ] **Step 4: Run both — expect PASS.**
- [ ] **Step 5: Commit**

```bash
cd kamee-fitness.webapp && git add lib/me/weight.ts lib/me/route.ts lib/me/weight.test.ts lib/me/route.test.ts && git commit -m "feat(me): weight series + route polyline geometry"
```

---

### Task 9: Presentational primitives

**Files:**
- Create: `kamee-fitness.webapp/components/me/StatCard.tsx`, `EmptyState.tsx`, `RangeToggle.tsx`, `MeHeader.tsx`

**Interfaces:**
- Consumes: `signOut` from `@/app/me/actions`; `Range` from `@/lib/me/range`.
- Produces: `StatCard({label,value,sub?,accent?})`; `EmptyState({title,hint?})`; `RangeToggle({range})` (client); `MeHeader({name,avatarUrl,isPremium,range})`.

- [ ] **Step 1: Write the components**

```tsx
// kamee-fitness.webapp/components/me/StatCard.tsx
const ACCENT = {
  leaf: "text-leaf-400",
  teal: "text-teal-500",
  sun: "text-sun-500",
  mist: "text-mist",
} as const;

export default function StatCard({
  label,
  value,
  sub,
  accent = "mist",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: keyof typeof ACCENT;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className={"mt-1 font-display text-2xl font-bold " + ACCENT[accent]}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted/80">{sub}</div>}
    </div>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/EmptyState.tsx
export default function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-6 text-center">
      <p className="text-sm text-mist/80">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted/70">{hint}</p>}
    </div>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/RangeToggle.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Range } from "@/lib/me/range";

const OPTIONS: { value: Range; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
];

export default function RangeToggle({ range }: { range: Range }) {
  const router = useRouter();
  const params = useSearchParams();
  function set(value: Range) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("range");
    else next.set("range", value);
    router.push(`/me?${next.toString()}`);
  }
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
          className={
            "rounded-full px-3 py-1 font-medium transition-colors " +
            (range === o.value
              ? "bg-leaf-600 text-white"
              : "text-muted hover:text-mist")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/MeHeader.tsx
import Image from "next/image";
import { signOut } from "@/app/me/actions";
import type { Range } from "@/lib/me/range";
import RangeToggle from "./RangeToggle";

export default function MeHeader({
  name,
  avatarUrl,
  isPremium,
  range,
}: {
  name: string;
  avatarUrl: string | null;
  isPremium: boolean;
  range: Range;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-6">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
          />
        ) : (
          <div className="grid size-11 place-items-center rounded-full bg-leaf-500/15 font-display font-bold text-leaf-300">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-display text-lg font-bold text-mist">{name}</div>
          {isPremium && (
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-sun-500">
              Premium
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RangeToggle range={range} />
        <form action={signOut}>
          <button className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-muted hover:text-mist">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify typecheck** (`cd kamee-fitness.webapp && npx tsc --noEmit`).
- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/me/StatCard.tsx components/me/EmptyState.tsx components/me/RangeToggle.tsx components/me/MeHeader.tsx && git commit -m "feat(me): stat card, empty state, range toggle, header"
```

---

### Task 10: Hand-rolled SVG — heatmap + route thumbnail + track list

**Files:**
- Create: `kamee-fitness.webapp/components/me/ActivityHeatmap.tsx`, `RouteThumbnail.tsx`, `TrackList.tsx`

**Interfaces:**
- Consumes: `HeatmapDay` from `@/lib/me/heatmap`; `routeToPolyline` from `@/lib/me/route`; `fmtDistance`, `fmtDuration`, `Units` from `@/lib/me/units`; `TrackSummary` from `@/lib/me/tracks`.
- Produces: `ActivityHeatmap({days,maxCount})`; `RouteThumbnail({routePoints,accent?})`; `TrackList({recent,units})`.

- [ ] **Step 1: Write the components**

```tsx
// kamee-fitness.webapp/components/me/ActivityHeatmap.tsx
import type { HeatmapDay } from "@/lib/me/heatmap";

const CELL = 11;
const GAP = 3;

function shade(count: number, max: number): string {
  if (count <= 0) return "rgba(255,255,255,0.05)";
  const t = max <= 1 ? 1 : count / max;
  const alpha = 0.25 + t * 0.6; // 0.25..0.85
  return `rgba(125,190,141,${alpha.toFixed(2)})`; // leaf-500
}

export default function ActivityHeatmap({
  days,
  maxCount,
}: {
  days: HeatmapDay[];
  maxCount: number;
}) {
  const weeks = Math.ceil(days.length / 7);
  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);
  const active = days.filter((d) => d.count > 0).length;
  return (
    <figure className="overflow-x-auto">
      <figcaption className="sr-only">
        Activity over the last {weeks} weeks: {active} active days.
      </figcaption>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${active} active days in the last ${weeks} weeks`}
      >
        {days.map((d, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          return (
            <rect
              key={d.date}
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
        })}
      </svg>
    </figure>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/RouteThumbnail.tsx
import { routeToPolyline } from "@/lib/me/route";

const SIZE = 96;

export default function RouteThumbnail({
  routePoints,
  accent = "var(--color-teal-500)",
}: {
  routePoints: unknown;
  accent?: string;
}) {
  const points = routeToPolyline(routePoints, SIZE);
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rounded-xl border border-white/8 bg-white/[0.02]"
      role="img"
      aria-label="Route map"
    >
      {points ? (
        <polyline
          points={points}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <line x1="20" y1="76" x2="76" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
      )}
    </svg>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/TrackList.tsx
import type { TrackSummary } from "@/lib/me/tracks";
import { fmtDistance, fmtDuration, type Units } from "@/lib/me/units";
import RouteThumbnail from "./RouteThumbnail";

export default function TrackList({
  recent,
  units,
}: {
  recent: TrackSummary["recent"];
  units: Units;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {recent.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3"
        >
          <RouteThumbnail routePoints={t.routePoints} />
          <div>
            <div className="font-display text-sm font-semibold capitalize text-mist">
              {t.mode}
            </div>
            <div className="text-xs text-muted">
              {fmtDistance(t.distanceM, units)} · {fmtDuration(t.durationS)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify typecheck** (`cd kamee-fitness.webapp && npx tsc --noEmit`).
- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/me/ActivityHeatmap.tsx components/me/RouteThumbnail.tsx components/me/TrackList.tsx && git commit -m "feat(me): SVG activity heatmap + route thumbnails + track list"
```

---

### Task 11: Recharts charts (install + 3 charts)

**Files:**
- Modify: `kamee-fitness.webapp/package.json` (add `recharts`)
- Create: `kamee-fitness.webapp/components/me/WorkoutsPerWeekChart.tsx`, `DistancePerWeekChart.tsx`, `WeightChart.tsx`

**Interfaces:**
- Consumes: `WorkoutSummary["perWeek"]`, `TrackSummary["perWeek"]`, `WeightSeries["points"]`.
- Produces: three `"use client"` chart components.

- [ ] **Step 1: Install Recharts**

Run: `cd kamee-fitness.webapp && npm install recharts`
Expected: installs cleanly. If a React-19 peer warning blocks install, re-run with the repo's standard install flags and confirm a compatible version resolves; record the version in the commit.

- [ ] **Step 2: Verify it imports under React 19** — build a throwaway check:

Run: `cd kamee-fitness.webapp && node -e "require('recharts'); console.log('recharts ok')"`
Expected: `recharts ok`.

- [ ] **Step 3: Write the charts**

```tsx
// kamee-fitness.webapp/components/me/WorkoutsPerWeekChart.tsx
"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function WorkoutsPerWeekChart({
  data,
}: {
  data: { week: string; count: number }[];
}) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="week"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(w: string) => w.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#0e1416",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#eef4f0",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="#7dbe8d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/DistancePerWeekChart.tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export default function DistancePerWeekChart({
  data,
}: {
  data: { week: string; km: number }[];
}) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="distFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3fb6c0" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3fb6c0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="week"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(w: string) => w.slice(5)}
            interval="preserveStartEnd"
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
          <Area
            type="monotone"
            dataKey="km"
            stroke="#3fb6c0"
            strokeWidth={2}
            fill="url(#distFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

```tsx
// kamee-fitness.webapp/components/me/WeightChart.tsx
"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function WeightChart({
  data,
  targetKg,
}: {
  data: { date: string; kg: number }[];
  targetKg: number | null;
}) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fill: "#8ea0a3", fontSize: 10 }}
            width={28}
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
          {targetKg != null && (
            <ReferenceLine
              y={targetKg}
              stroke="#efb54e"
              strokeDasharray="4 4"
              label={{ value: "goal", fill: "#efb54e", fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="kg"
            stroke="#9bd2a8"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck + build** (`cd kamee-fitness.webapp && npx tsc --noEmit && npm run build`).
- [ ] **Step 5: Commit**

```bash
cd kamee-fitness.webapp && git add package.json package-lock.json components/me/WorkoutsPerWeekChart.tsx components/me/DistancePerWeekChart.tsx components/me/WeightChart.tsx && git commit -m "feat(me): Recharts workouts/distance/weight charts"
```

---

### Task 12: Compose `app/me/page.tsx`

**Files:**
- Create: `kamee-fitness.webapp/app/me/page.tsx`

**Interfaces:**
- Consumes: `requireUser`; `createServerSupabase`; `loadMeData`; all `lib/me/*` aggregators + `lib/me/units`; all `components/me/*`.

- [ ] **Step 1: Write the page** (server component; `searchParams` is async in Next 16)

```tsx
// kamee-fitness.webapp/app/me/page.tsx
import { requireUser } from "@/lib/user/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadMeData } from "@/lib/me/queries";
import { parseRange } from "@/lib/me/range";
import { summarizeWorkouts } from "@/lib/me/workouts";
import { summarizeTracks } from "@/lib/me/tracks";
import { buildHeatmap } from "@/lib/me/heatmap";
import { buildWeightSeries } from "@/lib/me/weight";
import {
  fmtDistance,
  fmtDuration,
  fmtPaceFromMeters,
  fmtVolume,
  fmtWeight,
} from "@/lib/me/units";
import MeHeader from "@/components/me/MeHeader";
import StatCard from "@/components/me/StatCard";
import EmptyState from "@/components/me/EmptyState";
import ActivityHeatmap from "@/components/me/ActivityHeatmap";
import TrackList from "@/components/me/TrackList";
import WorkoutsPerWeekChart from "@/components/me/WorkoutsPerWeekChart";
import DistancePerWeekChart from "@/components/me/DistancePerWeekChart";
import WeightChart from "@/components/me/WeightChart";

export const metadata = { title: "Your stats" };

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const data = await loadMeData(supabase, user.id);
  const range = parseRange((await searchParams).range);
  const now = new Date();

  const units = data.profile?.units ?? "metric";
  const name = data.profile?.display_name ?? user.email?.split("@")[0] ?? "You";
  const isPremium =
    Boolean(data.profile?.is_premium) || false;

  const w = summarizeWorkouts(
    data.workouts,
    data.sets,
    data.exerciseNames,
    data.streaks,
    range,
    now,
  );
  const t = summarizeTracks(data.tracks, data.streaks, range, now);
  const heat = buildHeatmap(data.workouts, data.tracks, 26, now);
  const weight = buildWeightSeries(data.weights, data.profile);

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-10">
      <MeHeader
        name={name}
        avatarUrl={data.profile?.avatar_url ?? null}
        isPremium={isPremium}
        range={range}
      />

      {/* Activity */}
      <section className="mt-10">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Activity
        </h2>
        <div className="mt-4">
          <ActivityHeatmap days={heat.days} maxCount={heat.maxCount} />
        </div>
      </section>

      {/* Workouts */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-leaf-400">Workouts</h2>
        {w.sessions === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No completed workouts in this range yet."
              hint="Start a session in the Kamee app to see your stats here."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Sessions" value={String(w.sessions)} accent="leaf" />
              <StatCard
                label="Streak"
                value={`${w.currentStreak}`}
                sub={`best ${w.longestStreak}`}
                accent="sun"
              />
              <StatCard label="Volume" value={fmtVolume(w.totalVolumeKg, units)} accent="leaf" />
              <StatCard label="Time trained" value={fmtDuration(w.timeTrainedSeconds)} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                  Workouts / week
                </h3>
                <div className="mt-2">
                  <WorkoutsPerWeekChart data={w.perWeek} />
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                    Top exercises
                  </h3>
                  {w.topExercises.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-mist/85">
                      {w.topExercises.map((e) => (
                        <li key={e.name} className="flex justify-between gap-3">
                          <span>{e.name}</span>
                          <span className="text-muted">{e.sets} sets</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted/70">No set data yet.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                    Personal records
                  </h3>
                  {w.prs.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-mist/85">
                      {w.prs.map((p) => (
                        <li key={p.name} className="flex justify-between gap-3">
                          <span>{p.name}</span>
                          <span className="text-leaf-400">
                            {fmtWeight(p.weightKg, units)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted/70">No PRs yet.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Tracks */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-teal-500">
          Outdoor tracks
        </h2>
        {t.count === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No tracks in this range yet."
              hint="Walk, run, or cycle with Kamee to fill this in."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Distance" value={fmtDistance(t.totalDistanceM, units)} accent="teal" />
              <StatCard label="Sessions" value={String(t.count)} accent="teal" />
              <StatCard
                label="Avg pace"
                value={fmtPaceFromMeters(t.totalDistanceM, t.totalDurationS, units)}
              />
              <StatCard
                label="Track streak"
                value={`${t.currentStreak}`}
                sub={`best ${t.longestStreak}`}
                accent="sun"
              />
            </div>
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                Distance / week
              </h3>
              <div className="mt-2">
                <DistancePerWeekChart
                  data={t.perWeek.map((p) => ({
                    week: p.week,
                    km: Math.round((p.distanceM / 1000) * 10) / 10,
                  }))}
                />
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-[0.16em] text-muted">
                Recent routes
              </h3>
              <div className="mt-2">
                <TrackList recent={t.recent} units={units} />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Weight */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-mist">Weight &amp; body</h2>
        {weight.points.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No weight logged yet." hint="Log your weight in the app to track it here." />
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="font-display text-3xl font-bold text-mist">
                {weight.currentKg != null ? fmtWeight(weight.currentKg, units) : "—"}
              </div>
              {weight.targetKg != null && (
                <div className="text-sm text-muted">
                  goal {fmtWeight(weight.targetKg, units)}
                  {weight.toGoKg != null && (
                    <span className="text-ember-400">
                      {" "}
                      · {fmtWeight(Math.abs(weight.toGoKg), units)} to go
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3">
              <WeightChart data={weight.points} targetKg={weight.targetKg} />
            </div>
          </div>
        )}
      </section>

      <footer className="mt-16 border-t border-white/8 pt-6 text-xs text-muted">
        Read-only — logging happens in the Kamee app.{" "}
        <a href="/" className="hover:text-white">
          Back to home
        </a>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck + build** (`cd kamee-fitness.webapp && npx tsc --noEmit && npm run build`). Expected: `/me` listed (dynamic ƒ — it reads cookies/auth).
- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add app/me/page.tsx && git commit -m "feat(me): compose /me stats dashboard"
```

---

### Task 13: Landing header "Log in" link

**Files:**
- Modify: `kamee-fitness.webapp/components/landing/Header.tsx`

- [ ] **Step 1: Add a subtle Log in link** before the "Get the app" button:

In `components/landing/Header.tsx`, change the right-hand cluster so it reads:

```tsx
        <div className="flex items-center gap-4">
          <a
            href="/me"
            className="text-xs font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:text-mist"
          >
            Log in
          </a>
          <a
            href="#get-the-app"
            className="rounded-full border border-leaf-500/40 bg-leaf-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-leaf-300 transition-colors hover:bg-leaf-500/20"
          >
            Get the app
          </a>
        </div>
```

(Replace the single "Get the app" anchor with this wrapped cluster.)

- [ ] **Step 2: Verify typecheck** (`cd kamee-fitness.webapp && npx tsc --noEmit`).
- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Header.tsx && git commit -m "feat(me): subtle Log in link in the landing header"
```

---

### Task 14: Final verification + manual smoke

**Files:** none.

- [ ] **Step 1: Full gate**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: typecheck clean; all vitest pass (existing 41 + new format/workouts/tracks/heatmap/weight/route tests); lint shows only the pre-existing errors in untouched files; build succeeds with `/login` (static) and `/me` (dynamic ƒ).

- [ ] **Step 2: Manual smoke** (`npm run dev`):
  - Visit `/me` while logged out → redirected to `/login`.
  - Sign in with a real Kamee account email (code path) → lands on `/me`.
  - Confirm: header shows name + (if applicable) Premium; activity heatmap renders; Workouts/Tracks/Weight sections show real numbers or honest empty states; range toggle (Week/Month/All) changes headline stats via `?range`.
  - Confirm RLS: the numbers match only that user's data.
  - Toggle OS reduced-motion: no animation regressions.
  - Sign out → back to `/`.

- [ ] **Step 3: Note** any data quirks (e.g., empty `exerciseNames` if `plan_exercises` RLS blocks the join → Top Exercises/PRs show "No … yet"). If blocked, that's a known graceful-degradation path; flag for a follow-up RLS policy if PRs are wanted.

---

## Self-Review

**Spec coverage:**
- Email-OTP login, no allowlist, `shouldCreateUser:false`, Turnstile → Task 2. ✓
- `requireUser` gate + proxy refresh/gate for `/me` → Task 1. ✓
- RLS-scoped reads, anon key, defensive `user_id` → Task 4. ✓
- Workouts (sessions, streak, volume, time, per-week, top exercises, PRs) → Tasks 5, 12. ✓
- Tracks (distance, duration, pace, elevation, by-mode, streak, recent routes) → Tasks 6, 10, 12. ✓
- Activity heatmap (workouts+tracks) → Tasks 7, 10, 12. ✓
- Weight & body (series + goal) → Tasks 8, 11, 12. ✓
- Units honored everywhere → Task 3, used throughout. ✓
- Range toggle (week/month/all) → Tasks 3, 9, 12. ✓
- Charts via library (Recharts) + hand-rolled heatmap/routes → Tasks 10, 11. ✓
- Landing "Log in" link → Task 13. ✓
- No calories; empty states; reduced-motion → Tasks 12, 14. ✓
- Pure modules tested under `lib/me`; visual via tsc/build → all tasks. ✓

**Placeholder scan:** none ("Screenshot soon"-style UI strings absent; "No … yet" are intentional empty-state copy). No TODO/TBD.

**Type consistency:** `MeData`, row types, and aggregator signatures defined in Task 4/5/6/7/8 are consumed with matching names in Task 12. `Range`/`parseRange`/`withinRange` (Task 3) used in 5/6/9/12. `fmtVolume/fmtDistance/fmtDuration/fmtPaceFromMeters/fmtWeight` (Task 3) used in 10/12. `summarizeWorkouts`/`summarizeTracks`/`buildHeatmap`/`buildWeightSeries`/`routeToPolyline` consistent across definition and use. Chart prop shapes (`{week,count}`, `{week,km}`, `{date,kg}`) match what Task 12 passes.
