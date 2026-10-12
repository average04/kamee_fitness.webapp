export type FeatureAccent = "leaf" | "teal" | "fuel";

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
    key: "fuel",
    title: "Fuel log",
    body: "Snap or describe a meal, review Kamy’s estimates, and follow meal plans shaped around your training. Included with Premium.",
    accent: "fuel",
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
  { key: "fuel", label: "Fuel log", accent: "fuel" },
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
    a: "Yes — free to start. Kamee Premium adds the Fuel Log, meal plans, custom training plans, and advanced weekly and monthly stats.",
  },
  {
    q: "How does the Fuel Log work?",
    a: "In the mobile app, open Record → FUEL. Snap a meal, upload a photo, or describe what you ate. Kamy estimates calories and protein, carbs, and fat; review the items and adjust portions before saving. You can edit portions later, too. The Fuel Log and meal plans are included with Kamee Premium.",
  },
  {
    q: "Do meal plans follow my training?",
    a: "Yes. Eat to the Plan gives food guidance for run, strength, rest, and long-run days, including the day before a long run. Calorie and macro targets are optional and set by you. Kamy’s meal nutrition numbers are estimates.",
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

/** One answered question on the /faq help page, grouped under a heading. */
export interface HelpFaqSection {
  id: string;
  label: string;
  items: FaqItem[];
}

// The help FAQ is a DIFFERENT audience from the landing FAQ above: these
// readers already have the app, usually because something confused them or
// stopped working. So no download question, no pitch — every answer names the
// screen to go to. The mobile app's Help screen links straight here, which is
// the point of keeping it on the web: an answer can be corrected without an
// OTA publish.
//
// Only claim what is LIVE in docs/feature-map.md. An FAQ promising a feature
// that is PREVIEW or PAUSED is worse than no FAQ.
export const HELP_FAQ: HelpFaqSection[] = [
  {
    id: "getting-started",
    label: "Getting started",
    items: [
      {
        q: "Is Kamee free?",
        a: "Yes — free to start. Kamee Premium adds the Fuel Log, meal plans, custom training plans, and advanced weekly and monthly stats.",
      },
      {
        q: "How do I switch between kilometers and miles?",
        a: "Settings → Workouts & tracking → Distance units. The choice applies everywhere distance and pace appear, including voice announcements.",
      },
      {
        q: "Can I bring my history from another app?",
        a: "Yes. Import GPX, TCX and FIT files from Settings → Sync, and pull past activities in from your watch's health platform on the same screen.",
      },
    ],
  },
  {
    id: "tracking",
    label: "Tracking runs",
    items: [
      {
        q: "Does Kamee work without a signal?",
        a: "Yes. Runs finish and save on your phone with zero connectivity, then sync themselves once you are back online. Nothing is lost while you are offline.",
      },
      {
        q: "My run finished but hasn't synced — where is it?",
        a: "It is safe on your phone. Anything waiting to upload shows an unsynced banner, and Kamee retries on its own whenever the connection comes back. You can also force a retry from Settings → Sync.",
      },
      {
        q: "Why does tracking stop when my screen is off?",
        a: "Some Android phones — Xiaomi, Oppo, Vivo, Realme, Infinix and Tecno especially — aggressively kill background apps to save battery. Settings → Workouts & tracking → Background tracking walks you through the exact toggles to change on your phone.",
      },
      {
        q: "Can I edit or delete a past session?",
        a: "Yes. Open the session from your history and use the menu in the top right. Sessions never expire on their own — a workout stays in your history until you remove it.",
      },
    ],
  },
  {
    id: "fuel",
    label: "Fuel and meal plans",
    items: [
      {
        q: "How does the Fuel Log work?",
        a: "Open Record → FUEL. Snap a meal, upload a photo, or describe what you ate. Kamy estimates calories and protein, carbs, and fat; review the items and adjust portions before saving. You can edit portions later, too. The Fuel Log and meal plans are included with Kamee Premium.",
      },
      {
        q: "Do meal plans follow my training?",
        a: "Yes. Eat to the Plan gives food guidance for run, strength, rest, and long-run days, including the day before a long run. Calorie and macro targets are optional and set by you. Kamy's meal nutrition numbers are estimates.",
      },
    ],
  },
  {
    id: "account",
    label: "Account and billing",
    items: [
      {
        q: "How do I cancel Premium?",
        a: "Subscriptions are billed by Apple or Google, not by us, so cancelling happens in your App Store or Google Play account settings. Your Premium features stay available until the period you already paid for runs out.",
      },
      {
        q: "How do I delete my account?",
        a: "In the app: You → Personal info → Delete account. Deletion is not instant — you get a 30-day grace period during which a banner lets you restore the account. After that everything is permanently erased. You can also start the process at kamee.fit/delete-account.",
      },
      {
        q: "Is my data private?",
        a: "Yes. See our Privacy Policy for exactly what we store and why.",
      },
    ],
  },
  {
    id: "help",
    label: "Still stuck",
    items: [
      {
        q: "How do I report a bug?",
        a: "Settings → Help → Report a bug. It sends your message along with your app version, build and device, which is usually what we need to reproduce the problem. Contact support on the same screen covers everything else.",
      },
    ],
  },
];
