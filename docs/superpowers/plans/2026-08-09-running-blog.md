# Running Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/blog` section on kamee.fit containing a pillar overview plus 15 individual guides — one per type of running workout — each explaining what the run is, why it works, and how to pace it.

**Architecture:** Post prose lives in `content/blog/*.mdx`. Post *metadata* lives in a typed TypeScript registry (`lib/blog/posts.ts`), because `next.config.ts` runs MDX with no remark plugins, so frontmatter is never parsed. A separate `lib/blog/bodies.ts` holds the static MDX imports keyed by slug, keeping 16 MDX bundles out of the hub/sitemap import graph. One dynamic `app/blog/[slug]` route renders all 16 via `generateStaticParams`.

**Tech Stack:** Next.js 16.2.6 (App Router, Turbopack), React 19.2, `@next/mdx` 3.1, Tailwind CSS v4, `next/og` for OG images, Vitest 4.1.

## Global Constraints

- **Working directory is `kamee-fitness.webapp/`** (the Next app is nested one level below the repo root). All paths in this plan are relative to it.
- **No MDX frontmatter.** `next.config.ts` builds MDX with `createMDX({ options: {} })` — Turbopack does not run remark/rehype plugins. Any `---` block at the top of an `.mdx` file renders as literal text. All metadata goes in `lib/blog/posts.ts`.
- **MDX bodies start at `##`.** The `<h1>` comes from `PostLayout`; a `#` in a body produces a second H1. Enforced by test.
- **Metadata objects must be restated in full.** Next merges metadata shallowly per key — a partial `openGraph` drops the root layout's fields. Same trap documented at `app/plans/[id]/page.tsx:64-66`.
- **Reuse `SITE_URL`** from `lib/public-plans.ts` (`"https://kamee.fit"`). Do not redeclare it. Import it **relatively** (`../public-plans`), not via `@/` — `lib/blog/posts.ts` is imported by a vitest test, and vitest has no path alias configured, so a `@/` import there would fail to resolve under test. `@/` is fine everywhere else (route and component files aren't under test).
- **App-feature claims must be true today.** The "Track it in Kamee" section may reference only: GPS track sessions, live pace, auto-pause, splits, and plans. It must **not** mention voice lap times (not shipped).
- **Design tokens:** `bg-ink-950`, `text-ink-100/200/300/400`, `text-leaf-300/400`, `border-white/10`, `font-display` for headings. Defined in `app/globals.css`.
- **Vitest only picks up `lib/**/*.test.ts`** (see `vitest.config.ts`) and has **no path alias configured** — test files must use relative imports (`./posts`), not `@/lib/...`.
- **Publish date for every post in this batch:** `2026-08-09`.
- **Commit style:** conventional commits, present tense, e.g. `feat(blog): add the post registry`.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/blog/posts.ts` | Slug union, `RunPost` type, the 16-entry registry, lookup helpers. Pure data — no React, no MDX. |
| `lib/blog/posts.test.ts` | Registry invariants + on-disk MDX content rules. |
| `lib/blog/bodies.ts` | `Record<PostSlug, ComponentType>` of static MDX imports. The only module that imports `.mdx`. |
| `content/blog/*.mdx` | 16 prose bodies. |
| `components/blog/PostLayout.tsx` | Article shell: header, body slot, CTA, prev/next, disclaimer, JSON-LD. |
| `components/blog/PostCard.tsx` | Hub listing card. |
| `app/blog/page.tsx` | Hub: featured pillar + 15 grouped guide cards. |
| `app/blog/[slug]/page.tsx` | Post route: `generateStaticParams`, `generateMetadata`, render. |
| `app/blog/[slug]/opengraph-image.tsx` | Per-post branded OG card. |
| `app/sitemap.ts` | *(modify)* add `/blog` + 16 post URLs. |
| `components/landing/Footer.tsx` | *(modify)* add "Blog" nav link. |

---

## Task 1: Post registry and its tests

**Files:**
- Create: `lib/blog/posts.ts`
- Test: `lib/blog/posts.test.ts`

**Interfaces:**
- Consumes: `SITE_URL` from `lib/public-plans.ts`.
- Produces: `POST_SLUGS: readonly PostSlug[]`, `type PostSlug`, `type RunPost`, `POSTS: RunPost[]`, `getPost(slug: string): RunPost | undefined`, `getGuides(): RunPost[]`, `getPillar(): RunPost`, `getAdjacent(slug: PostSlug): { prev: RunPost | null; next: RunPost | null }`, `postUrl(slug: PostSlug): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/blog/posts.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAdjacent,
  getGuides,
  getPillar,
  getPost,
  POSTS,
  POST_SLUGS,
  postUrl,
} from "./posts";

const PLACEHOLDER = /\b(tbd|todo|lorem|placeholder|xxx)\b/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/** MDX files currently on disk. Empty before the content tasks land. */
function mdxFiles(): string[] {
  try {
    return readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

function wordCount(src: string): number {
  return src
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_>|`]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

describe("POST_SLUGS", () => {
  it("has 16 unique kebab-case slugs", () => {
    expect(POST_SLUGS).toHaveLength(16);
    expect(new Set(POST_SLUGS).size).toBe(16);
    for (const slug of POST_SLUGS) expect(slug).toMatch(SLUG_RE);
  });

  it("matches the registry one-for-one", () => {
    expect(POSTS.map((p) => p.slug)).toEqual([...POST_SLUGS]);
  });
});

describe("POSTS", () => {
  it("has exactly one pillar and fifteen guides", () => {
    expect(POSTS.filter((p) => p.kind === "pillar")).toHaveLength(1);
    expect(getGuides()).toHaveLength(15);
    expect(getPillar().kind).toBe("pillar");
  });

  it("every entry is fully populated and slop-free", () => {
    for (const p of POSTS) {
      expect(p.title.length).toBeGreaterThan(10);
      expect(p.description.length).toBeGreaterThanOrEqual(50);
      expect(p.description.length).toBeLessThanOrEqual(160);
      expect(p.excerpt.length).toBeGreaterThan(40);
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.readingMinutes).toBeGreaterThan(0);
      expect(p.readingMinutes).toBeLessThanOrEqual(15);
      for (const field of [p.title, p.description, p.excerpt, p.purpose]) {
        expect(field).not.toMatch(PLACEHOLDER);
      }
    }
  });

  it("every guide is grouped and effort-rated", () => {
    for (const g of getGuides()) {
      expect(["Foundation", "Speed", "Strength", "Race"]).toContain(g.group);
      expect(["Easy", "Moderate", "Hard"]).toContain(g.effort);
    }
  });

  it("publishes with valid, non-future dates", () => {
    // A date string parses as UTC midnight, so a run from a UTC+N timezone
    // early on the publish date would otherwise read as "future". One day of
    // slack absorbs that without weakening the check meaningfully.
    const DAY_MS = 24 * 60 * 60 * 1000;
    for (const p of POSTS) {
      const published = new Date(p.published);
      expect(Number.isNaN(published.getTime())).toBe(false);
      expect(published.getTime()).toBeLessThanOrEqual(Date.now() + DAY_MS);
    }
  });
});

describe("helpers", () => {
  it("looks posts up by slug and rejects unknown ones", () => {
    expect(getPost("tempo-run")?.title).toContain("Tempo");
    expect(getPost("not-a-real-run")).toBeUndefined();
  });

  it("walks prev/next across guides only, with open ends", () => {
    const guides = getGuides();
    expect(getAdjacent(guides[0].slug).prev).toBeNull();
    expect(getAdjacent(guides[0].slug).next?.slug).toBe(guides[1].slug);
    expect(getAdjacent(guides[guides.length - 1].slug).next).toBeNull();
    const pillar = getAdjacent(getPillar().slug);
    expect(pillar.prev).toBeNull();
    expect(pillar.next).toBeNull();
  });

  it("builds absolute post URLs", () => {
    expect(postUrl("tempo-run")).toBe("https://kamee.fit/blog/tempo-run");
  });
});

describe("content/blog MDX files", () => {
  it("every file on disk has a registry entry", () => {
    for (const file of mdxFiles()) {
      const slug = file.replace(/\.mdx$/, "");
      expect(POST_SLUGS).toContain(slug);
    }
  });

  it("no file declares a top-level H1", () => {
    for (const file of mdxFiles()) {
      const src = readFileSync(path.join(BLOG_DIR, file), "utf8");
      const offenders = src
        .split("\n")
        .filter((line) => /^#\s/.test(line));
      expect({ file, offenders }).toEqual({ file, offenders: [] });
    }
  });

  it("no file carries unparsed frontmatter", () => {
    for (const file of mdxFiles()) {
      const src = readFileSync(path.join(BLOG_DIR, file), "utf8");
      expect(src.startsWith("---")).toBe(false);
    }
  });

  it("every file lands in its word-count band", () => {
    for (const file of mdxFiles()) {
      const slug = file.replace(/\.mdx$/, "");
      const words = wordCount(readFileSync(path.join(BLOG_DIR, file), "utf8"));
      const min = 600;
      const max = slug === "types-of-running-workouts" ? 1800 : 1100;
      expect({ slug, ok: words >= min && words <= max, words }).toEqual({
        slug,
        ok: true,
        words,
      });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/blog/posts.test.ts`
Expected: FAIL — `Failed to resolve import "./posts"`.

- [ ] **Step 3: Write the registry**

Create `lib/blog/posts.ts`:

```ts
/**
 * Blog post registry. Metadata lives here rather than in MDX frontmatter
 * because next.config.ts builds MDX with no remark plugins (Turbopack doesn't
 * run them), so a frontmatter block would render as literal text.
 *
 * POST_SLUGS is a const tuple so PostSlug is a literal union — that makes
 * lib/blog/bodies.ts exhaustive at compile time.
 */
// Relative, not "@/lib/public-plans": this module is imported by a vitest test
// and vitest.config.ts configures no path alias.
import { SITE_URL } from "../public-plans";

export const POST_SLUGS = [
  "types-of-running-workouts",
  "easy-run",
  "base-run",
  "long-run",
  "recovery-run",
  "progression-run",
  "tempo-run",
  "interval-run",
  "vo2-max-intervals",
  "fartlek-run",
  "strides",
  "hill-repeats",
  "trail-run",
  "race-pace-run",
  "time-trial",
  "shakeout-run",
] as const;

export type PostSlug = (typeof POST_SLUGS)[number];

export type PostGroup = "Foundation" | "Speed" | "Strength" | "Race";

export const POST_GROUPS: readonly PostGroup[] = [
  "Foundation",
  "Speed",
  "Strength",
  "Race",
];

export const GROUP_BLURBS: Record<PostGroup, string> = {
  Foundation: "The aerobic base. Most of your weekly running lives here.",
  Speed: "Faster than comfortable, on purpose. One or two of these a week.",
  Strength: "Terrain does the work — power and stability without the track.",
  Race: "Sharpening, rehearsing, and testing what you've built.",
};

export type RunPost = {
  slug: PostSlug;
  kind: "pillar" | "guide";
  title: string;
  /** Meta description. Kept to 50–160 chars — enforced by test. */
  description: string;
  /** Hub card blurb. */
  excerpt: string;
  /** Omitted on the pillar, which describes no single workout. */
  group?: PostGroup;
  effort?: "Easy" | "Moderate" | "Hard";
  /** One line: what this run builds. */
  purpose: string;
  /** Hand-authored — there's no build-time MDX parsing to compute it from. */
  readingMinutes: number;
  published: string;
  updated?: string;
};

const PUBLISHED = "2026-08-09";

export const POSTS: RunPost[] = [
  {
    slug: "types-of-running-workouts",
    kind: "pillar",
    title: "The 15 Types of Running Workouts, Explained",
    description:
      "Easy, tempo, interval, long, fartlek, hills and more — what every type of run does for you, how hard each should feel, and how to fit them into a week.",
    excerpt:
      "One map of every run in this guide: what each does, how hard it should feel, and how to build a week out of them.",
    purpose: "Understand how all the run types fit together",
    readingMinutes: 8,
    published: PUBLISHED,
  },
  {
    slug: "easy-run",
    kind: "guide",
    title: "The Easy Run: Why Slowing Down Makes You Faster",
    description:
      "An easy run is a conversational-pace run that builds your aerobic base. How to pace one, how long it should be, and why most runners do them too fast.",
    excerpt:
      "The run you'll do most often, and the one most runners get wrong by pushing too hard.",
    group: "Foundation",
    effort: "Easy",
    purpose: "Builds aerobic base with minimal fatigue cost",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "base-run",
    kind: "guide",
    title: "The Base Run: Your Everyday Training Mile",
    description:
      "A base run is the standard moderate-distance run that makes up the bulk of a training week. How it differs from an easy run, and how to pace it.",
    excerpt:
      "Not your slowest run, not a workout — the steady middle that most weekly mileage is made of.",
    group: "Foundation",
    effort: "Easy",
    purpose: "Accumulates aerobic volume at a natural pace",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "long-run",
    kind: "guide",
    title: "The Long Run: Building Endurance That Lasts",
    description:
      "The long run is the single most important session for endurance. How far to go, how fast, when to fuel, and how to add distance without getting hurt.",
    excerpt:
      "The week's cornerstone session — and the one that rewards patience more than any other.",
    group: "Foundation",
    effort: "Moderate",
    purpose: "Builds endurance, fat metabolism, and durability",
    readingMinutes: 5,
    published: PUBLISHED,
  },
  {
    slug: "recovery-run",
    kind: "guide",
    title: "The Recovery Run: Running to Recover, Not to Train",
    description:
      "A recovery run is a short, very slow run the day after hard training. What it's for, how slow is slow enough, and when to just take the rest day instead.",
    excerpt:
      "Deliberately too easy to be training. That's the entire point of it.",
    group: "Foundation",
    effort: "Easy",
    purpose: "Promotes blood flow and recovery after hard days",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "progression-run",
    kind: "guide",
    title: "The Progression Run: Start Easy, Finish Strong",
    description:
      "A progression run starts easy and gets faster to the finish. How to structure the thirds, what it teaches about pacing, and why it beats going out hard.",
    excerpt:
      "One run that trains both aerobic volume and pacing discipline, by finishing faster than it started.",
    group: "Foundation",
    effort: "Moderate",
    purpose: "Teaches negative splits and finishing on tired legs",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "tempo-run",
    kind: "guide",
    title: "The Tempo Run: Training at Your Lactate Threshold",
    description:
      "A tempo run is a sustained comfortably-hard effort at lactate threshold. How to find the right pace by feel, plus two sessions worth building a week around.",
    excerpt:
      "Comfortably hard, held for 20 to 40 minutes. The classic session for raising your sustainable pace.",
    group: "Speed",
    effort: "Hard",
    purpose: "Raises the pace you can hold before fatigue takes over",
    readingMinutes: 5,
    published: PUBLISHED,
  },
  {
    slug: "interval-run",
    kind: "guide",
    title: "Interval Runs: Hard Reps With Recovery Between",
    description:
      "Interval training alternates hard efforts with recovery jogs. How to pick rep length, pace and rest, plus a first interval session that won't wreck you.",
    excerpt:
      "Repeat hard, recover, repeat again. The most direct way to get genuinely faster.",
    group: "Speed",
    effort: "Hard",
    purpose: "Builds speed, VO2 max, and running economy",
    readingMinutes: 5,
    published: PUBLISHED,
  },
  {
    slug: "vo2-max-intervals",
    kind: "guide",
    title: "VO2 Max Intervals: Training Your Aerobic Ceiling",
    description:
      "VO2 max intervals are three-to-five-minute reps at near-maximum aerobic effort. What makes them different from ordinary intervals, and how often to run them.",
    excerpt:
      "Longer and harder than standard reps, aimed squarely at the top of your aerobic range.",
    group: "Speed",
    effort: "Hard",
    purpose: "Raises maximum oxygen uptake",
    readingMinutes: 5,
    published: PUBLISHED,
  },
  {
    slug: "fartlek-run",
    kind: "guide",
    title: "Fartlek: Speed Play Without the Stopwatch",
    description:
      "Fartlek is unstructured speed work run by feel instead of by the clock. Where it came from, how to run one, and why it's the friendliest intro to fast running.",
    excerpt:
      "Swedish for speed play — surges by feel and landmark, no track and no lap splits required.",
    group: "Speed",
    effort: "Moderate",
    purpose: "Introduces speed without rigid structure",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "strides",
    kind: "guide",
    title: "Strides: Short Accelerations That Sharpen Your Form",
    description:
      "Strides are 20-second controlled accelerations run after easy runs. What they do for your form and turnover, and how to add them without adding fatigue.",
    excerpt:
      "Twenty seconds, near-full speed, fully recovered. Not a workout — a tune-up.",
    group: "Speed",
    effort: "Moderate",
    purpose: "Improves turnover, form, and neuromuscular sharpness",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "hill-repeats",
    kind: "guide",
    title: "Hill Repeats: Strength Training That Counts as Running",
    description:
      "Hill repeats are hard uphill efforts with a jog-down recovery. Why they build power with less impact than flat speedwork, and how to run them with good form.",
    excerpt:
      "Gravity does the resistance work. Power and economy, with less pounding than flat intervals.",
    group: "Strength",
    effort: "Hard",
    purpose: "Builds power, economy, and tendon strength",
    readingMinutes: 5,
    published: PUBLISHED,
  },
  {
    slug: "trail-run",
    kind: "guide",
    title: "Trail Running: Why Pace Stops Meaning Anything Off-Road",
    description:
      "Trail running trades pace for terrain. How to judge effort when your splits go out the window, what it builds, and how to descend without wrecking your quads.",
    excerpt:
      "Uneven ground, real climbing, and a pace number that stops telling you anything useful.",
    group: "Strength",
    effort: "Moderate",
    purpose: "Builds stability, ankle strength, and terrain skill",
    readingMinutes: 5,
    published: PUBLISHED,
  },
  {
    slug: "race-pace-run",
    kind: "guide",
    title: "Race-Pace Runs: Rehearsing the Day Itself",
    description:
      "A race-pace run practices your goal pace before race day. How much of a run to spend at pace, and how it rehearses fueling and kit as well as effort.",
    excerpt:
      "A dress rehearsal for goal pace — legs, fueling and kit, at the effort you're actually planning to hold.",
    group: "Race",
    effort: "Hard",
    purpose: "Rehearses goal pace, fueling, and pacing feel",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "time-trial",
    kind: "guide",
    title: "The Time Trial: Testing Fitness Without a Race",
    description:
      "A time trial is a solo all-out effort over a set distance, used to measure fitness and set training paces. How often to run one, and how to pace it properly.",
    excerpt:
      "A solo, all-out benchmark. Run one every couple of months to keep your training paces honest.",
    group: "Race",
    effort: "Hard",
    purpose: "Measures current fitness and sets training paces",
    readingMinutes: 4,
    published: PUBLISHED,
  },
  {
    slug: "shakeout-run",
    kind: "guide",
    title: "The Shakeout Run: The Easiest Run of Your Week",
    description:
      "A shakeout run is a very short, very easy run before or after a race. What it does for stiff legs and race nerves, and how to keep it genuinely easy.",
    excerpt:
      "Fifteen slow minutes the day before a race. It does more for your head than your legs.",
    group: "Race",
    effort: "Easy",
    purpose: "Loosens the legs and settles nerves around race day",
    readingMinutes: 3,
    published: PUBLISHED,
  },
];

const BY_SLUG = new Map(POSTS.map((p) => [p.slug as string, p]));

export function getPost(slug: string): RunPost | undefined {
  return BY_SLUG.get(slug);
}

export function getGuides(): RunPost[] {
  return POSTS.filter((p) => p.kind === "guide");
}

export function getPillar(): RunPost {
  const pillar = POSTS.find((p) => p.kind === "pillar");
  if (!pillar) throw new Error("blog registry has no pillar post");
  return pillar;
}

export function getGuidesByGroup(group: PostGroup): RunPost[] {
  return getGuides().filter((p) => p.group === group);
}

/** Prev/next walk the guides in registry order; the pillar sits outside it. */
export function getAdjacent(slug: PostSlug): {
  prev: RunPost | null;
  next: RunPost | null;
} {
  const guides = getGuides();
  const i = guides.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return { prev: guides[i - 1] ?? null, next: guides[i + 1] ?? null };
}

export function postUrl(slug: PostSlug): string {
  return `${SITE_URL}/blog/${slug}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/blog/posts.test.ts`
Expected: PASS — all suites green. The four `content/blog MDX files` tests pass vacuously since no files exist yet.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/blog/posts.ts lib/blog/posts.test.ts
git commit -m "feat(blog): add the typed post registry"
```

---

## Task 2: Foundation guides (5 MDX bodies)

**Files:**
- Create: `content/blog/easy-run.mdx`, `base-run.mdx`, `long-run.mdx`, `recovery-run.mdx`, `progression-run.mdx`

**Interfaces:**
- Consumes: slugs and titles from Task 1's registry — each filename must equal a `POST_SLUGS` entry.
- Produces: MDX bodies rendered later by Task 6's `BODIES` map.

**Body format — every guide follows this seven-section skeleton, `##` headings only:**

1. `## What it is` — 2–3 sentences.
2. `## Why it works` — the physiological payoff, jargon defined on first use.
3. `## How to pace it` — talk test, RPE out of 10, and a %max-HR range.
4. `## A sample session` — one concrete workout.
5. `## Where it fits in your week` — frequency and placement around hard days.
6. `## Common mistakes` — exactly three bullets.
7. `## Track it in Kamee` — 1–2 sentences. Shipped features only (GPS track sessions, live pace, auto-pause, splits, plans). **Never** voice lap times.

Target 700–900 words; the test band is 600–1100.

- [ ] **Step 1: Write `content/blog/easy-run.mdx` in full — this is the exemplar the other 14 follow**

This file establishes voice (second person, plain language, no hype), section order, and depth. Write it completely before the others.

```mdx
## What it is

An easy run is a run held at a pace where you could hold a full conversation
the whole way — not gasping between words, not choosing shorter sentences.
It is the most common run in almost every training plan, and for most runners
it should make up something like three quarters of the miles they cover in a
week.

The catch is that "easy" is an effort, not a pace. On a hot day, on tired
legs, or on a hilly route, the same effort will produce a slower number on
your watch. That is the system working, not failing.

## Why it works

Easy running builds the machinery that everything else depends on. At low
intensity your body responds by growing more capillaries around the working
muscles, building more mitochondria inside the muscle cells, and strengthening
the heart's ability to move blood with each beat. Those adaptations are what
let you hold a faster pace later without drowning in fatigue.

It also builds them cheaply. Hard sessions produce fitness *and* a large
recovery debt. Easy running produces a smaller stimulus with almost no debt,
which is why you can do so much of it. Volume, not intensity, is what most
runners are actually short of.

## How to pace it

Three checks, in order of how much you should trust them:

- **The talk test.** You can speak in complete sentences without pausing for
  breath. If you're clipping sentences short, you're running too hard.
- **Effort.** Around 3–4 out of 10. It should feel like you're holding
  yourself back slightly.
- **Heart rate.** Roughly 60–75% of your maximum, if you know it and trust
  the reading.

If those three disagree, believe the talk test. It needs no equipment and it
adjusts itself for heat, sleep, and fatigue automatically.

## A sample session

**30–45 minutes at conversational pace.** No structure, no target split, no
finishing sprint. Start slower than feels natural for the first five minutes —
that's the part most people rush.

If you're new to running, the same session works with walk breaks folded in:
run four minutes, walk one, repeat. The effort target is unchanged.

## Where it fits in your week

Easy runs are the default. Any day that isn't a workout, a long run, or a
rest day is an easy run. In a five-day week that usually means three of the
five.

They're also the correct choice on days when you'd planned something harder
and your body clearly disagrees. Downgrading a workout to an easy run is a
much better decision than forcing a bad workout.

## Common mistakes

- **Running them too hard.** By far the most common error. Moderately-hard
  running every day gives you the fatigue of hard training and the adaptations
  of neither easy nor hard training.
- **Judging them by pace.** Your easy pace on a cold, rested morning and your
  easy pace in August heat can differ by a minute per mile. Both are correct.
- **Skipping them for "junk miles".** Easy volume is not junk. It's the
  foundation the hard sessions are built on.

## Track it in Kamee

Start a GPS track session and keep an eye on live pace — but treat it as
information, not a target. Afterwards your splits will show whether you drifted
faster as the run went on, which is the usual sign that "easy" quietly became
"moderate".
```

- [ ] **Step 2: Run the content tests against the exemplar**

Run: `npm run test -- lib/blog/posts.test.ts`
Expected: PASS. Confirms the file is registered, has no H1, no frontmatter, and lands in the word band. If the word count test fails, expand or trim §2 and §5 — do not touch the test.

- [ ] **Step 3: Write the remaining four Foundation bodies**

Same skeleton, same voice. Fact sheets — use these numbers, don't invent others:

**`base-run.mdx`** — Standard 40–60 min run at a natural moderate pace. Effort 4–5/10; 65–75% max HR; conversation possible but you'd rather not give a speech. Builds the same aerobic adaptations as easy running, with slightly more stimulus per mile. *Differentiator paragraph (required):* an easy run is deliberately held back; a base run is simply your natural steady pace, a notch above. Cross-link `/blog/easy-run`. Sample: 45 min steady on rolling terrain. Mistakes: letting every base run creep toward tempo; adding volume and intensity in the same week; using it as a make-up session for a missed workout.

**`long-run.mdx`** — 90 min to 2.5 h; roughly 20–30% of weekly volume. Effort 4–5/10; 60–75% max HR. Builds glycogen storage, teaches the body to burn fat at a higher fraction of effort, strengthens tendons and connective tissue, and builds mental durability. Sample: 90 min steady, last 15 min slightly quicker. Fuel above 90 min: 30–60 g carbohydrate per hour, starting before you feel empty. Mistakes: running it too fast; adding more than ~10% distance week over week; going unfuelled past 90 minutes.

**`recovery-run.mdx`** — 20–40 min, slower than an easy run. Effort 2–3/10; below 65% max HR. Purpose is circulation and movement, not fitness — there is no adaptation target. Sample: 25 min, flat route, no watch glances. *Required framing:* if you're too tired for it to be genuinely easy, take the rest day instead; a rest day is a legitimate choice, not a failure. Mistakes: letting it drift up to easy-run effort; running it on a hilly route; doing one when a rest day was the honest answer.

**`progression-run.mdx`** — Starts easy, finishes fast. Classic structure is thirds: e.g. 60 min as 20 easy / 20 moderate / 20 at threshold effort. Effort climbs 3 → 5 → 7 out of 10. Teaches negative splitting and pacing discipline, and puts quality work on already-tired legs at a lower total cost than a full workout. Sample: 45 min as 15/15/15. Mistakes: starting the first third too fast, which leaves nothing to progress into; turning the last third into an all-out effort; running one the day before a hard session.

- [ ] **Step 4: Run the full test suite and lint**

Run: `npm run test && npm run lint`
Expected: PASS — five files, all in band, no H1s, no frontmatter.

- [ ] **Step 5: Commit**

```bash
git add content/blog
git commit -m "feat(blog): add the five Foundation run guides"
```

---

## Task 3: Speed guides (5 MDX bodies)

**Files:**
- Create: `content/blog/tempo-run.mdx`, `interval-run.mdx`, `vo2-max-intervals.mdx`, `fartlek-run.mdx`, `strides.mdx`

**Interfaces:**
- Consumes: the seven-section skeleton and voice fixed by `content/blog/easy-run.mdx` (Task 2, Step 1). Re-read that file before writing.
- Produces: five more entries in the `BODIES` map built in Task 6.

- [ ] **Step 1: Write the five bodies**

Fact sheets — use these numbers:

**`tempo-run.mdx`** — Sustained effort at lactate threshold: the intensity above which lactate accumulates faster than you clear it. Effort 6–7/10; 80–90% max HR; roughly the pace you could race for an hour; you can speak a short phrase, not a sentence. Raises the pace you can sustain before fatigue compounds. Sample A: 15 min easy warm-up, 20 min continuous tempo, 10 min cool-down. Sample B (cruise intervals, easier to hold honestly): 3 × 10 min at tempo with 2 min jog between. Mistakes: running it at 5k effort, which turns a tempo into a mediocre interval session; jumping straight to 40 minutes; skipping the warm-up.

**`interval-run.mdx`** — Repeated hard efforts separated by recovery jogs. Reps typically 400 m–1600 m at around 5k effort. Effort 8–9/10; 90–100% max HR at the end of each rep. Recovery is a jog, not a stand — usually roughly half the rep duration up to equal to it. Builds speed, VO2 max, and running economy. Sample: 15 min warm-up, 6 × 800 m at 5k effort with 400 m jog recovery, 10 min cool-down. First session: cut it to 4 × 800 m. Mistakes: running the first rep far faster than the last (the set should be even); cutting recovery short to "make it harder"; doing intervals more than twice a week.

**`vo2-max-intervals.mdx`** — Longer, harder reps aimed at maximum oxygen uptake — the ceiling on how much oxygen you can use per minute. Reps of 3–5 min at roughly 3k–5k effort, 95–100% max HR, work-to-rest close to 1:1. The duration matters: it takes 60–90 seconds to reach max oxygen uptake, so short reps never get there. *Differentiator paragraph (required):* ordinary intervals are a broad category; these are a specific dose. Cross-link `/blog/interval-run`. Sample: 15 min warm-up, 5 × 3 min hard with 3 min jog, 10 min cool-down. Mistakes: running them at mile effort and fading; too-short recovery; running them year-round instead of in a block.

**`fartlek-run.mdx`** — Swedish for "speed play". Unstructured surges inside an otherwise easy run, judged by feel or landmarks rather than a stopwatch. Effort alternates roughly 3/10 and 7–8/10. Delivers much of an interval session's benefit without a track, exact splits, or the psychological weight of a workout — which makes it the friendliest first step into fast running. Sample: 40 min easy with 8 × 1 min surges, easy running between, surges started at lamp posts or corners rather than on the watch. Mistakes: turning every surge into a sprint so the last ones collapse; never actually returning to easy between surges; over-structuring it until it's just an interval session with extra steps.

**`strides.mdx`** — 15–30 second controlled accelerations, building to near-full speed and easing off, with full recovery (60–90 s walk or jog) between. 4–8 reps. Not a workout: the total hard running is under three minutes and there should be no meaningful fatigue afterwards. Improves turnover, running form, and neuromuscular recruitment, and wakes the legs up before a race. Sample: after an easy run, 6 × 20 s accelerations on flat ground with 90 s walk-back recovery. Mistakes: treating them as sprints from a standing start; skipping the recovery; doing them when already sore, where they add risk and no benefit.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- lib/blog/posts.test.ts`
Expected: PASS — ten files now in band.

- [ ] **Step 3: Commit**

```bash
git add content/blog
git commit -m "feat(blog): add the five Speed run guides"
```

---

## Task 4: Strength and Race guides (5 MDX bodies)

**Files:**
- Create: `content/blog/hill-repeats.mdx`, `trail-run.mdx`, `race-pace-run.mdx`, `time-trial.mdx`, `shakeout-run.mdx`

**Interfaces:**
- Consumes: the seven-section skeleton and voice fixed by `content/blog/easy-run.mdx` (Task 2, Step 1).
- Produces: the final five guide bodies for Task 6's `BODIES` map.

- [ ] **Step 1: Write the five bodies**

Fact sheets:

**`hill-repeats.mdx`** — Hard uphill efforts of 30 s–3 min at 5k–10k effort, jogging or walking back down. Effort 7–8/10. Gravity supplies resistance, so you get power and running-economy gains at a lower impact cost than flat speedwork — the uphill shortens your stride and softens the landing. Form: short strides, quick cadence, drive the arms, lean from the ankles rather than folding at the waist, eyes up the hill. Sample: 15 min warm-up, 8 × 45 s uphill on a 5–8% grade at hard effort, jog down as recovery, 10 min cool-down. Mistakes: over-striding to reach further up the hill; bending at the waist so breathing gets compressed; racing the descent, which is where the injuries and soreness actually come from.

**`trail-run.mdx`** — Off-road running on uneven, often climbing terrain. *Required framing:* pace stops being a useful measure — the same effort can be two minutes per mile slower than road pace, and GPS distance gets less reliable under tree cover and in steep valleys. Run by effort and time instead. Builds ankle stability, proprioception (your sense of where your limbs are without looking), and constant small stabilizing work no flat road delivers. Downhill technique: shorten stride, raise cadence, stay slightly forward rather than braking back on your heels. Sample: 50 min by time, hiking the steep climbs without guilt — hiking climbs is standard practice, not a failure. Mistakes: chasing road paces off-road; road shoes on technical ground; braking hard on descents and shredding the quads.

**`race-pace-run.mdx`** — Segments at goal race pace inside a longer run. Effort depends on the distance you're targeting — marathon pace sits near 5–6/10, 10k pace near 7–8/10. Rehearses the pace physically and psychologically, and doubles as a test of fueling, kit, and shoes. Only part of the run is at pace; a whole run at goal pace is a race, not a workout. Sample (marathon): 90 min total with 40 min at goal marathon pace in the middle. Sample (10k): 10 min warm-up, 4 × 6 min at goal 10k pace with 2 min jog. Mistakes: guessing a goal pace that current fitness doesn't support — derive it from a recent time trial or race instead, and cross-link `/blog/time-trial`; running the entire session at race pace; testing brand-new shoes or gels on race day rather than here.

**`time-trial.mdx`** — A solo, all-out effort over a fixed distance — commonly 1 mile or 5k — run to measure fitness rather than to compete. Effort 9–10/10. The result sets your training paces for the next block: threshold, interval, and easy paces all derive from a current honest benchmark. Run one every 6–8 weeks, on a flat, measured, repeatable route, in similar conditions each time so results are comparable. Pace it evenly — the first quarter should feel almost too controlled. Sample: 15 min warm-up including 4 strides, 5k all-out, 10 min cool-down. Mistakes: running one every couple of weeks, which is racing rather than testing; going out at a pace you can't hold and fading badly, which produces a number that's about pacing, not fitness; running the day after a hard session.

**`shakeout-run.mdx`** — 15–25 minutes, very easy, usually the day before a race or the morning of one, sometimes with a few strides. Effort 2–3/10. Reduces stiffness from travel or a rest day and settles nerves; it produces no fitness and is not meant to. Sample: 20 min very easy plus 3 × 20 s strides, finished feeling like you could do it all again. Mistakes: stretching it out because you feel good; adding surges to "test the legs" — the legs will be fine, and testing them costs you sharpness; skipping it entirely after a long travel day, when it does the most good.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- lib/blog/posts.test.ts`
Expected: PASS — fifteen files in band.

- [ ] **Step 3: Commit**

```bash
git add content/blog
git commit -m "feat(blog): add the Strength and Race run guides"
```

---

## Task 5: Pillar overview and registry-completeness test

**Files:**
- Create: `content/blog/types-of-running-workouts.mdx`
- Modify: `lib/blog/posts.test.ts` — add the reverse-direction completeness test

**Interfaces:**
- Consumes: all 15 guide slugs from Task 1's `POST_SLUGS`.
- Produces: the last MDX body, completing the set the `BODIES` map needs in Task 6.

- [ ] **Step 1: Write the failing completeness test**

Add to the `content/blog MDX files` describe block in `lib/blog/posts.test.ts`:

```ts
  it("every registry entry has a file on disk", () => {
    const onDisk = new Set(mdxFiles().map((f) => f.replace(/\.mdx$/, "")));
    const missing = POST_SLUGS.filter((slug) => !onDisk.has(slug));
    expect(missing).toEqual([]);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- lib/blog/posts.test.ts`
Expected: FAIL — `expected [ 'types-of-running-workouts' ] to deeply equal []`.

- [ ] **Step 3: Write the pillar body**

`content/blog/types-of-running-workouts.mdx`. Different shape from the guides — no seven-section skeleton. Structure:

1. `## Why runners don't just run` — every run type is a different dose of the same two variables, intensity and duration. Most training is best kept polarized: a large majority genuinely easy, a small minority genuinely hard, and relatively little in the moderate middle. The middle is where undertrained runners spend most of their time without meaning to.
2. `## The four groups` — one paragraph per group, using the `GROUP_BLURBS` framing from `lib/blog/posts.ts`: Foundation, Speed, Strength, Race.
3. `## Every run type at a glance` — a markdown table with columns **Run · Group · Effort (/10) · Typical duration · What it builds**, one row per guide, the run name linking to `/blog/<slug>`. All 15 rows. Effort values must match the fact sheets in Tasks 2–4.
4. `## How to build a week out of these` — a concrete five-day example: 3 easy/base runs, 1 workout (tempo or intervals), 1 long run, with strides added after two of the easy runs; the rule that hard days are followed by easy or rest days; and the note that beginners should spend 6–8 weeks on Foundation runs only before adding a Speed session.
5. `## Where to start` — pointers to `/blog/easy-run` and `/blog/long-run` for new runners, `/blog/tempo-run` for runners adding their first workout.
6. `## Track it in Kamee` — 1–2 sentences, shipped features only.

Target 1200–1600 words; the pillar test band is 600–1800.

- [ ] **Step 4: Run tests, lint, and typecheck**

Run: `npm run test && npm run lint && npx tsc --noEmit`
Expected: PASS — all 16 files present and in band.

- [ ] **Step 5: Commit**

```bash
git add content/blog lib/blog/posts.test.ts
git commit -m "feat(blog): add the pillar overview and completeness test"
```

---

## Task 6: Post route and article layout

**Files:**
- Create: `lib/blog/bodies.ts`, `components/blog/PostLayout.tsx`, `app/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `POST_SLUGS`, `PostSlug`, `RunPost`, `getPost`, `getAdjacent`, `postUrl` from `lib/blog/posts.ts`; `StoreBadge` from `components/landing/StoreBadges`; `APP_STORE_URL` / `PLAY_STORE_URL` from `lib/landing/stores`.
- Produces: `BODIES: Record<PostSlug, ComponentType>`; `PostLayout({ post, prev, next, children })`; the live `/blog/<slug>` routes.

- [ ] **Step 1: Create the bodies map**

`lib/blog/bodies.ts`. Typing it `Record<PostSlug, ComponentType>` makes TypeScript reject the file if any slug is missing — that's the compile-time replacement for a runtime "every post has a body" test, which vitest can't do because it cannot resolve `.mdx` imports.

```ts
/**
 * Static MDX imports keyed by slug. This is the only module that imports
 * .mdx — keeping it separate stops the hub and sitemap from pulling 16 post
 * bundles into their import graph.
 *
 * The Record<PostSlug, ...> annotation is load-bearing: tsc fails the build if
 * a post is added to the registry without a body here.
 */
import type { ComponentType } from "react";
import type { PostSlug } from "./posts";

import TypesOfRunningWorkouts from "@/content/blog/types-of-running-workouts.mdx";
import EasyRun from "@/content/blog/easy-run.mdx";
import BaseRun from "@/content/blog/base-run.mdx";
import LongRun from "@/content/blog/long-run.mdx";
import RecoveryRun from "@/content/blog/recovery-run.mdx";
import ProgressionRun from "@/content/blog/progression-run.mdx";
import TempoRun from "@/content/blog/tempo-run.mdx";
import IntervalRun from "@/content/blog/interval-run.mdx";
import Vo2MaxIntervals from "@/content/blog/vo2-max-intervals.mdx";
import FartlekRun from "@/content/blog/fartlek-run.mdx";
import Strides from "@/content/blog/strides.mdx";
import HillRepeats from "@/content/blog/hill-repeats.mdx";
import TrailRun from "@/content/blog/trail-run.mdx";
import RacePaceRun from "@/content/blog/race-pace-run.mdx";
import TimeTrial from "@/content/blog/time-trial.mdx";
import ShakeoutRun from "@/content/blog/shakeout-run.mdx";

export const BODIES: Record<PostSlug, ComponentType> = {
  "types-of-running-workouts": TypesOfRunningWorkouts,
  "easy-run": EasyRun,
  "base-run": BaseRun,
  "long-run": LongRun,
  "recovery-run": RecoveryRun,
  "progression-run": ProgressionRun,
  "tempo-run": TempoRun,
  "interval-run": IntervalRun,
  "vo2-max-intervals": Vo2MaxIntervals,
  "fartlek-run": FartlekRun,
  strides: Strides,
  "hill-repeats": HillRepeats,
  "trail-run": TrailRun,
  "race-pace-run": RacePaceRun,
  "time-trial": TimeTrial,
  "shakeout-run": ShakeoutRun,
};
```

- [ ] **Step 2: Create the article layout**

`components/blog/PostLayout.tsx`:

```tsx
import Link from "next/link";
import { StoreBadge } from "@/components/landing/StoreBadges";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing/stores";
import { postUrl, type RunPost } from "@/lib/blog/posts";

type Props = {
  post: RunPost;
  prev: RunPost | null;
  next: RunPost | null;
  children: React.ReactNode;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PostLayout({ post, prev, next, children }: Props) {
  const dateLabel = post.updated
    ? `Updated ${formatDate(post.updated)}`
    : formatDate(post.published);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    author: { "@type": "Organization", name: "Kamee Fitness" },
    publisher: { "@type": "Organization", name: "Kamee Fitness" },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl(post.slug) },
  };

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-leaf-400"
        >
          ← All running guides
        </Link>

        <header className="mt-6">
          {post.group && (
            <span className="rounded-full border border-leaf-500/40 bg-leaf-500/[0.07] px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-300">
              {post.group}
            </span>
          )}
          <h1 className="font-display mt-4 text-4xl font-bold text-leaf-300 lg:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-ink-300">{post.description}</p>
          <p className="mt-4 text-sm text-ink-400">
            {dateLabel} · {post.readingMinutes} min read
            {post.effort ? ` · ${post.effort} effort` : ""}
          </p>
        </header>

        <article className="mt-10 max-w-[72ch]">{children}</article>

        {/* App CTA */}
        <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="font-display text-lg font-semibold text-mist">
            Run it with Kamee
          </p>
          <p className="mt-2 text-sm text-ink-300">
            Track the session with GPS, watch your pace live, and review your
            splits afterwards. Free on iOS and Android.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StoreBadge platform="ios" href={APP_STORE_URL} />
            <StoreBadge platform="android" href={PLAY_STORE_URL} />
          </div>
        </section>

        {(prev || next) && (
          <nav className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
            {prev ? (
              <Link
                href={`/blog/${prev.slug}`}
                className="text-sm text-ink-300 hover:text-leaf-400"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/blog/${next.slug}`}
                className="text-sm text-ink-300 hover:text-leaf-400 sm:text-right"
              >
                {next.title} →
              </Link>
            )}
          </nav>
        )}

        <p className="mt-10 border-t border-white/10 pt-6 text-xs text-ink-500">
          General training information, not medical advice. Check with a doctor
          before starting or changing a training plan, especially if you have an
          existing condition or injury.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create the post route**

`app/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostLayout } from "@/components/blog/PostLayout";
import { BODIES } from "@/lib/blog/bodies";
import { getAdjacent, getPost, POST_SLUGS } from "@/lib/blog/posts";

// Every post is known at build time; anything else is a static 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return POST_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };

  const url = `/blog/${post.slug}`;
  // openGraph/twitter are restated in full — Next merges metadata shallowly
  // per key, so a partial object would drop the root layout's fields.
  // `images` is deliberately omitted so the opengraph-image.tsx file
  // convention supplies it.
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: "Kamee Fitness",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const Body = BODIES[post.slug];
  const { prev, next } = getAdjacent(post.slug);

  return (
    <PostLayout post={post} prev={prev} next={next}>
      <Body />
    </PostLayout>
  );
}
```

- [ ] **Step 4: Verify the routes render**

```bash
npx tsc --noEmit
npm run dev
```

Check in a browser: `/blog/easy-run` renders with exactly one `<h1>`, styled prose, working prev/next; `/blog/tempo-run` prev/next chain is correct; `/blog/types-of-running-workouts` shows no group pill and no prev/next; `/blog/not-a-real-run` 404s. Confirm one `<script type="application/ld+json">` in the page source.

Expected: all pass. If MDX imports fail to typecheck, confirm `types/` has an `*.mdx` module declaration — `@types/mdx` is already a dependency and provides it.

- [ ] **Step 5: Commit**

```bash
git add lib/blog/bodies.ts components/blog/PostLayout.tsx app/blog
git commit -m "feat(blog): render individual run guides"
```

---

## Task 7: Blog hub page

**Files:**
- Create: `components/blog/PostCard.tsx`, `app/blog/page.tsx`

**Interfaces:**
- Consumes: `getPillar`, `getGuides`, `getGuidesByGroup`, `POST_GROUPS`, `GROUP_BLURBS`, `postUrl`, `RunPost` from `lib/blog/posts.ts`.
- Produces: the `/blog` route. No new exports consumed by later tasks.

- [ ] **Step 1: Create the card**

`components/blog/PostCard.tsx`:

```tsx
import Link from "next/link";
import type { RunPost } from "@/lib/blog/posts";

const EFFORT_STYLES: Record<string, string> = {
  Easy: "border-leaf-500/40 bg-leaf-500/[0.07] text-leaf-300",
  Moderate: "border-sun-500/40 bg-sun-500/[0.07] text-sun-500",
  Hard: "border-ember-500/40 bg-ember-500/[0.07] text-ember-400",
};

export function PostCard({ post }: { post: RunPost }) {
  return (
    <li>
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-leaf-500/40"
      >
        <h3 className="font-display text-base font-semibold text-mist group-hover:text-leaf-300">
          {post.title}
        </h3>
        <p className="mt-2 flex-1 text-sm text-ink-300">{post.excerpt}</p>
        <p className="mt-4 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.16em] text-ink-400">
          {post.effort && (
            <span
              className={`rounded-full border px-2 py-0.5 ${EFFORT_STYLES[post.effort]}`}
            >
              {post.effort}
            </span>
          )}
          <span>{post.readingMinutes} min read</span>
        </p>
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Create the hub**

`app/blog/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/PostCard";
import {
  GROUP_BLURBS,
  getGuides,
  getGuidesByGroup,
  getPillar,
  POST_GROUPS,
  postUrl,
} from "@/lib/blog/posts";

const TITLE = "Running Guides";
const DESCRIPTION =
  "Every type of running workout explained — easy, tempo, interval, long, fartlek, hills and more. What each does, how hard it should feel, and how to run it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: "/blog",
    siteName: "Kamee Fitness",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: ["/adaptive-icon.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/adaptive-icon.png"],
  },
};

export default function BlogIndexPage() {
  const pillar = getPillar();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    itemListElement: getGuides().map((post, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: postUrl(post.slug),
      name: post.title,
    })),
  };

  return (
    <main className="min-h-screen bg-ink-950 text-ink-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-leaf-400"
        >
          ← Kamee Fitness
        </Link>

        <h1 className="font-display mt-6 text-4xl font-bold text-leaf-300 lg:text-5xl">
          {TITLE}
        </h1>
        <p className="mt-4 max-w-2xl text-ink-300">{DESCRIPTION}</p>

        {/* Featured pillar */}
        <Link
          href={`/blog/${pillar.slug}`}
          className="group mt-10 block rounded-3xl border border-leaf-500/30 bg-leaf-500/[0.05] p-6 transition-colors hover:border-leaf-500/60"
        >
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-400">
            Start here
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-mist group-hover:text-leaf-300">
            {pillar.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">{pillar.excerpt}</p>
          <p className="mt-3 text-[0.62rem] uppercase tracking-[0.16em] text-ink-400">
            {pillar.readingMinutes} min read
          </p>
        </Link>

        {POST_GROUPS.map((group) => (
          <section key={group} className="mt-12">
            <h2 className="font-display text-xl font-semibold text-leaf-400">
              {group}
            </h2>
            <p className="mt-1 text-sm text-ink-400">{GROUP_BLURBS[group]}</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {getGuidesByGroup(group).map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`, then `npm run dev` and open `/blog`.
Expected: the pillar is featured; four group sections render 5/5/2/3 cards; every card links to a page that loads.

- [ ] **Step 4: Commit**

```bash
git add components/blog/PostCard.tsx app/blog/page.tsx
git commit -m "feat(blog): add the blog hub page"
```

---

## Task 8: Sitemap and footer link

**Files:**
- Modify: `app/sitemap.ts` — add blog URLs to `staticPages`
- Modify: `components/landing/Footer.tsx:28-44` — add a "Blog" nav link

**Interfaces:**
- Consumes: `POSTS` and `postUrl` from `lib/blog/posts.ts`.
- Produces: nothing new.

- [ ] **Step 1: Add blog entries to the sitemap**

In `app/sitemap.ts`, add the import:

```ts
import { POSTS, postUrl } from "@/lib/blog/posts";
```

Then append to the `staticPages` array, after the existing `/delete-account` entry:

```ts
    {
      url: `${SITE}/blog`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...POSTS.map((post) => ({
      url: postUrl(post.slug),
      lastModified: new Date(post.updated ?? post.published),
      changeFrequency: "monthly" as const,
      priority: post.kind === "pillar" ? 0.7 : 0.6,
    })),
```

Leave the plans query below it untouched — blog URLs are in `staticPages`, so they survive the catch-block fallback if Supabase is unreachable.

- [ ] **Step 2: Add the footer link**

In `components/landing/Footer.tsx`, add as the first item in the `<nav>`, before the Terms link:

```tsx
            <a href="/blog" className="hover:text-white">
              Blog
            </a>
```

- [ ] **Step 3: Verify**

Run: `npm run dev`, then open `/sitemap.xml`.
Expected: `/blog` plus all 16 post URLs present alongside the existing entries. The footer on `/` shows Blog · Terms · Privacy · Delete account · Developers · Contact.

- [ ] **Step 4: Commit**

```bash
git add app/sitemap.ts components/landing/Footer.tsx
git commit -m "feat(blog): list the blog in the sitemap and footer"
```

---

## Task 9: Per-post OG images

**Files:**
- Create: `app/blog/[slug]/opengraph-image.tsx`

**Interfaces:**
- Consumes: `getPost`, `POST_SLUGS` from `lib/blog/posts.ts`.
- Produces: `/blog/<slug>/opengraph-image` for each post. This task is self-contained — deleting the file removes the feature cleanly, and `generateMetadata` falls back to the root layout's image.

- [ ] **Step 1: Create the image route**

`app/blog/[slug]/opengraph-image.tsx`. Note: `ImageResponse` is rendered by Satori, which supports only a subset of CSS and no Tailwind classes — use inline style objects, and give every multi-child container an explicit `display: "flex"`.

```tsx
import { ImageResponse } from "next/og";
import { getPost, POST_SLUGS } from "@/lib/blog/posts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kamee Fitness running guide";

export function generateStaticParams() {
  return POST_SLUGS.map((slug) => ({ slug }));
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  const title = post?.title ?? "Kamee Fitness";
  const eyebrow = post?.group ?? "Running guide";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#07090a",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#9bd2a8",
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#eef4f0",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#8ea0a3",
          }}
        >
          kamee.fit
        </div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 2: Verify the image renders**

Run: `npm run dev`, then open `/blog/tempo-run/opengraph-image`.
Expected: a 1200×630 dark PNG reading "SPEED" / "The Tempo Run: Training at Your Lactate Threshold" / "kamee.fit". Then view source on `/blog/tempo-run` and confirm `og:image` points at that path.

- [ ] **Step 3: Full build verification**

```bash
npm run test && npm run lint && npx tsc --noEmit && npm run build
```

Expected: all green. The build output should list `/blog` and 16 prerendered `/blog/[slug]` entries.

- [ ] **Step 4: Commit**

```bash
git add app/blog/[slug]/opengraph-image.tsx
git commit -m "feat(blog): generate per-post OG images"
```

---

## Final verification

- [ ] `npm run test` — all suites pass, including the 16-file completeness check.
- [ ] `npm run lint` — clean.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — `/blog` plus 16 static post routes prerendered.
- [ ] Manual pass in `npm run dev`: hub renders four groups; three posts spot-checked for single H1, prev/next, CTA, disclaimer; `/blog/nope` 404s; `/sitemap.xml` carries 17 blog URLs; one OG image renders.
- [ ] Read three finished posts end to end and confirm the "Track it in Kamee" sections claim only shipped features — GPS track sessions, live pace, auto-pause, splits, plans. No voice lap times.
