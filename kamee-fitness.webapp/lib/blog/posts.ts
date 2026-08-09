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
