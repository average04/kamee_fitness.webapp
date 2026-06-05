# Exercise Catalog Backoffice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated `/admin` area to the Kamee webapp giving the owner full CRUD over the shared `exercises` catalog, including demo-image upload.

**Architecture:** Approach A — Supabase Auth (magic-link) gates `/admin` via an email allowlist enforced in a Next 16 `proxy.ts` and re-checked in a cached `requireAdmin()` DAL. Reads use the anon/session client (exercises are public-read); all writes and image uploads run in Server Actions using a server-only service-role client. No database/RLS migration — the shared production schema is untouched.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, `@supabase/ssr` + `@supabase/supabase-js`, Tailwind v4, Vitest (new, for pure-logic unit tests).

---

## Critical Next.js 16 / project facts (read before coding)

- **`middleware.ts` is renamed to `proxy.ts`** in Next 16. Export a function named `proxy` (not `middleware`). Same `config.matcher` API. Defaults to the Node.js runtime.
- **`cookies()` is async** — always `const store = await cookies()`.
- **Route `params` and `searchParams` are Promises** — `const { id } = await params`.
- **Server Action body limit defaults to 1 MB** — must raise to `10mb` via `experimental.serverActions.bodySizeLimit` for image upload.
- **Validate auth inside every Server Action** — the proxy alone is not sufficient (Next docs, data-security guide). `requireAdmin()` runs in the panel layout AND at the top of every action.
- All app code lives in the **nested** app root: `d:\Projects\kamee-fitness.webapp\kamee-fitness.webapp\`. Paths below are relative to that nested root unless stated. Git root is the **outer** dir `d:\Projects\kamee-fitness.webapp\`; run `git`/commits from there.
- The `@/` TypeScript alias maps to the nested app root (used by the existing waitlist route).
- **Do not touch** `lib/supabase.ts` (the anon insert client the waitlist route depends on) — new clients live under `lib/supabase/`.

### Image storage convention (must match the mobile app exactly)

The mobile app (`src/lib/demoImage.ts`) resolves images by stripping an `exercise-demos/` prefix then calling `getPublicUrl`. Therefore:

- **Storage object key** in bucket `exercise-demos`: `<slug>.png` (or `.jpg`).
- **`exercises.demo_image_path` value**: `exercise-demos/<slug>.png` (bucket-prefixed).

Breaking this convention breaks image display in the production mobile app.

## File structure

```
proxy.ts                                   NEW  session refresh + /admin gate
next.config.ts                             MOD  add experimental.serverActions.bodySizeLimit
package.json                               MOD  deps + test scripts
vitest.config.ts                           NEW  node test env
.env.local                                 MOD  add SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS

lib/admin/allowlist.ts                     NEW  parseAllowlist, isAllowed (pure, TDD)
lib/admin/allowlist.test.ts                NEW
lib/admin/exercises.ts                     NEW  types + slugify/parseList/parse/validate (pure, TDD)
lib/admin/exercises.test.ts                NEW
lib/admin/auth.ts                          NEW  requireAdmin() cached DAL

lib/supabase/server.ts                     NEW  createServerSupabase() (cookie/SSR, anon)
lib/supabase/browser.ts                    NEW  createBrowserSupabase() (client, anon)
lib/supabase/admin.ts                      NEW  createAdminSupabase() (service-role, server-only)

app/auth/callback/route.ts                 NEW  exchangeCodeForSession → redirect
app/admin/login/page.tsx                   NEW  magic-link request form (public)
app/admin/actions.ts                       NEW  signOut() server action
app/admin/(panel)/layout.tsx               NEW  requireAdmin + dark shell + nav
app/admin/(panel)/page.tsx                 NEW  redirect → /admin/exercises
app/admin/(panel)/exercises/page.tsx       NEW  list: search + pagination
app/admin/(panel)/exercises/queries.ts     NEW  listExercises/getExercise/getDistinctMuscles (reads)
app/admin/(panel)/exercises/actions.ts     NEW  createExercise/updateExercise/deleteExercise
app/admin/(panel)/exercises/new/page.tsx   NEW
app/admin/(panel)/exercises/[id]/edit/page.tsx  NEW

components/admin/ExerciseTable.tsx         NEW  list rendering + search box
components/admin/ExerciseForm.tsx          NEW  shared new/edit form (useActionState)
components/admin/ArrayField.tsx            NEW  chip input → newline-joined hidden field
components/admin/ImageUploadField.tsx      NEW  current image + replace/remove
```

Route group `(panel)` keeps `/admin/login` OUT of the auth-gated layout (so the layout's `requireAdmin()` can't redirect-loop the login page). URLs: `(panel)/page.tsx` → `/admin`, `(panel)/exercises/...` → `/admin/exercises/...`, `login/page.tsx` → `/admin/login`.

---

## Task 1: Tooling, dependencies, and config

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `vitest.config.ts`
- Modify: `next.config.ts`
- Modify: `.env.local`

- [ ] **Step 1: Install dependencies**

Run (from the nested app root `kamee-fitness.webapp\kamee-fitness.webapp`):

```bash
npm install @supabase/ssr server-only
npm install -D vitest
```

Expected: `@supabase/ssr` and `server-only` appear under `dependencies`, `vitest` under `devDependencies`.

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Raise the Server Action body limit in `next.config.ts`**

Replace the `nextConfig` object so it includes the experimental option (keep the existing `pageExtensions` and the MDX wrapping intact):

```ts
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Allow .mdx files to be treated as routable/importable page-like modules.
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  experimental: {
    // Demo images are up to 10 MB (matches the exercise-demos bucket limit);
    // the default Server Action body limit is 1 MB.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

// No remark/rehype plugins — Turbopack (Next 16) doesn't run them. Heading
// IDs are derived at render time in mdx-components.tsx via slugifyHeading.
const withMDX = createMDX({ options: {} });

export default withMDX(nextConfig);
```

- [ ] **Step 5: Add admin env vars to `.env.local`**

Append these two lines (copy the service-role key value from the mobile app's `D:\Projects\kamee-fitness\Fitness app\.env` — the `service_role` key for project `kamee_fitness`; do not commit it). Set `ADMIN_EMAILS` to the owner's login email(s), comma-separated:

```
SUPABASE_SERVICE_ROLE_KEY=<service-role key for project kamee_fitness>
ADMIN_EMAILS=bayogjayr@gmail.com
```

- [ ] **Step 6: Verify the toolchain builds**

Run: `npm run lint`
Expected: no errors (config-only changes so far).

- [ ] **Step 7: Commit**

```bash
git add kamee-fitness.webapp/package.json kamee-fitness.webapp/package-lock.json kamee-fitness.webapp/vitest.config.ts kamee-fitness.webapp/next.config.ts
git commit -m "chore(admin): add supabase/ssr, vitest, and server-action body limit"
```

(`.env.local` is gitignored — do not add it.)

---

## Task 2: Allowlist helpers (TDD)

**Files:**
- Create: `lib/admin/allowlist.ts`
- Test: `lib/admin/allowlist.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/admin/allowlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAllowed, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("splits, trims, and lowercases", () => {
    expect(parseAllowlist("A@x.com, B@Y.com")).toEqual(["a@x.com", "b@y.com"]);
  });
  it("returns [] for undefined/empty", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("   ,  ")).toEqual([]);
  });
});

describe("isAllowed", () => {
  const list = ["a@x.com"];
  it("matches case-insensitively", () => {
    expect(isAllowed("A@X.com", list)).toBe(true);
  });
  it("rejects non-members and nullish", () => {
    expect(isAllowed("z@x.com", list)).toBe(false);
    expect(isAllowed(null, list)).toBe(false);
    expect(isAllowed(undefined, list)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./allowlist`.

- [ ] **Step 3: Implement `lib/admin/allowlist.ts`**

```ts
/**
 * Pure helpers for the admin email allowlist. Imported by both `proxy.ts`
 * (the request gate) and `lib/admin/auth.ts` (the server-side DAL). Kept
 * dependency-free so the proxy bundle stays lean.
 */
export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAllowed(
  email: string | null | undefined,
  allowlist: string[],
): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add kamee-fitness.webapp/lib/admin/allowlist.ts kamee-fitness.webapp/lib/admin/allowlist.test.ts
git commit -m "feat(admin): email allowlist helpers"
```

---

## Task 3: Exercise types + form/validation helpers (TDD)

**Files:**
- Create: `lib/admin/exercises.ts`
- Test: `lib/admin/exercises.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/admin/exercises.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseExerciseForm,
  parseList,
  slugify,
  validateExerciseInput,
} from "./exercises";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Barbell Bench Press!")).toBe("barbell-bench-press");
  });
  it("collapses separators and trims hyphens", () => {
    expect(slugify("  DB --Row  ")).toBe("db-row");
  });
});

describe("parseList", () => {
  it("splits on newlines, trims, drops empties, dedupes", () => {
    expect(parseList("a\nb\n\n a \n c")).toEqual(["a", "b", "c"]);
  });
  it("returns [] for empty/nullish", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList(null)).toEqual([]);
  });
});

describe("parseExerciseForm", () => {
  it("extracts fields, parses arrays, derives slug from name when blank", () => {
    const fd = new FormData();
    fd.set("name", "Goblet Squat");
    fd.set("slug", "");
    fd.set("primary_muscle", "quads");
    fd.set("secondary_muscles", "glutes\ncore");
    fd.set("equipment", "dumbbell");
    fd.set("cues", "chest up\nknees out");
    fd.set("common_mistakes", "heels lift");
    fd.set("demo_image_path", "");
    fd.set("demo_video_path", "");
    const out = parseExerciseForm(fd);
    expect(out.slug).toBe("goblet-squat");
    expect(out.secondary_muscles).toEqual(["glutes", "core"]);
    expect(out.equipment).toEqual(["dumbbell"]);
    expect(out.cues).toEqual(["chest up", "knees out"]);
    expect(out.demo_image_path).toBeNull();
  });
});

describe("validateExerciseInput", () => {
  const base = {
    name: "Squat",
    slug: "squat",
    primary_muscle: "quads",
    secondary_muscles: [],
    equipment: [],
    cues: [],
    common_mistakes: [],
    demo_image_path: null,
    demo_video_path: null,
  };
  it("accepts a valid input", () => {
    const r = validateExerciseInput(base);
    expect(r.ok).toBe(true);
  });
  it("flags a missing name", () => {
    const r = validateExerciseInput({ ...base, name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeTruthy();
  });
  it("flags a malformed slug", () => {
    const r = validateExerciseInput({ ...base, slug: "Bad Slug" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.slug).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./exercises`.

- [ ] **Step 3: Implement `lib/admin/exercises.ts`**

```ts
/**
 * Types and pure helpers for the exercise catalog admin. No I/O — safe to
 * unit-test and to import from both client and server modules.
 */

export type ExerciseInput = {
  name: string;
  slug: string;
  primary_muscle: string;
  secondary_muscles: string[];
  equipment: string[];
  cues: string[];
  common_mistakes: string[];
  demo_image_path: string | null;
  demo_video_path: string | null;
};

export type Exercise = ExerciseInput & {
  id: string;
  is_bodyweight: boolean; // generated column — read-only
  created_by: string | null;
  created_at: string;
};

/** State returned by the create/update Server Actions to `useActionState`. */
export type ExerciseFormState = {
  errors?: Record<string, string>;
  message?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Split a textarea value into a trimmed, de-duplicated, order-preserving list. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const v = line.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export function parseExerciseForm(formData: FormData): ExerciseInput {
  const str = (k: string) =>
    ((formData.get(k) as string | null) ?? "").trim();
  const rawSlug = str("slug");
  return {
    name: str("name"),
    slug: rawSlug ? slugify(rawSlug) : slugify(str("name")),
    primary_muscle: str("primary_muscle"),
    secondary_muscles: parseList(formData.get("secondary_muscles") as string),
    equipment: parseList(formData.get("equipment") as string),
    cues: parseList(formData.get("cues") as string),
    common_mistakes: parseList(formData.get("common_mistakes") as string),
    demo_image_path: str("demo_image_path") || null,
    demo_video_path: str("demo_video_path") || null,
  };
}

export type ValidationResult =
  | { ok: true; value: ExerciseInput }
  | { ok: false; errors: Record<string, string> };

export function validateExerciseInput(input: ExerciseInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.name) errors.name = "Name is required.";
  if (!input.slug) errors.slug = "Slug is required.";
  else if (!SLUG_RE.test(input.slug))
    errors.slug = "Slug must be lowercase letters, numbers, and hyphens.";
  if (!input.primary_muscle)
    errors.primary_muscle = "Primary muscle is required.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: input };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (all tests across both files).

- [ ] **Step 5: Commit**

```bash
git add kamee-fitness.webapp/lib/admin/exercises.ts kamee-fitness.webapp/lib/admin/exercises.test.ts
git commit -m "feat(admin): exercise types, form parsing, and validation helpers"
```

---

## Task 4: Supabase client factories

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Create `lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-bound Supabase client for Server Components, Route Handlers, and
 * Server Actions. Uses the anon key; reads the logged-in user from cookies.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (cookies are read-only there).
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 2: Create `lib/supabase/browser.ts`**

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (anon key) for the login form. */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create `lib/supabase/admin.ts`**

```ts
import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES RLS — server-only, never import this
 * from a Client Component. Used exclusively by admin Server Actions after
 * `requireAdmin()` has authorized the caller.
 */
export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add kamee-fitness.webapp/lib/supabase/server.ts kamee-fitness.webapp/lib/supabase/browser.ts kamee-fitness.webapp/lib/supabase/admin.ts
git commit -m "feat(admin): supabase server, browser, and service-role clients"
```

---

## Task 5: Auth DAL — `requireAdmin()`

**Files:**
- Create: `lib/admin/auth.ts`

- [ ] **Step 1: Create `lib/admin/auth.ts`**

```ts
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAllowed, parseAllowlist } from "@/lib/admin/allowlist";

/**
 * Data Access Layer gate. Returns the authenticated admin user or redirects.
 * Memoized per-request via React `cache` so layout + actions don't re-query.
 * Re-checked in every Server Action — never trust the proxy alone.
 */
export const requireAdmin = cache(async (): Promise<User> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!isAllowed(user.email, parseAllowlist(process.env.ADMIN_EMAILS))) {
    redirect("/admin/login?error=not-authorized");
  }
  return user;
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add kamee-fitness.webapp/lib/admin/auth.ts
git commit -m "feat(admin): requireAdmin DAL gate"
```

---

## Task 6: Proxy — session refresh + `/admin` gate

**Files:**
- Create: `proxy.ts` (at the nested app root, alongside `app/`)

- [ ] **Step 1: Create `proxy.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowed, parseAllowlist } from "@/lib/admin/allowlist";

/**
 * Next 16 Proxy (formerly middleware). Refreshes the Supabase session on every
 * matched request and gates `/admin/*` (except `/admin/login`) behind an
 * authenticated, allowlisted user. Authorization is ALSO enforced server-side
 * in `requireAdmin()`; this proxy is the first, not the only, line of defense.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add kamee-fitness.webapp/proxy.ts
git commit -m "feat(admin): proxy session refresh and /admin allowlist gate"
```

---

## Task 7: Auth callback route

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create `app/auth/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Magic-link landing. Exchanges the PKCE `code` for a session (writing the
 * auth cookies) then redirects into the admin panel.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin/exercises";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add kamee-fitness.webapp/app/auth/callback/route.ts
git commit -m "feat(admin): magic-link auth callback route"
```

---

## Task 8: Login page

**Files:**
- Create: `app/admin/login/page.tsx`

- [ ] **Step 1: Create `app/admin/login/page.tsx`**

```tsx
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const banner =
    params.get("error") === "not-authorized"
      ? "That account is not authorized for the admin panel."
      : params.get("error") === "auth"
        ? "Sign-in link was invalid or expired. Try again."
        : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#07090a] px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8">
        <h1 className="text-xl font-semibold">Kamee Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sign in with a magic link sent to your email.
        </p>

        {banner && (
          <p className="mt-4 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {banner}
          </p>
        )}

        {status === "sent" ? (
          <p className="mt-6 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            Check your inbox for a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {message && <p className="text-sm text-red-400">{message}</p>}
          </form>
        )}
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

(`useSearchParams` requires a Suspense boundary in the App Router — hence the wrapper.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add kamee-fitness.webapp/app/admin/login/page.tsx
git commit -m "feat(admin): magic-link login page"
```

---

## Task 9: Admin shell, index redirect, and sign-out

**Files:**
- Create: `app/admin/actions.ts`
- Create: `app/admin/(panel)/layout.tsx`
- Create: `app/admin/(panel)/page.tsx`

- [ ] **Step 1: Create `app/admin/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 2: Create `app/admin/(panel)/layout.tsx`**

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/app/admin/actions";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-dvh bg-[#07090a] text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/admin/exercises" className="font-semibold">
            Kamee Admin
          </Link>
          <Link
            href="/admin/exercises"
            className="text-sm text-zinc-400 hover:text-zinc-100"
          >
            Exercises
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{user.email}</span>
          <form action={signOut}>
            <button className="rounded-md border border-zinc-800 px-2 py-1 hover:border-zinc-600">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/admin/(panel)/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function AdminIndex() {
  redirect("/admin/exercises");
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add kamee-fitness.webapp/app/admin/actions.ts "kamee-fitness.webapp/app/admin/(panel)/layout.tsx" "kamee-fitness.webapp/app/admin/(panel)/page.tsx"
git commit -m "feat(admin): authenticated panel shell, index redirect, sign-out"
```

---

## Task 10: Exercises list — queries, table, and page

**Files:**
- Create: `app/admin/(panel)/exercises/queries.ts`
- Create: `components/admin/ExerciseTable.tsx`
- Create: `app/admin/(panel)/exercises/page.tsx`

- [ ] **Step 1: Create `app/admin/(panel)/exercises/queries.ts`**

```ts
import { createServerSupabase } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/admin/exercises";

export const PAGE_SIZE = 25;

export type ExerciseListResult = {
  rows: Exercise[];
  count: number;
  page: number;
  pageCount: number;
};

export async function listExercises(
  q: string,
  page: number,
): Promise<ExerciseListResult> {
  const supabase = await createServerSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("exercises")
    .select("*", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,slug.ilike.%${q}%,primary_muscle.ilike.%${q}%`,
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    rows: (data ?? []) as Exercise[],
    count: total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Exercise) ?? null;
}

export async function getDistinctMuscles(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .select("primary_muscle");
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.primary_muscle) set.add(row.primary_muscle as string);
  }
  return [...set].sort();
}
```

- [ ] **Step 2: Create `components/admin/ExerciseTable.tsx`**

```tsx
import Link from "next/link";
import type { Exercise } from "@/lib/admin/exercises";

export function ExerciseTable({ rows }: { rows: Exercise[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No exercises found.</p>;
  }
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-zinc-400">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Primary muscle</th>
          <th className="py-2 pr-4 font-medium">Equipment</th>
          <th className="py-2 pr-4 font-medium">Image</th>
          <th className="py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((ex) => (
          <tr key={ex.id} className="border-b border-zinc-900">
            <td className="py-2 pr-4">{ex.name}</td>
            <td className="py-2 pr-4 text-zinc-400">{ex.primary_muscle}</td>
            <td className="py-2 pr-4 text-zinc-400">
              {ex.is_bodyweight ? "Bodyweight" : ex.equipment.join(", ")}
            </td>
            <td className="py-2 pr-4 text-zinc-400">
              {ex.demo_image_path ? "✓" : "—"}
            </td>
            <td className="py-2 text-right">
              <Link
                href={`/admin/exercises/${ex.id}/edit`}
                className="text-emerald-400 hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Create `app/admin/(panel)/exercises/page.tsx`**

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { ExerciseTable } from "@/components/admin/ExerciseTable";
import { listExercises } from "./queries";

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const { rows, count, pageCount } = await listExercises(q.trim(), pageNum);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Exercises <span className="text-zinc-500">({count})</span>
        </h1>
        <Link
          href="/admin/exercises/new"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          New exercise
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, slug, or muscle…"
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
        <button className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm">
          Search
        </button>
      </form>

      <ExerciseTable rows={rows} />

      {pageCount > 1 && (
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          {pageNum > 1 && (
            <Link
              href={`/admin/exercises?q=${encodeURIComponent(q)}&page=${pageNum - 1}`}
              className="hover:text-zinc-100"
            >
              ← Prev
            </Link>
          )}
          <span>
            Page {pageNum} of {pageCount}
          </span>
          {pageNum < pageCount && (
            <Link
              href={`/admin/exercises?q=${encodeURIComponent(q)}&page=${pageNum + 1}`}
              className="hover:text-zinc-100"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "kamee-fitness.webapp/app/admin/(panel)/exercises/queries.ts" "kamee-fitness.webapp/app/admin/(panel)/exercises/page.tsx" kamee-fitness.webapp/components/admin/ExerciseTable.tsx
git commit -m "feat(admin): exercise list with search and pagination"
```

---

## Task 11: Array and image field components

**Files:**
- Create: `components/admin/ArrayField.tsx`
- Create: `components/admin/ImageUploadField.tsx`

- [ ] **Step 1: Create `components/admin/ArrayField.tsx`**

```tsx
"use client";

import { useState } from "react";

/**
 * Chip editor for a string[] field. Serializes to a hidden input named `name`
 * as newline-joined text, which `parseList` (server) splits back into an array.
 */
export function ArrayField({
  name,
  label,
  defaultValue = [],
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string[];
  placeholder?: string;
}) {
  const [items, setItems] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-zinc-300">{label}</label>
      <input type="hidden" name={name} value={items.join("\n")} />
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="text-zinc-400 hover:text-red-400"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-zinc-800 px-3 text-sm"
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/admin/ImageUploadField.tsx`**

```tsx
"use client";

import { useState } from "react";

/**
 * Demo-image picker. Shows the current image (via its public URL) with a
 * "remove" checkbox, and a file input named `image` for a replacement. The
 * server action uploads the file and sets `demo_image_path`.
 */
export function ImageUploadField({
  currentPath,
}: {
  currentPath: string | null;
}) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Stored path is `exercise-demos/<file>`; the bucket is also `exercise-demos`,
  // so the public object URL is /storage/v1/object/public/<stored-path>.
  const currentUrl =
    currentPath && base
      ? `${base}/storage/v1/object/public/${currentPath}`
      : null;
  const [preview, setPreview] = useState<string | null>(currentUrl);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-zinc-300">Demo image</label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Demo preview"
          className="h-32 w-32 rounded-lg border border-zinc-800 object-cover"
        />
      )}
      <input
        type="file"
        name="image"
        accept="image/png,image/jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : currentUrl);
        }}
        className="block text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-zinc-100"
      />
      {currentPath && (
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="remove_image" />
          Remove current image
        </label>
      )}
    </div>
  );
}
```

Note: `NEXT_PUBLIC_SUPABASE_URL` is a public env var, so it is available in this Client Component.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add kamee-fitness.webapp/components/admin/ArrayField.tsx kamee-fitness.webapp/components/admin/ImageUploadField.tsx
git commit -m "feat(admin): array chip field and demo-image upload field"
```

---

## Task 12: Exercise form component

**Files:**
- Create: `components/admin/ExerciseForm.tsx`

- [ ] **Step 1: Create `components/admin/ExerciseForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import type { Exercise, ExerciseFormState } from "@/lib/admin/exercises";
import { ArrayField } from "./ArrayField";
import { ImageUploadField } from "./ImageUploadField";

type Action = (
  state: ExerciseFormState,
  formData: FormData,
) => Promise<ExerciseFormState>;

export function ExerciseForm({
  action,
  exercise,
  muscles,
}: {
  action: Action;
  exercise?: Exercise;
  muscles: string[];
}) {
  const [state, formAction, pending] = useActionState<
    ExerciseFormState,
    FormData
  >(action, {});
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {exercise && <input type="hidden" name="id" value={exercise.id} />}

      <Field label="Name" error={err.name}>
        <input
          name="name"
          defaultValue={exercise?.name ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Slug" error={err.slug} hint="Lowercase, hyphenated. Leave blank to derive from name.">
        <input
          name="slug"
          defaultValue={exercise?.slug ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Primary muscle" error={err.primary_muscle}>
        <input
          name="primary_muscle"
          list="muscle-options"
          defaultValue={exercise?.primary_muscle ?? ""}
          className={inputClass}
        />
        <datalist id="muscle-options">
          {muscles.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>

      {exercise && (
        <p className="text-xs text-zinc-500">
          Bodyweight:{" "}
          <span className="text-zinc-300">
            {exercise.is_bodyweight ? "yes" : "no"}
          </span>{" "}
          (auto — true when equipment is empty)
        </p>
      )}

      <ArrayField
        name="secondary_muscles"
        label="Secondary muscles"
        defaultValue={exercise?.secondary_muscles ?? []}
        placeholder="e.g. glutes"
      />
      <ArrayField
        name="equipment"
        label="Equipment"
        defaultValue={exercise?.equipment ?? []}
        placeholder="e.g. dumbbell (leave empty for bodyweight)"
      />
      <ArrayField
        name="cues"
        label="Cues"
        defaultValue={exercise?.cues ?? []}
        placeholder="e.g. brace your core"
      />
      <ArrayField
        name="common_mistakes"
        label="Common mistakes"
        defaultValue={exercise?.common_mistakes ?? []}
        placeholder="e.g. rounding the back"
      />

      <ImageUploadField currentPath={exercise?.demo_image_path ?? null} />

      <Field label="Demo video path" hint="Optional. Stored as text.">
        <input
          name="demo_video_path"
          defaultValue={exercise?.demo_video_path ?? ""}
          className={inputClass}
        />
      </Field>
      {/* Preserve the existing image path when no new file is chosen. */}
      <input
        type="hidden"
        name="demo_image_path"
        value={exercise?.demo_image_path ?? ""}
      />

      {state.message && <p className="text-sm text-red-400">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : exercise ? "Save changes" : "Create exercise"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-zinc-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add kamee-fitness.webapp/components/admin/ExerciseForm.tsx
git commit -m "feat(admin): shared exercise create/edit form"
```

---

## Task 13: Exercise CRUD Server Actions

**Files:**
- Create: `app/admin/(panel)/exercises/actions.ts`

- [ ] **Step 1: Create `app/admin/(panel)/exercises/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  type ExerciseFormState,
  parseExerciseForm,
  validateExerciseInput,
} from "@/lib/admin/exercises";

const BUCKET = "exercise-demos";

/**
 * Upload a replacement demo image (if provided) or honor a removal request.
 * Returns the value to store in `demo_image_path`:
 *   - `exercise-demos/<slug>.<ext>` after a successful upload
 *   - null if "remove" was checked
 *   - the unchanged `currentPath` otherwise
 * Object key matches the mobile app convention (<slug>.<ext>, prefix added to DB).
 */
async function resolveImagePath(
  admin: ReturnType<typeof createAdminSupabase>,
  formData: FormData,
  slug: string,
  currentPath: string | null,
): Promise<string | null> {
  if (formData.get("remove_image") === "on") return null;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const objectKey = `${slug}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(objectKey, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(error.message);
    return `${BUCKET}/${objectKey}`;
  }
  return currentPath;
}

export async function createExercise(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  const user = await requireAdmin();
  const input = parseExerciseForm(formData);
  const result = validateExerciseInput(input);
  if (!result.ok) return { errors: result.errors };

  const admin = createAdminSupabase();

  let imagePath: string | null;
  try {
    imagePath = await resolveImagePath(admin, formData, input.slug, null);
  } catch {
    return { message: "Image upload failed. Please try again." };
  }

  // `input` is the validated payload (validateExerciseInput returns the same
  // object as `value`), so read its fields directly. `is_bodyweight` is a
  // generated column and is deliberately never written.
  const { error } = await admin.from("exercises").insert({
    name: input.name,
    slug: input.slug,
    primary_muscle: input.primary_muscle,
    secondary_muscles: input.secondary_muscles,
    equipment: input.equipment,
    cues: input.cues,
    common_mistakes: input.common_mistakes,
    demo_image_path: imagePath,
    demo_video_path: input.demo_video_path,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505")
      return { errors: { slug: "That slug already exists." } };
    return { message: "Could not create exercise. Please try again." };
  }

  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}

export async function updateExercise(
  _prev: ExerciseFormState,
  formData: FormData,
): Promise<ExerciseFormState> {
  await requireAdmin();
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { message: "Missing exercise id." };

  const input = parseExerciseForm(formData);
  const result = validateExerciseInput(input);
  if (!result.ok) return { errors: result.errors };

  const admin = createAdminSupabase();

  let imagePath: string | null;
  try {
    imagePath = await resolveImagePath(
      admin,
      formData,
      input.slug,
      input.demo_image_path,
    );
  } catch {
    return { message: "Image upload failed. Please try again." };
  }

  const { error } = await admin
    .from("exercises")
    .update({
      name: input.name,
      slug: input.slug,
      primary_muscle: input.primary_muscle,
      secondary_muscles: input.secondary_muscles,
      equipment: input.equipment,
      cues: input.cues,
      common_mistakes: input.common_mistakes,
      demo_image_path: imagePath,
      demo_video_path: input.demo_video_path,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return { errors: { slug: "That slug already exists." } };
    return { message: "Could not save changes. Please try again." };
  }

  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}

export async function deleteExercise(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const admin = createAdminSupabase();
  // Storage object is intentionally left in place (it may be a shared asset).
  await admin.from("exercises").delete().eq("id", id);

  revalidatePath("/admin/exercises");
  redirect("/admin/exercises");
}
```

Note: each action returns early when validation fails, so the `input` fields read by the insert/update are always the validated payload. The `image` `File` and `remove_image` checkbox are read by `resolveImagePath`; `is_bodyweight`, `id`, and `created_at` are never written (generated/managed columns).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "kamee-fitness.webapp/app/admin/(panel)/exercises/actions.ts"
git commit -m "feat(admin): create, update, delete exercise server actions"
```

---

## Task 14: New and Edit pages

**Files:**
- Create: `app/admin/(panel)/exercises/new/page.tsx`
- Create: `app/admin/(panel)/exercises/[id]/edit/page.tsx`

- [ ] **Step 1: Create `app/admin/(panel)/exercises/new/page.tsx`**

```tsx
import { requireAdmin } from "@/lib/admin/auth";
import { ExerciseForm } from "@/components/admin/ExerciseForm";
import { createExercise } from "../actions";
import { getDistinctMuscles } from "../queries";

export default async function NewExercisePage() {
  await requireAdmin();
  const muscles = await getDistinctMuscles();
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">New exercise</h1>
      <ExerciseForm action={createExercise} muscles={muscles} />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/admin/(panel)/exercises/[id]/edit/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { ExerciseForm } from "@/components/admin/ExerciseForm";
import { deleteExercise, updateExercise } from "../../actions";
import { getDistinctMuscles, getExercise } from "../../queries";

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [exercise, muscles] = await Promise.all([
    getExercise(id),
    getDistinctMuscles(),
  ]);
  if (!exercise) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit: {exercise.name}</h1>
        <form action={deleteExercise}>
          <input type="hidden" name="id" value={exercise.id} />
          <button className="rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40">
            Delete
          </button>
        </form>
      </div>
      <ExerciseForm
        action={updateExercise}
        exercise={exercise}
        muscles={muscles}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "kamee-fitness.webapp/app/admin/(panel)/exercises/new/page.tsx" "kamee-fitness.webapp/app/admin/(panel)/exercises/[id]/edit/page.tsx"
git commit -m "feat(admin): new and edit exercise pages"
```

---

## Task 15: Build, lint, and manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `npm test`
Expected: all allowlist + exercises tests PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `/admin/*` routes and `proxy` compile without errors.

- [ ] **Step 4: Provision the admin account (one-time)**

In the Supabase dashboard for project `kamee_fitness` → Authentication → Users → Add user, create a user with the email in `ADMIN_EMAILS` (or sign in once with `shouldCreateUser` temporarily true). Confirm a matching `profiles` row exists (the `handle_new_user` trigger creates one) so `created_by` FK inserts succeed.

- [ ] **Step 5: Manual QA against `npm run dev`**

Run: `npm run dev`, then verify each:
- Visiting `/admin/exercises` while logged out redirects to `/admin/login`.
- Requesting a magic link for a NON-allowlisted email and following it lands on `/admin/login?error=not-authorized` (allowlist gate works).
- Logging in with the allowlisted email reaches the exercise list.
- Search filters by name/slug/muscle; pagination works past 25 rows.
- **Create**: add a throwaway exercise `qa-test-delete-me` with equipment empty → list shows it as Bodyweight; with an image → list shows ✓ and the image resolves.
- **Edit**: change a cue and equipment; confirm `is_bodyweight` flips correctly after saving.
- **Duplicate slug**: creating a second exercise with an existing slug shows the inline "slug already exists" error (no 500).
- **Image replace**: upload a new image on edit; the public URL reflects the new file.
- **Delete**: delete `qa-test-delete-me`; it disappears from the list.
- Sign out returns to `/admin/login`.

- [ ] **Step 6: Commit any fixes**

If QA surfaced fixes, commit them with descriptive messages. Otherwise this task adds no commit.

---

## Self-review notes (addressed)

- **Spec coverage:** auth+allowlist (Tasks 5/6/8), full CRUD (Tasks 13/14), image upload matching mobile convention (Task 13), read-only `is_bodyweight`/`created_at` (Task 12 display, never written), service-role server-only (Task 4), no schema migration (none present), TDD on pure logic (Tasks 2/3), manual QA checklist (Task 15) — all mapped.
- **Generated column:** `is_bodyweight` is never included in insert/update payloads.
- **Type consistency:** `ExerciseFormState`, `Exercise`, `ExerciseInput`, `createServerSupabase`/`createBrowserSupabase`/`createAdminSupabase`, `requireAdmin`, `parseAllowlist`/`isAllowed`, `slugify`/`parseList`/`parseExerciseForm`/`validateExerciseInput` are named identically wherever referenced.
- **Login-loop guard:** `/admin/login` sits outside the `(panel)` auth layout and is excluded in the proxy.
```