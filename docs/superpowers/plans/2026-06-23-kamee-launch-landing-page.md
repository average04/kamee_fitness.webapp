# Kamee Fitness Launch Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the coming-soon home page (`/`) with a full, on-brand launch landing page (iOS live, Android early access) featuring scroll + pointer parallax.

**Architecture:** Mostly server-rendered page composed of focused section components under `components/landing/`. Pure, testable logic (parallax math, feature/FAQ content, store URLs) lives under `lib/landing/` with vitest tests. Parallax is a hand-rolled `requestAnimationFrame` hook writing CSS custom properties — no new dependencies. Visual components verify via typecheck/lint/build (the repo has no DOM test infra and we add none).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, TypeScript, vitest (node env).

## Global Constraints

- **Read first:** Before writing component code, skim `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` and `14-metadata-and-og-images.md` — this is a modified Next.js 16 (per `AGENTS.md`); heed deprecation notices.
- **No new runtime or test dependencies.** Parallax is hand-rolled. Tests are pure-logic under `lib/landing/` (vitest config only includes `lib/**/*.test.ts`, `environment: "node"`).
- **Reduced motion:** every animation/parallax must be inert under `(prefers-reduced-motion: reduce)`, matching the existing `reveal`/`logo-in`/`ring-in` handling in `app/globals.css`.
- **Palette/type:** reuse existing tokens (ink, leaf, ember, sun, mist, muted; Bricolage display + Hanken body). Add one accent: `--color-teal-500: #3fb6c0` / `--color-teal-600: #0e7c86`.
- **Anti-slop copy:** no "unlock your potential / transform your body / revolutionary", no emoji-bullet spam, no fabricated testimonials or stats. Copy is grounded in real app features only.
- **Store URLs (verbatim):** App Store `https://apps.apple.com/app/kamee-fitness-658c0e/id6772307537`; Google Play (closed testing) `https://play.google.com/apps/testing/com.kamee.fitness`.
- **Contact email (verbatim):** `bayogjayr@gmail.com`.
- **Working dir for all commands:** `kamee-fitness.webapp/` (the nested Next app). Branch: `feat/launch-landing-page`.

---

### Task 1: Parallax math + teal token

**Files:**
- Create: `kamee-fitness.webapp/lib/landing/parallax.ts`
- Test: `kamee-fitness.webapp/lib/landing/parallax.test.ts`
- Modify: `kamee-fitness.webapp/app/globals.css` (add teal tokens)

**Interfaces:**
- Produces: `clamp(value:number,min:number,max:number):number`; `prefersReducedMotion():boolean`; `normalizePointer(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}):{x:number;y:number}`.

- [ ] **Step 1: Write the failing test**

```ts
// kamee-fitness.webapp/lib/landing/parallax.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { clamp, normalizePointer, prefersReducedMotion } from "./parallax";

describe("clamp", () => {
  it("bounds values to the range", () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.25, -1, 1)).toBe(0.25);
  });
});

describe("normalizePointer", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 };
  it("maps the center to (0,0)", () => {
    expect(normalizePointer(100, 50, rect)).toEqual({ x: 0, y: 0 });
  });
  it("maps the top-left corner to (-1,-1)", () => {
    expect(normalizePointer(0, 0, rect)).toEqual({ x: -1, y: -1 });
  });
  it("clamps points outside the element", () => {
    expect(normalizePointer(400, 200, rect)).toEqual({ x: 1, y: 1 });
  });
});

describe("prefersReducedMotion", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  it("returns false when there is no window (SSR)", () => {
    expect(prefersReducedMotion()).toBe(false);
  });
  it("reflects the media query when present", () => {
    (globalThis as { window?: unknown }).window = {
      matchMedia: () => ({ matches: true }),
    };
    expect(prefersReducedMotion()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kamee-fitness.webapp && npx vitest run lib/landing/parallax.test.ts`
Expected: FAIL — cannot find module `./parallax`.

- [ ] **Step 3: Write minimal implementation**

```ts
// kamee-fitness.webapp/lib/landing/parallax.ts

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** True when the user requested reduced motion. SSR-safe (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface PointerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Map a pointer position within `rect` to normalized coords in [-1, 1]. */
export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: PointerRect,
): { x: number; y: number } {
  const x = clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
  const y = clamp(((clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  return { x, y };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd kamee-fitness.webapp && npx vitest run lib/landing/parallax.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the teal token**

In `kamee-fitness.webapp/app/globals.css`, inside the `@theme { ... }` block, after the `--color-sun-500` line, add:

```css
  /* Teal — outdoor / GPS track identity (from the mobile app) */
  --color-teal-600: #0e7c86;
  --color-teal-500: #3fb6c0;
```

- [ ] **Step 6: Commit**

```bash
cd kamee-fitness.webapp && git add lib/landing/parallax.ts lib/landing/parallax.test.ts app/globals.css && git commit -m "feat(landing): parallax math helpers + teal token"
```

---

### Task 2: Landing content + store URLs

**Files:**
- Create: `kamee-fitness.webapp/lib/landing/content.ts`
- Create: `kamee-fitness.webapp/lib/landing/stores.ts`
- Test: `kamee-fitness.webapp/lib/landing/content.test.ts`

**Interfaces:**
- Produces: `FEATURES: Feature[]`, `FAQ: FaqItem[]`, types `Feature` (`{key,title,body,accent:"leaf"|"teal",screenshot?:string}`), `FaqItem` (`{q,a}`). `APP_STORE_URL`, `PLAY_STORE_URL` strings.

- [ ] **Step 1: Write the failing test**

```ts
// kamee-fitness.webapp/lib/landing/content.test.ts
import { describe, expect, it } from "vitest";
import { FAQ, FEATURES } from "./content";
import { APP_STORE_URL, PLAY_STORE_URL } from "./stores";

const PLACEHOLDER = /\b(tbd|todo|lorem|placeholder|xxx)\b/i;

describe("FEATURES", () => {
  it("has the six real features with unique keys", () => {
    expect(FEATURES).toHaveLength(6);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(6);
  });
  it("every feature is fully populated and slop-free", () => {
    for (const f of FEATURES) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.body.length).toBeGreaterThan(20);
      expect(["leaf", "teal"]).toContain(f.accent);
      expect(f.title).not.toMatch(PLACEHOLDER);
      expect(f.body).not.toMatch(PLACEHOLDER);
      if (f.screenshot) expect(f.screenshot.startsWith("/screens/")).toBe(true);
    }
  });
});

describe("FAQ", () => {
  it("has five questions, each a real Q/A", () => {
    expect(FAQ).toHaveLength(5);
    for (const item of FAQ) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(10);
      expect(item.a).not.toMatch(PLACEHOLDER);
    }
  });
});

describe("store URLs", () => {
  it("point at the real listings", () => {
    expect(APP_STORE_URL).toContain("apps.apple.com");
    expect(PLAY_STORE_URL).toContain("play.google.com/apps/testing/com.kamee.fitness");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd kamee-fitness.webapp && npx vitest run lib/landing/content.test.ts`
Expected: FAIL — cannot find module `./content`.

- [ ] **Step 3: Write the store URLs**

```ts
// kamee-fitness.webapp/lib/landing/stores.ts
export const APP_STORE_URL =
  "https://apps.apple.com/app/kamee-fitness-658c0e/id6772307537";

export const PLAY_STORE_URL =
  "https://play.google.com/apps/testing/com.kamee.fitness";
```

- [ ] **Step 4: Write the content data**

```ts
// kamee-fitness.webapp/lib/landing/content.ts

export type FeatureAccent = "leaf" | "teal";

export interface Feature {
  /** Stable key; also the screenshot filename stem (public/screens/<key>.png). */
  key: string;
  title: string;
  body: string;
  accent: FeatureAccent;
  /** Optional screenshot path; when omitted a branded placeholder renders. */
  screenshot?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

// Grounded in the real mobile app. Leave `screenshot` set once the matching
// PNG exists under public/screens/; otherwise a placeholder renders.
export const FEATURES: Feature[] = [
  {
    key: "plans",
    title: "Plans that fit you",
    body: "Answer a few questions and Kamy hand-picks a multi-week plan for your level, goals, and equipment.",
    accent: "leaf",
  },
  {
    key: "sessions",
    title: "Guided sessions",
    body: "Every exercise demoed, set-by-set logging, rest timers, and form notes as you go.",
    accent: "leaf",
  },
  {
    key: "track",
    title: "Track outdoors",
    body: "GPS walks and runs with a live route map, pace, elevation, and heart rate.",
    accent: "teal",
  },
  {
    key: "buddies",
    title: "Track Buddies",
    body: "Connect by QR code and watch friends’ runs move on the map in real time.",
    accent: "teal",
  },
  {
    key: "progress",
    title: "Progress that sticks",
    body: "A calendar heatmap, current and longest streaks, plus volume and distance stats.",
    accent: "leaf",
  },
  {
    key: "kamy",
    title: "Coach Kamy",
    body: "An on-device AI coach you can ask “should I train or rest today?” anytime.",
    accent: "leaf",
  },
];

export const FAQ: FaqItem[] = [
  {
    q: "Is Kamee free?",
    a: "Yes — free to start. Kamee Premium removes ads and adds custom plans plus advanced weekly and monthly stats.",
  },
  {
    q: "How do I send feedback during early access?",
    a: "Email bayogjayr@gmail.com. During early access your reports go straight to the team.",
  },
  {
    q: "When does Android fully launch?",
    a: "Soon. Early access is the final shakeout before the public Play Store release.",
  },
  {
    q: "Will my early-access data carry over?",
    a: "Yes. Your account and progress stay with you through the public release.",
  },
  {
    q: "Is my data private?",
    a: "Yes. See our Privacy Policy for exactly what we store and why.",
  },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd kamee-fitness.webapp && npx vitest run lib/landing/content.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
cd kamee-fitness.webapp && git add lib/landing/content.ts lib/landing/content.test.ts lib/landing/stores.ts && git commit -m "feat(landing): grounded feature + FAQ content and store URLs"
```

---

### Task 3: useParallax hook

**Files:**
- Create: `kamee-fitness.webapp/components/landing/useParallax.ts`

**Interfaces:**
- Consumes: `prefersReducedMotion`, `normalizePointer` from `@/lib/landing/parallax`.
- Produces: `useScrollParallax<T extends HTMLElement>(): RefObject<T|null>` (writes `--scroll-y` px); `usePointerTilt<T extends HTMLElement>(): RefObject<T|null>` (writes `--px`/`--py` in [-1,1]).

- [ ] **Step 1: Write the hook**

```ts
// kamee-fitness.webapp/components/landing/useParallax.ts
"use client";

import { useEffect, useRef } from "react";
import { normalizePointer, prefersReducedMotion } from "@/lib/landing/parallax";

/**
 * Writes the page scroll offset (px) to `--scroll-y` on the ref'd element via a
 * rAF loop so background layers can drift slower than content. Inert under
 * reduced motion.
 */
export function useScrollParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      el.style.setProperty("--scroll-y", String(window.scrollY));
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

/**
 * Tracks the pointer within the ref'd element and writes normalized coords
 * (-1..1) to `--px` / `--py`, easing back to 0 on leave. No-op on touch devices
 * and under reduced motion.
 */
export function usePointerTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      el.style.setProperty("--px", x.toFixed(4));
      el.style.setProperty("--py", y.toFixed(4));
      frame = 0;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      const p = normalizePointer(e.clientX, e.clientY, el.getBoundingClientRect());
      x = p.x;
      y = p.y;
      schedule();
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      schedule();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/useParallax.ts && git commit -m "feat(landing): useScrollParallax + usePointerTilt hooks"
```

---

### Task 4: StoreBadges (extract + reuse)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/StoreBadges.tsx`

**Interfaces:**
- Consumes: `APP_STORE_URL`, `PLAY_STORE_URL` from `@/lib/landing/stores`.
- Produces: `StoreBadge({platform,href?,eyebrow?})` and `StoreBadges({className?})` (renders iOS live + Android early-access).

- [ ] **Step 1: Write the component** (moves the badge out of `app/page.tsx`)

```tsx
// kamee-fitness.webapp/components/landing/StoreBadges.tsx
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";

export function StoreBadge({
  platform,
  href,
  eyebrow,
}: {
  platform: "ios" | "android";
  href?: string;
  eyebrow?: string;
}) {
  const isIos = platform === "ios";
  const live = Boolean(href);
  const storeName = isIos ? "App Store" : "Google Play";

  const className =
    "flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors " +
    (live
      ? "border-leaf-500/40 bg-leaf-500/[0.07] hover:border-leaf-400/60 hover:bg-leaf-500/[0.12]"
      : "border-white/10 bg-white/[0.03] hover:border-leaf-500/30");

  const inner = (
    <>
      <span className="text-leaf-400/90">
        {isIos ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
            <path d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.04-4.32 1.04-.89 0-2.26-1.02-3.72-.99-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.95 1.37 2.08 2.91 3.56 2.85 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.4 3.45-2.78 1.09-1.59 1.54-3.13 1.56-3.21-.03-.01-2.99-1.15-3.02-4.55zM14.13 4.62c.79-.96 1.32-2.29 1.18-3.62-1.14.05-2.52.76-3.33 1.72-.73.85-1.37 2.2-1.2 3.5 1.27.1 2.57-.65 3.35-1.6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
            <path d="M4 3.42v17.16a.6.6 0 0 0 .9.52l14.4-8.58a.6.6 0 0 0 0-1.04L4.9 2.9a.6.6 0 0 0-.9.52z" />
          </svg>
        )}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-400/80">
          {eyebrow ?? (live ? "Download on the" : "Coming soon")}
        </span>
        <span className="font-display text-sm font-semibold text-mist">
          {storeName}
        </span>
      </span>
    </>
  );

  if (live) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={
          eyebrow
            ? `${eyebrow} to Kamee Fitness on ${storeName}`
            : `Download Kamee Fitness on the ${storeName}`
        }
        className={className}
      >
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function StoreBadges({ className }: { className?: string }) {
  return (
    <div className={"flex flex-wrap items-center gap-3 " + (className ?? "")}>
      <StoreBadge platform="ios" href={APP_STORE_URL} />
      <StoreBadge platform="android" href={PLAY_STORE_URL} eyebrow="Early access" />
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/StoreBadges.tsx && git commit -m "feat(landing): extract StoreBadges (iOS live + Android early access)"
```

---

### Task 5: PhoneFrame (screenshot or branded placeholder)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/PhoneFrame.tsx`

**Interfaces:**
- Produces: `PhoneFrame({src?,alt,priority?,className?})`. With `src`, renders a `next/image` filling a 9:19.5 phone frame; without, a branded gradient + logo placeholder.

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/PhoneFrame.tsx
import Image from "next/image";

export default function PhoneFrame({
  src,
  alt,
  priority = false,
  className,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        "relative aspect-[9/19.5] w-full overflow-hidden rounded-[2.2rem] border border-white/12 bg-ink-850 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-black/40 " +
        (className ?? "")
      }
    >
      {/* notch */}
      <div className="absolute left-1/2 top-2.5 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/20" />
      {src ? (
        <Image src={src} alt={alt} fill priority={priority} className="object-cover" sizes="(max-width: 768px) 70vw, 320px" />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_30%,rgba(125,190,141,0.18),transparent_60%)]"
        >
          <Image src="/adaptive-icon.png" alt="" width={64} height={64} className="size-14 opacity-80" />
          <span className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted">
            Screenshot soon
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/PhoneFrame.tsx && git commit -m "feat(landing): PhoneFrame with screenshot/placeholder fallback"
```

---

### Task 6: Atmosphere (extracted + scroll parallax)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/Atmosphere.tsx`

**Interfaces:**
- Consumes: `useScrollParallax` from `./useParallax`.
- Produces: default `Atmosphere()` — a fixed, full-viewport decorative background (glow + concentric rings + grain) that drifts on scroll.

- [ ] **Step 1: Write the component** (adapts the inline `Atmosphere` from `app/page.tsx` to be fixed + scroll-driven)

```tsx
// kamee-fitness.webapp/components/landing/Atmosphere.tsx
"use client";

import { useScrollParallax } from "./useParallax";

/** Fixed, decorative background: glow, concentric shell rings, grain. Drifts on scroll. */
export default function Atmosphere() {
  const ref = useScrollParallax<HTMLDivElement>();
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [--scroll-y:0]"
    >
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ transform: "translate3d(0, calc(var(--scroll-y) * -0.04px), 0)" }}
      >
        <div className="hero-glow [grid-area:1/1] size-[min(130vw,950px)] rounded-full blur-2xl" />
        <div
          className="ring ring-in [grid-area:1/1] size-[min(78vw,360px)]"
          style={{ "--d": "0.3s" } as React.CSSProperties}
        />
        <div
          className="ring ring-in [grid-area:1/1] size-[min(110vw,560px)]"
          style={{ "--d": "0.45s" } as React.CSSProperties}
        />
        <div
          className="ring ring-in [grid-area:1/1] size-[min(150vw,820px)]"
          style={{ "--d": "0.6s" } as React.CSSProperties}
        />
      </div>
      <div className="grain absolute inset-0" />
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Atmosphere.tsx && git commit -m "feat(landing): fixed scroll-parallax Atmosphere"
```

---

### Task 7: Header (sticky, solidifies on scroll)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/Header.tsx`

**Interfaces:**
- Produces: default `Header()` — sticky top bar; transparent over hero, gains ink background + hairline border after scrolling ~24px. Right-side "Get the app" anchor to `#get-the-app`.

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/Header.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Header() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300 " +
        (solid
          ? "border-b border-white/8 bg-ink-950/80 backdrop-blur-md"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2.5">
          <Image src="/adaptive-icon.png" alt="" width={32} height={32} className="size-7" />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-mist">
            Kamee Fitness
          </span>
        </a>
        <a
          href="#get-the-app"
          className="rounded-full border border-leaf-500/40 bg-leaf-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-leaf-300 transition-colors hover:bg-leaf-500/20"
        >
          Get the app
        </a>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Header.tsx && git commit -m "feat(landing): sticky header that solidifies on scroll"
```

---

### Task 8: Hero (pointer tilt + dual CTAs)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/Hero.tsx`

**Interfaces:**
- Consumes: `usePointerTilt` from `./useParallax`; `PhoneFrame`; `StoreBadges`.
- Produces: default `Hero()` — eyebrow status pills, H1 brand line, subhead, `StoreBadges`, and a tilting hero visual (brand-visual back layer + PhoneFrame front layer).

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/Hero.tsx
"use client";

import Image from "next/image";
import { usePointerTilt } from "./useParallax";
import PhoneFrame from "./PhoneFrame";
import { StoreBadges } from "./StoreBadges";

export default function Hero() {
  const tilt = usePointerTilt<HTMLDivElement>();

  return (
    <section id="top" className="relative mx-auto max-w-6xl px-6 pb-20 pt-28 sm:pt-32">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <div className="reveal flex flex-wrap items-center justify-center gap-2.5 lg:justify-start" style={{ "--d": "0.1s" } as React.CSSProperties}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-leaf-300">
              <span className="blink size-1.5 rounded-full bg-leaf-400" /> Now on iOS
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-ember-400">
              <span className="blink size-1.5 rounded-full bg-ember-400" /> Early access on Android
            </span>
          </div>

          <h1 className="reveal mt-7 font-display text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-mist" style={{ "--d": "0.22s" } as React.CSSProperties}>
            Slow and steady <span className="text-leaf-400">wins the race.</span>
          </h1>

          <p className="reveal mx-auto mt-6 max-w-md text-balance text-[clamp(1.05rem,2.6vw,1.3rem)] leading-snug text-mist/85 lg:mx-0" style={{ "--d": "0.34s" } as React.CSSProperties}>
            Personalized plans, guided workouts, GPS tracking, and a coach named
            Kamy — built for steady progress, not burnout.
          </p>

          <div id="get-the-app" className="reveal mt-9 flex flex-wrap justify-center gap-3 scroll-mt-24 lg:justify-start" style={{ "--d": "0.46s" } as React.CSSProperties}>
            <StoreBadges />
          </div>
          <p className="reveal mt-3 text-xs text-muted/70" style={{ "--d": "0.54s" } as React.CSSProperties}>
            Free to start · iPhone &amp; Android
          </p>
        </div>

        {/* Visual */}
        <div ref={tilt} className="logo-in relative mx-auto w-[clamp(220px,60vw,320px)] [perspective:1200px]" style={{ "--d": "0.3s" } as React.CSSProperties}>
          <div
            className="relative"
            style={{
              transform:
                "rotateY(calc(var(--px,0) * 6deg)) rotateX(calc(var(--py,0) * -6deg))",
              transition: "transform 0.2s ease-out",
            }}
          >
            {/* back layer: brand visual (optional) */}
            <div
              className="pointer-events-none absolute -inset-10 -z-10"
              style={{ transform: "translate3d(calc(var(--px,0) * -14px), calc(var(--py,0) * -14px), 0)" }}
            >
              <Image
                src="/brand-visual.png"
                alt=""
                fill
                className="object-contain opacity-70 blur-[1px]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            {/* front layer: phone */}
            <div style={{ transform: "translate3d(calc(var(--px,0) * 10px), calc(var(--py,0) * 10px), 0)" }}>
              <PhoneFrame src={undefined} alt="Kamee Fitness home screen" priority />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

> Note: the brand-visual `<Image fill>` needs the parent to be positioned (it is, `absolute`). When `public/brand-visual.png` is added it appears; until then `onError` hides it. To swap the hero screenshot in later, change `src={undefined}` to `src="/screens/home.png"`.

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Hero.tsx && git commit -m "feat(landing): hero with pointer-tilt visual and dual store CTAs"
```

---

### Task 9: Features ("What's inside")

**Files:**
- Create: `kamee-fitness.webapp/components/landing/Features.tsx`

**Interfaces:**
- Consumes: `FEATURES` from `@/lib/landing/content`; `PhoneFrame`.
- Produces: default `Features()` — section heading + alternating screenshot/text rows for the first four features, then a two-up grid for the rest.

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/Features.tsx
import { FEATURES, type Feature } from "@/lib/landing/content";
import PhoneFrame from "./PhoneFrame";

const ACCENT: Record<Feature["accent"], string> = {
  leaf: "text-leaf-400",
  teal: "text-teal-500",
};

export default function Features() {
  const rows = FEATURES.slice(0, 4);
  const grid = FEATURES.slice(4);

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center font-display text-[clamp(1.8rem,4.5vw,2.75rem)] font-extrabold uppercase tracking-tight text-mist">
        What&rsquo;s inside
      </h2>

      <div className="mt-14 space-y-20">
        {rows.map((f, i) => (
          <div
            key={f.key}
            className={
              "grid items-center gap-8 sm:gap-12 lg:grid-cols-2 " +
              (i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : "")
            }
          >
            <div className="mx-auto w-[clamp(180px,46vw,260px)]">
              <PhoneFrame src={f.screenshot} alt={`Kamee Fitness — ${f.title}`} />
            </div>
            <div className="text-center lg:text-left">
              <h3 className={"font-display text-2xl font-bold " + ACCENT[f.accent]}>
                {f.title}
              </h3>
              <p className="mt-3 max-w-md text-balance text-mist/80 lg:max-w-none">
                {f.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-2">
        {grid.map((f) => (
          <div key={f.key} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <h3 className={"font-display text-xl font-bold " + ACCENT[f.accent]}>
              {f.title}
            </h3>
            <p className="mt-2 text-mist/75">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Features.tsx && git commit -m "feat(landing): What's inside feature sections"
```

---

### Task 10: HowToJoin (Android early access)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/HowToJoin.tsx`

**Interfaces:**
- Consumes: `PLAY_STORE_URL`, `APP_STORE_URL` from `@/lib/landing/stores`.
- Produces: default `HowToJoin()` — three numbered steps + iOS aside + CTA buttons.

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/HowToJoin.tsx
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";

const STEPS = [
  { n: 1, t: "Join on Google Play", d: "Tap the button below and opt in to the early-access test on the web." },
  { n: 2, t: "Install Kamee", d: "Open the Play Store listing and install Kamee like any other app." },
  { n: 3, t: "Start your first plan", d: "Open the app, answer a few questions, and Kamy picks your plan." },
];

export default function HowToJoin() {
  return (
    <section id="join" className="mx-auto max-w-4xl px-6 py-20">
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 sm:p-12">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ember-400">
          Android early access
        </span>
        <h2 className="mt-3 font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold uppercase tracking-tight text-mist">
          Join the Android beta in three steps
        </h2>

        <ol className="mt-8 space-y-6">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-leaf-500/40 bg-leaf-500/10 font-display text-sm font-bold text-leaf-300">
                {s.n}
              </span>
              <div>
                <h3 className="font-display font-semibold text-mist">{s.t}</h3>
                <p className="mt-1 text-sm text-mist/70">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-500"
          >
            Join on Google Play
          </a>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-mist transition-colors hover:border-leaf-500/40"
          >
            On iPhone? Get it on the App Store
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/HowToJoin.tsx && git commit -m "feat(landing): How to join (Android early access) section"
```

---

### Task 11: Faq (accordion)

**Files:**
- Create: `kamee-fitness.webapp/components/landing/Faq.tsx`

**Interfaces:**
- Consumes: `FAQ` from `@/lib/landing/content`.
- Produces: default `Faq()` — keyboard-operable accordion, one panel open at a time, correct `aria-expanded`/`aria-controls`. The privacy answer links to `/privacy`.

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/Faq.tsx
"use client";

import { useState } from "react";
import { FAQ } from "@/lib/landing/content";

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
      <h2 className="text-center font-display text-[clamp(1.8rem,4.5vw,2.75rem)] font-extrabold uppercase tracking-tight text-mist">
        Questions
      </h2>

      <div className="mt-10 divide-y divide-white/8 border-y border-white/8">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-display font-semibold text-mist transition-colors hover:text-leaf-300"
                >
                  {item.q}
                  <span className={"shrink-0 text-leaf-400 transition-transform " + (isOpen ? "rotate-45" : "")} aria-hidden>
                    +
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-trigger-${i}`}
                hidden={!isOpen}
                className="pb-5 text-mist/75"
              >
                {item.q === "Is my data private?" ? (
                  <p>
                    Yes. See our{" "}
                    <a href="/privacy" className="text-leaf-400 underline">
                      Privacy Policy
                    </a>{" "}
                    for exactly what we store and why.
                  </p>
                ) : (
                  <p>{item.a}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Faq.tsx && git commit -m "feat(landing): accessible FAQ accordion"
```

---

### Task 12: Footer

**Files:**
- Create: `kamee-fitness.webapp/components/landing/Footer.tsx`

**Interfaces:**
- Produces: default `Footer()` — final CTA band (brand line + `StoreBadges`) and legal footer (Terms, Privacy, Delete account, contact email, © 2026).

- [ ] **Step 1: Write the component**

```tsx
// kamee-fitness.webapp/components/landing/Footer.tsx
import Image from "next/image";
import { StoreBadges } from "./StoreBadges";

export default function Footer() {
  return (
    <footer className="relative">
      {/* Final CTA band */}
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <Image src="/adaptive-icon.png" alt="" width={56} height={56} className="mx-auto size-12" />
        <p className="mt-6 font-display text-[clamp(1.4rem,3.5vw,2rem)] font-bold text-mist">
          Slow and steady wins the race.
        </p>
        <div className="mt-7 flex justify-center">
          <StoreBadges />
        </div>
      </div>

      {/* Legal */}
      <div className="border-t border-white/8 py-6 text-xs text-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 sm:flex-row">
          <span>© 2026 Kamee Fitness. All rights reserved.</span>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/delete-account" className="hover:text-white">Delete account</a>
            <a href="mailto:bayogjayr@gmail.com" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add components/landing/Footer.tsx && git commit -m "feat(landing): final CTA band + legal footer"
```

---

### Task 13: Compose page.tsx + JSON-LD

**Files:**
- Modify: `kamee-fitness.webapp/app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: every `components/landing/*` default export above; `APP_STORE_URL` from `@/lib/landing/stores`.

- [ ] **Step 1: Rewrite the page**

```tsx
// kamee-fitness.webapp/app/page.tsx
import Atmosphere from "@/components/landing/Atmosphere";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowToJoin from "@/components/landing/HowToJoin";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";
import { APP_STORE_URL } from "@/lib/landing/stores";

const SITE_URL = "https://kamee.fitness";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kamee Fitness",
      url: SITE_URL,
      logo: `${SITE_URL}/adaptive-icon.png`,
      sameAs: [APP_STORE_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Kamee Fitness",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "MobileApplication",
      name: "Kamee Fitness",
      operatingSystem: "iOS, Android",
      applicationCategory: "HealthApplication",
      url: SITE_URL,
      downloadUrl: APP_STORE_URL,
      installUrl: APP_STORE_URL,
      image: `${SITE_URL}/adaptive-icon.png`,
      description:
        "Personal workout and training app built on steady, sustainable progress.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Atmosphere />
      <Header />
      <main className="relative z-10">
        <Hero />
        <Features />
        <HowToJoin />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify build + tests + lint**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit && npx vitest run && npm run build`
Expected: typecheck clean; vitest all pass; build succeeds.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add app/page.tsx && git commit -m "feat(landing): compose launch landing page + JSON-LD"
```

---

### Task 14: layout.tsx metadata for launch

**Files:**
- Modify: `kamee-fitness.webapp/app/layout.tsx` (metadata only)

- [ ] **Step 1: Update the metadata copy and OG image**

In `kamee-fitness.webapp/app/layout.tsx`, replace the three description strings and add an OG image. Set:

- `description` (root): `"Kamee Fitness — personalized plans, guided workouts, GPS tracking, and a coach named Kamy. Free on iOS, now in early access on Android."`
- `openGraph.description`: `"Slow and steady wins the race. Personalized plans, guided workouts, GPS tracking, and Coach Kamy. Free on iOS, early access on Android."`
- `openGraph.images`: keep `/adaptive-icon.png` **and** add `{ url: "/brand-visual.png", width: 1024, height: 1536, alt: "Kamee Fitness", type: "image/png" }` as the first entry (falls back to the icon if the file is absent).
- `twitter.description`: `"Slow and steady wins the race. Free on iOS, early access on Android."`
- Leave the existing `keywords` (already includes "Android fitness app") and `robots` as-is.

- [ ] **Step 2: Verify it typechecks + builds**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd kamee-fitness.webapp && git add app/layout.tsx && git commit -m "feat(seo): launch metadata — iOS live, Android early access"
```

---

### Task 15: Final verification + manual review

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

Run: `cd kamee-fitness.webapp && npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `cd kamee-fitness.webapp && npm run dev`, open `http://localhost:3000`, and confirm:
- Hero shows both status pills, the brand-line H1, both store badges (App Store → App Store URL; Google Play → testing URL, "Early access" eyebrow).
- Pointer over the hero visual tilts it (desktop); scrolling drifts the background glow/rings.
- Features, How-to-join (3 steps), FAQ (accordion toggles, keyboard-operable), and footer (Terms/Privacy/Delete account/Contact) all render.
- Toggle OS "reduce motion": parallax + reveals are inert, layout intact.
- Mobile width (~390px): layout is clean, no horizontal scroll.

- [ ] **Step 3: Note remaining manual asset step**

Real screenshots and the brand visual are user-provided. Once added to `public/screens/*.png` and `public/brand-visual.png`: set `screenshot` paths in `lib/landing/content.ts`, and set the hero `PhoneFrame src` in `Hero.tsx` to `/screens/home.png`. No code structure changes needed.

---

## Self-Review

**Spec coverage:**
- Replace `/`, drop waitlist, downloads lead → Tasks 13, 4, 8. ✓
- Sections (Hero+CTA, What's inside, How to join, FAQ) + header/CTA band/footer → Tasks 8,9,10,11,7,12. ✓
- Parallax both scroll + pointer, reduced-motion aware → Tasks 1,3,6 (scroll on Atmosphere), 8 (pointer on Hero). ✓
- Hero visual: iPhone frame + generated brand visual → Tasks 5, 8 (both layers). ✓
- Real feature copy (grounded) → Task 2. ✓
- Teal accent token → Task 1. ✓
- SEO/metadata launch update + OG + JSON-LD both OSes → Tasks 13, 14. ✓
- Accessibility (aria-hidden atmosphere, alt text, focusable CTAs, FAQ aria) → Tasks 5,6,8,11,12. ✓
- No new deps; tests pure under `lib/` → Tasks 1,2; all others verify via tsc/lint/build. ✓
- Assets optional with placeholders → Tasks 5, 8, 15. ✓

**Placeholder scan:** No "TBD/TODO/implement later" in any step. The visual "Screenshot soon" string is intentional UI copy for the placeholder state, not a plan placeholder.

**Type consistency:** `clamp`/`normalizePointer`/`prefersReducedMotion` (Task 1) consumed by `useParallax` (Task 3) with matching signatures. `Feature`/`FaqItem`/`FEATURES`/`FAQ` (Task 2) consumed by Features (9)/Faq (11). `StoreBadge`/`StoreBadges` (Task 4) consumed by Hero (8)/Footer (12). `useScrollParallax`/`usePointerTilt` (Task 3) consumed by Atmosphere (6)/Hero (8). `APP_STORE_URL`/`PLAY_STORE_URL` (Task 2) consumed by Tasks 4,8,10,13. All consistent.
