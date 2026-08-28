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

/** One bullet in a section's supporting list. */
export interface Point {
  key: string;
  title: string;
  body: string;
}

// Everything below is grounded in the shipped app: only features live on
// production are marketed here. See docs/feature-map.md in the mobile repo.
export const FEATURES: Feature[] = [
  {
    key: "kamy",
    title: "Coach Kamy",
    body: "An AI coach that reads your training, debriefs every session, and tells you when to push and when to rest.",
    accent: "leaf",
  },
  {
    key: "plans",
    title: "Training plans",
    body: "Couch to 5K through half marathon, plus strength plans — or build your own from scratch.",
    accent: "leaf",
  },
  {
    key: "track",
    title: "GPS tracking",
    body: "Live route, splits, pace, elevation and heart-rate zones, with voice cues and a cinematic flyover replay.",
    accent: "teal",
  },
  {
    key: "log",
    title: "Workout log",
    body: "Guided sessions and free-form set logging, with runs and lifts interleaved in one history.",
    accent: "leaf",
  },
  {
    key: "schedule",
    title: "Calendar sync",
    body: "Your training week on a drag-and-drop calendar that syncs to the calendar you already use.",
    accent: "teal",
  },
  {
    key: "communities",
    title: "Communities",
    body: "Clubs, events and challenges, a live race calendar, and buddies you add by scanning a code.",
    accent: "teal",
  },
];

/** Short chip labels for the hero ticker, in page order. */
export const TICKER: { key: string; label: string; accent: FeatureAccent }[] = [
  { key: "kamy", label: "Kamy Coach", accent: "leaf" },
  { key: "plans", label: "Training plans", accent: "leaf" },
  { key: "track", label: "GPS tracking", accent: "teal" },
  { key: "log", label: "Workout log", accent: "leaf" },
  { key: "schedule", label: "Calendar sync", accent: "teal" },
  { key: "communities", label: "Communities", accent: "teal" },
];

export const COACH_POINTS: Point[] = [
  {
    key: "ask",
    title: "Ask Kamy anything",
    body: "“Should I train or rest today?” Kamy chats, reads your sessions, and answers with your actual training in mind.",
  },
  {
    key: "debrief",
    title: "Session debriefs",
    body: "Finish a run or a lift and Kamy tells you what went well, with zone analysis and insights on the session.",
  },
  {
    key: "reports",
    title: "Weekly reports & goals",
    body: "Your week in charts, next week’s focus, and four kinds of goals tracked with real intelligence.",
  },
];

export const GPS_POINTS: Point[] = [
  {
    key: "splits",
    title: "Live splits & moving time",
    body: "Per-kilometre pace the way serious trackers do it, with units that switch instantly.",
  },
  {
    key: "voice",
    title: "Voice split announcements",
    body: "Spoken cues every split so the phone stays in your pocket.",
  },
  {
    key: "hr",
    title: "Heart-rate zones",
    body: "Recorded streams with four-zone charts, on the run and in the replay.",
  },
  {
    key: "replay",
    title: "Route flyover replay",
    body: "Relive the route in a cinematic flyover with your stats riding along.",
  },
  {
    key: "offline",
    title: "Works with zero signal",
    body: "Runs finish and save offline, then sync themselves when you’re back.",
  },
];

export const LOG_POINTS: Point[] = [
  {
    key: "guided",
    title: "Guided sessions",
    body: "Every exercise demoed, sets logged as you go, rest timed for you.",
  },
  {
    key: "freeform",
    title: "Free-form logging",
    body: "Prefer to wing it? Log any session set by set, your way, and backfill old ones with tags.",
  },
  {
    key: "import",
    title: "Bring your history",
    body: "Import GPX, TCX and FIT files, and pull activities straight from your watch’s health platform.",
  },
];

/** Real plan names from the shipped catalog. */
export const PLAN_NAMES = [
  "Couch to 5K",
  "5K Beginner",
  "10K",
  "10K Intermediate",
  "Half Marathon",
  "Hike prep",
  "Bodyweight Strength",
] as const;

export const COMMUNITY_CARDS: Point[] = [
  {
    key: "clubs",
    title: "Clubs",
    body: "Create or join a club for your city, your gym, or your pace group — each with its own identity.",
  },
  {
    key: "events",
    title: "Events & challenges",
    body: "Meetups, challenges and race-day events with banners — organised inside the app.",
  },
  {
    key: "races",
    title: "Race calendar",
    body: "A live listing of real races — find a start line near you and point your plan at it.",
  },
];

/** Badge emblems shown in the progress band. */
export const BADGES = [
  { key: "first-workout", alt: "First workout badge" },
  { key: "streak", alt: "Streak badge" },
  { key: "pr-5k", alt: "5K personal record badge" },
  { key: "distance", alt: "Distance badge" },
] as const;

/** Total badges in the shipped catalogue, used for the “+N” tile. */
export const BADGE_TOTAL = 35;

export const FAQ: FaqItem[] = [
  {
    q: "Is Kamee free?",
    a: "Yes — free to start. Kamee Premium removes ads and adds custom plans plus advanced weekly and monthly stats.",
  },
  {
    q: "Where can I download Kamee?",
    a: "On Google Play for Android and the App Store for iPhone. Both are live today.",
  },
  {
    q: "Does it work without a signal?",
    a: "Yes. Runs finish and save on your phone with zero connectivity, then sync themselves once you are back online.",
  },
  {
    q: "Can I bring my history from another app?",
    a: "Yes. Import GPX, TCX and FIT files, and pull past activities in from your watch’s health platform.",
  },
  {
    q: "Is my data private?",
    a: "Yes. See our Privacy Policy for exactly what we store and why.",
  },
];
