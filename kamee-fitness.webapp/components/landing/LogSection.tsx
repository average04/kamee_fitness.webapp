import type { ReactNode } from "react";
import { LOG_POINTS } from "@/lib/landing/content";

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Bullet glyphs, keyed by LOG_POINTS key. */
const BULLET_ICON: Record<string, ReactNode> = {
  guided: <path d="M7 4.5v15l12-7.5z" />,
  freeform: (
    <>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      <path d="M15 5l4 4" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
};

const DONE_SETS: { label: string; value: string }[] = [
  { label: "SET 1", value: "12 × 40 kg" },
  { label: "SET 2", value: "10 × 45 kg" },
];

export default function LogSection() {
  return (
    <section
      id="log"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-leaf-400">
        Workout log
      </p>
      <h2 className="mt-3 font-display text-[clamp(1.75rem,5vw,2.875rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-mist">
        Road and rack. One log.
      </h2>

      <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Set-logging mock */}
        <div className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-9 items-center rounded-full border border-leaf-500/40 bg-leaf-500/15 px-4 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-leaf-300">
              Guided
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full border border-white/12 px-4 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-muted">
              Log session
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-display text-base font-bold text-mist">
              Goblet Squat
            </h3>
            <span className="text-[0.75rem] font-semibold text-muted">
              3 × 10–12
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {DONE_SETS.map((set) => (
              <div
                key={set.label}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
              >
                <span className="w-12 shrink-0 text-[0.75rem] font-bold text-muted">
                  {set.label}
                </span>
                <span className="text-[0.875rem] font-bold text-mist">
                  {set.value}
                </span>
                <svg {...ICON} className="ml-auto size-4 shrink-0 text-leaf-500" aria-hidden>
                  <path d="m4 12.5 5 5L20 6.5" />
                </svg>
              </div>
            ))}

            <div className="flex items-center gap-3 rounded-xl border border-dashed border-ember-500/50 bg-ember-500/[0.05] px-4 py-3">
              <span className="w-12 shrink-0 text-[0.75rem] font-bold text-muted">
                SET 3
              </span>
              <span className="text-[0.875rem] font-bold text-mist/50">— × —</span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-bold text-ember-400">
                <svg {...ICON} className="size-4 shrink-0" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Rest 0:52
              </span>
            </div>
          </div>

          <div className="h-px bg-white/8" />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-[0.84375rem] text-mist/75">
              <svg {...ICON} className="size-4.5 shrink-0 text-teal-500" aria-hidden>
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="5" r="3" />
                <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
              </svg>
              <p>
                <b className="font-semibold text-mist">Morning run</b> · 5.2 km ·
                yesterday
              </p>
            </div>
            <div className="flex items-center gap-3 text-[0.84375rem] text-mist/75">
              <svg {...ICON} className="size-4.5 shrink-0 text-leaf-500" aria-hidden>
                <path d="M4 9v6" />
                <path d="M7 6v12" />
                <path d="M17 6v12" />
                <path d="M20 9v6" />
                <path d="M7 12h10" />
              </svg>
              <p>
                <b className="font-semibold text-mist">Push day</b> · 42 min ·
                Tuesday
              </p>
            </div>
          </div>

          <p className="text-[0.75rem] text-ink-500">
            Runs and lifts, interleaved in one history.
          </p>
        </div>

        {/* Bullets */}
        <ul className="flex flex-col gap-5">
          {LOG_POINTS.map((point) => (
            <li key={point.key} className="flex gap-3.5">
              <svg {...ICON} className="mt-0.5 size-5 shrink-0 text-leaf-500" aria-hidden>
                {BULLET_ICON[point.key]}
              </svg>
              <p className="text-[0.9375rem] leading-relaxed text-mist/75">
                <b className="font-semibold text-mist">{point.title}</b>{" "}
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
