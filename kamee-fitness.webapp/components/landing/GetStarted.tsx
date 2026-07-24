import { StoreBadges } from "./StoreBadges";

type Step = {
  n: number;
  t: string;
  d: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    t: "Install Kamee",
    d: "Grab it from Google Play on Android or the App Store on iPhone — free to start.",
  },
  {
    n: 2,
    t: "Answer a few questions",
    d: "Share your level, goals, and equipment, and Kamy hand-picks your plan.",
  },
  {
    n: 3,
    t: "Start your first session",
    d: "Guided workouts, GPS tracking, and steady progress from day one.",
  },
];

export default function GetStarted() {
  return (
    <section id="get-started" className="mx-auto max-w-4xl px-6 py-20">
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 sm:p-12">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-leaf-400">
          Now on Google Play and the App Store
        </span>
        <h2 className="mt-3 font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold uppercase tracking-tight text-mist">
          Get started in three steps
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

        <StoreBadges className="mt-9" />
      </div>
    </section>
  );
}
