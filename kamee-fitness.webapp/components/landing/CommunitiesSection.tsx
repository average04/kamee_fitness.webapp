import type { ReactNode } from "react";
import { COMMUNITY_CARDS } from "@/lib/landing/content";

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Card glyphs, keyed by COMMUNITY_CARDS key. */
const CARD_ICON: Record<string, ReactNode> = {
  clubs: (
    <>
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M2.5 20v-1.5a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4V20" />
      <path d="M16.5 4.25a3.5 3.5 0 0 1 0 6.5" />
      <path d="M18 14.6a4 4 0 0 1 3.5 3.9V20" />
    </>
  ),
  events: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <path d="m9 15.5 2 2 4-4" />
    </>
  ),
  races: (
    <>
      <path d="M5.5 21V3.5" />
      <path d="M5.5 4.75c3.4-2 6.4 2 9.8 0v7c-3.4 2-6.4-2-9.8 0z" />
    </>
  ),
};

/** Drawn QR data cells — scattered clear of the three corner finders. */
const QR_CELLS = [
  { x: 15, y: 2 },
  { x: 15, y: 14 },
  { x: 25, y: 14 },
  { x: 15, y: 25 },
  { x: 25, y: 25 },
];

export default function CommunitiesSection() {
  return (
    <section
      id="communities"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-teal-500">
            Communities
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,5vw,2.875rem)] font-extrabold uppercase leading-[1.02] tracking-tight text-mist">
            Train solo. Never alone.
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <svg viewBox="0 0 34 34" className="size-8 shrink-0 text-leaf-300" aria-hidden>
            <rect
              x="2"
              y="2"
              width="8"
              height="8"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="24"
              y="2"
              width="8"
              height="8"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="2"
              y="24"
              width="8"
              height="8"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            {QR_CELLS.map((cell) => (
              <rect
                key={`${cell.x}-${cell.y}`}
                x={cell.x}
                y={cell.y}
                width="3"
                height="3"
                fill="currentColor"
              />
            ))}
          </svg>
          <p className="max-w-[13rem] text-[0.8125rem] leading-snug text-mist/75">
            Add a buddy in seconds &mdash; just scan their code.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMMUNITY_CARDS.map((card) => (
          <div
            key={card.key}
            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-6"
          >
            <svg {...ICON} className="size-6 shrink-0 text-teal-500" aria-hidden>
              {CARD_ICON[card.key]}
            </svg>
            <h3 className="font-display text-[1.125rem] font-bold text-mist">
              {card.title}
            </h3>
            <p className="text-[0.9375rem] leading-relaxed text-mist/70">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PricingBand() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-leaf-500/25 bg-leaf-500/[0.06] p-7 sm:p-9">
          <h2 className="font-display text-[clamp(1.375rem,3.5vw,1.875rem)] font-extrabold uppercase text-leaf-300">
            Free to start
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-mist/80">
            Plans, GPS tracking, the workout log, Kamy, and communities &mdash;
            free on day one. No card, no trial clock.
          </p>
        </div>

        <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-7 sm:p-9">
          <h2 className="font-display text-[1.375rem] font-extrabold uppercase text-mist">
            Kamee Premium
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-mist/70">
            Removes ads and unlocks custom plans plus advanced weekly and monthly
            stats &mdash; when you&rsquo;re ready.
          </p>
        </div>
      </div>
    </section>
  );
}
