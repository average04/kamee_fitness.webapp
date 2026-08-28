import Image from "next/image";
import { BADGES, BADGE_TOTAL } from "@/lib/landing/content";

// The 5K PR emblem is a shield, not a disc — it gets a rounded-square mask.
const SHIELD_KEY = "pr-5k";

export default function ProgressBand() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] p-6 sm:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
          <div className="lg:flex-1">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.3em] text-sun-500">
              Progress
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.5rem,4vw,2.375rem)] font-extrabold uppercase leading-[1.04] tracking-tight text-mist">
              {`PRs, shields, and ${BADGE_TOTAL} badges worth chasing.`}
            </h2>
            <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-mist/75">
              Best efforts across every standard distance, streaks that keep you
              honest, and a full-screen celebration when a badge or PR lands.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:shrink-0 lg:justify-end">
            {BADGES.map((b) => (
              <Image
                key={b.key}
                src={`/badges/${b.key}.webp`}
                alt={b.alt}
                width={208}
                height={208}
                className={
                  "size-[4.5rem] shadow-[0_14px_30px_-8px_rgba(0,0,0,0.6)] sm:size-24 " +
                  (b.key === SHIELD_KEY ? "rounded-2xl" : "rounded-full")
                }
              />
            ))}
            <div className="grid size-[4.5rem] place-items-center rounded-full border border-dashed border-mist/30 text-[0.875rem] font-bold text-muted sm:size-24">
              {`+${BADGE_TOTAL - BADGES.length}`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
