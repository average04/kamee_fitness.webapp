# Running blog — types of runs — design

**Date:** 2026-08-09 · **Status:** approved (chat) · **Branch:** `feat/running-blog`

## Goal

Add a blog section to kamee.fit whose first (and, for now, only) content is a
complete guide to the types of running workouts — tempo, interval, long, easy,
fartlek, hill repeats, and the rest — each explaining what the run is, why it
works, and how to actually run it.

Two jobs: organic search traffic on high-intent running queries that ends in an
app install, and a genuine reference the app's own Track users can be pointed
at.

## Decisions (made with owner)

- **Content lives in MDX files in the repo** (`content/blog/*.mdx`), matching
  the existing `content/legal` pattern. Not Supabase-backed — no table, RLS,
  migration, or admin editor. Posts ship with a deploy, which is how every
  other content change on this site already ships.
- **Hub + one post per run type + a pillar overview** (hub-and-spoke). Each run
  type gets its own URL so it can rank for its own query; the pillar gives the
  set a single linkable entry point.
- **15 run types** in the first batch — genuinely "all types of run", not a
  sampler.
- **~700–900 words per post**, practical rather than academic: pacing, a real
  sample session, common mistakes.
- **OG images generated** per post, and a **training/medical disclaimer** in
  the post footer. (Both were left to me; both are in.)

## Key constraint

`next.config.ts` builds MDX with **no remark/rehype plugins** — Turbopack
(Next 16) doesn't run them, which is why `mdx-components.tsx` derives heading
IDs at render time instead of using `rehype-slug`. The consequence for this
feature: **MDX frontmatter will not be parsed.** Post metadata therefore lives
in TypeScript, not at the top of the `.mdx` file. Every design decision below
about the registry follows from this.

## Changes

### 1. Content — `content/blog/*.mdx`

16 files: 15 run-type guides plus 1 pillar. Body prose only.

**Bodies start at `##`.** The `<h1>` is rendered by the page layout, so a `#`
in a body would produce a second H1 on the page. Enforced by test.

Fixed section skeleton for all 15 guides, which is what holds them in the
700–900 word band and keeps them readable as a set:

1. **What it is** — 2–3 sentences, plain language.
2. **Why it works** — the physiological payoff, no jargon left undefined.
3. **How to pace it** — talk test, RPE, and a %max-HR range.
4. **A sample session** — one concrete, runnable workout.
5. **Where it fits in your week** — frequency and placement relative to hard days.
6. **Common mistakes** — exactly 3 bullets.
7. **Track it in Kamee** — 1–2 sentences.

The pillar follows its own shape: what training variety is for, the four
groups below, a comparison table of all 15, and a link out to each post.

**Constraint on section 7:** it may reference only *shipped* app features —
GPS track sessions, live pace, auto-pause, splits, plans. Not voice lap times
(open on the board), and no claim that isn't verifiable in the app today.

### 2. Registry — `lib/blog/posts.ts`

Metadata only, no MDX imports, so the hub, sitemap, and tests can import it
without transitively pulling in 16 post bodies.

```ts
export type RunPost = {
  slug: string;
  kind: "pillar" | "guide";
  title: string;
  description: string;   // meta description, 50–160 chars
  excerpt: string;       // hub card blurb
  group?: "Foundation" | "Speed" | "Strength" | "Race";
  effort?: "Easy" | "Moderate" | "Hard";
  purpose: string;       // one line: what it builds
  readingMinutes: number;
  published: string;     // ISO date
  updated?: string;
};
```

`group` and `effort` are optional because they describe a single workout type
and are meaningless for the pillar, which omits both; `PostCard` renders each
badge only when present. The test asserts every `kind: "guide"` entry *does*
carry both.

`readingMinutes` is **authored by hand** in the registry, not computed. There
is no build-time MDX parsing available here (see Key constraint), and rounding
a 700–900 word post lands on 4 minutes either way.

`updated` is optional; where the layout shows a date it uses `updated ??
published`, labelled "Updated" only when `updated` is set.

Helpers alongside it: `getPost(slug)`, `getGuides()`, `getPillar()`,
`getAdjacent(slug)` for prev/next, and `postUrl(slug)`.

The pillar is a registry entry with `kind: "pillar"`, not a separate static
route — so it renders through the same `[slug]` page and lands in the sitemap
with no extra wiring, and no static-vs-dynamic segment precedence to reason
about.

### 3. Bodies — `lib/blog/bodies.ts`

`Record<string, ComponentType>` holding the 16 static MDX imports. Imported
only by `app/blog/[slug]/page.tsx`. This is the module that exists purely to
keep the MDX bundles off the hub and sitemap import graph.

### 4. The 15 run types

| Group | Slug | Run |
|---|---|---|
| Foundation | `easy-run` | Easy run |
| Foundation | `base-run` | Base run |
| Foundation | `long-run` | Long run |
| Foundation | `recovery-run` | Recovery run |
| Foundation | `progression-run` | Progression run |
| Speed | `tempo-run` | Tempo / threshold run |
| Speed | `interval-run` | Interval run |
| Speed | `vo2-max-intervals` | VO2 max / track repeats |
| Speed | `fartlek-run` | Fartlek |
| Speed | `strides` | Strides |
| Strength | `hill-repeats` | Hill repeats |
| Strength | `trail-run` | Trail run |
| Race | `race-pace-run` | Race-pace run |
| Race | `time-trial` | Time trial |
| Race | `shakeout-run` | Shakeout run |

Pillar: `types-of-running-workouts`.

Easy run and base run overlap in real training vocabulary, as do interval and
VO2 max repeats. Each of those four posts carries an explicit "how this differs
from X" paragraph and cross-links its neighbour, rather than quietly repeating
it. Same for tempo vs race-pace.

### 5. Routes

- **`app/blog/page.tsx`** — hub. Pillar featured at top, then the 15 guides as
  cards grouped by Foundation / Speed / Strength / Race. Static.
- **`app/blog/[slug]/page.tsx`** — post. `generateStaticParams()` over the
  registry; `export const dynamicParams = false` so an unknown slug 404s at
  build rather than at request time. `notFound()` for a slug missing from the
  bodies map (unreachable given the test, but cheap).

Both are fully static, so no `next.config.ts` cache-header entry is needed —
unlike `/plans/:id`, which is SSR and needs the CDN cache as a cost defense.

### 6. Components

- **`components/blog/PostLayout.tsx`** — article shell: back link, group pill,
  H1, description lede, meta row (reading time · updated date), MDX body,
  "Track this run in Kamee" CTA reusing `components/landing/StoreBadges`,
  prev/next links, disclaimer, JSON-LD. The disclaimer is one muted line above
  the footer rule, to the effect of: general training information, not medical
  advice; check with a doctor before starting or changing a training plan.
- **`components/blog/PostCard.tsx`** — hub card: title, excerpt, effort badge,
  reading time.

Blog pages carry their own light header (back to Kamee Fitness), the way
`LegalDocLayout` does. The landing `Header` is a client component whose nav is
anchor-based (`#top`, `#get-the-app`) and doesn't travel off the home page.

Styling follows landing conventions: `bg-ink-950`, leaf accents,
`font-display` headings, `max-w-[72ch]` prose column. MDX bodies inherit the
existing `useMDXComponents` mapping, so they need no per-post styling.

### 7. SEO

- **Per-post `generateMetadata`** — title, description, `alternates.canonical`,
  and **fully restated** `openGraph` and `twitter` objects. Next merges
  metadata shallowly per key, so a partial object would drop the layout's
  fields — the same trap already documented in `app/plans/[id]/page.tsx`.
- **JSON-LD** — `BlogPosting` per post, `ItemList` on the hub, inline
  `<script type="application/ld+json">`. Safe under the global CSP, which sets
  `frame-ancestors`/`base-uri`/`object-src`/`form-action` but deliberately no
  `script-src`.
- **`app/sitemap.ts`** — add `/blog` (priority 0.7) plus every registry slug
  (pillar 0.7, guides 0.6), `changeFrequency: "monthly"`. Static, derived from
  the registry, no extra DB call; the existing plans query is untouched.
- **`robots.ts`** already allows everything outside `/me`, `/admin`, `/login`,
  `/api`, `/auth` — no change.
- **Footer** — add a "Blog" link to the nav in
  `components/landing/Footer.tsx`.
- **OG images** — `app/blog/[slug]/opengraph-image.tsx` using `next/og`
  `ImageResponse`: branded dark card, post title, Kamee mark. Self-contained;
  droppable without touching anything else.

### 8. Tests — `lib/blog/posts.test.ts`

Vitest, mirroring `lib/landing/content.test.ts`:

- slugs unique, non-empty, kebab-case;
- every registry entry has a body in `bodies.ts`, and every body has an entry;
- descriptions 50–160 chars; excerpts non-empty;
- every `kind: "guide"` entry carries both `group` and `effort`;
- `readingMinutes > 0`;
- `published` parses as a valid date and is not in the future;
- exactly one entry with `kind: "pillar"`;
- filesystem check: each `content/blog/<slug>.mdx` exists and contains no
  top-level `# ` heading.

## Out of scope

Comments, tag/category filtering UI, search, pagination, author bios, RSS, a
CMS or admin editor, non-running topics, and a header nav entry (the landing
header is anchor-based and landing-only). Sixteen posts fit comfortably on one
hub page; any of these can follow if the blog earns traffic.

## Verification

Local: `npm run test`, `npm run lint`, and `next build` green; `/blog` lists
all 16; each of the 16 post URLs renders with correct H1, single H1 per page,
working prev/next, and a valid OG image at `/blog/<slug>/opengraph-image`; an
unknown slug 404s; `/sitemap.xml` contains `/blog` plus all 16 entries; JSON-LD
validates. Ship: merge → push → Netlify deploy → live spot-check on kamee.fit
(hub, two posts, sitemap, one OG unfurl).
