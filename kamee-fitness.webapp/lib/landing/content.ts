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

// Grounded in the real mobile app. Set `screenshot` once the matching PNG
// exists under public/screens/; otherwise a placeholder renders.
export const FEATURES: Feature[] = [
  {
    key: "plans",
    title: "Plans that fit you",
    body: "Answer a few questions and Kamy hand-picks a multi-week plan for your level, goals, and equipment.",
    accent: "leaf",
    screenshot: "/screens/plans.png",
  },
  {
    key: "sessions",
    title: "Guided sessions",
    body: "Every exercise demoed, set-by-set logging, rest timers, and form notes as you go.",
    accent: "leaf",
    screenshot: "/screens/sessions.png",
  },
  {
    key: "track",
    title: "Track outdoors",
    body: "GPS walks and runs with a live route map, pace, elevation, and heart rate.",
    accent: "teal",
    screenshot: "/screens/track.png",
  },
  {
    key: "buddies",
    title: "Track Buddies",
    body: "Connect by QR code and watch friends’ runs move on the map in real time.",
    accent: "teal",
    screenshot: "/screens/buddies.png",
  },
  {
    key: "progress",
    title: "Progress that sticks",
    body: "A calendar heatmap, current and longest streaks, plus volume and distance stats.",
    accent: "leaf",
    screenshot: "/screens/progress.png",
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
