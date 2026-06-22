import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  TESTERS_GROUP_URL,
} from "@/lib/landing/stores";

type Step = {
  n: number;
  t: string;
  d: string;
  href?: string;
  linkText?: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    t: "Join the testers group",
    d: "Join our Google Group with the same Google account that's on your phone — that membership is what unlocks the test.",
    href: TESTERS_GROUP_URL,
    linkText: "Open the testers group",
  },
  {
    n: 2,
    t: "Open the early-access link",
    d: "Once you're in the group, open the Google Play link and tap “Become a tester.”",
    href: PLAY_STORE_URL,
    linkText: "Open the early-access link",
  },
  {
    n: 3,
    t: "Install Kamee",
    d: "Download Kamee from the Play Store like any other app.",
  },
  {
    n: 4,
    t: "Start your first plan",
    d: "Open the app, answer a few questions, and Kamy picks your plan.",
  },
];

export default function HowToJoin() {
  return (
    <section id="join" className="mx-auto max-w-4xl px-6 py-20">
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 sm:p-12">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ember-400">
          Android early access
        </span>
        <h2 className="mt-3 font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold uppercase tracking-tight text-mist">
          Join the Android beta in four steps
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
                {s.href && s.linkText && (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-sm font-semibold text-leaf-400 underline-offset-4 hover:underline"
                  >
                    {s.linkText} →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href={TESTERS_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf-500"
          >
            Join the testers group
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
