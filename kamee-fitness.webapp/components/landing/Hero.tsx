import type { CSSProperties } from "react";
import Image from "next/image";
import { StoreBadges } from "./StoreBadges";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-[34rem] overflow-hidden sm:min-h-[38rem] lg:min-h-[42rem]"
    >
      {/* Key art. Anchored right on narrow screens so Kamy stays in frame. */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/hero/keyart.webp"
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-[72%_center] sm:object-[64%_center] lg:object-center"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-950/85 via-ink-950/70 to-ink-950/95 lg:bg-gradient-to-r lg:from-ink-950/95 lg:via-ink-950/75 lg:to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8">
        <div className="flex w-full max-w-xl flex-col items-start gap-6 lg:max-w-2xl">
          <span
            className="reveal inline-flex items-center gap-2 rounded-full border border-leaf-500/30 bg-leaf-500/[0.08] px-4 py-2"
            style={{ "--d": "0.1s" } as CSSProperties}
          >
            <span className="blink size-1.5 rounded-full bg-leaf-400" />
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-leaf-300">
              Now on iOS &amp; Android
            </span>
          </span>

          <h1
            className="reveal font-display text-[clamp(2.25rem,7vw,4rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-mist"
            style={{ "--d": "0.22s" } as CSSProperties}
          >
            Strong and steady{" "}
            <span className="text-leaf-400">wins the race.</span>
          </h1>

          <p
            className="reveal max-w-lg text-[clamp(1rem,2.6vw,1.1875rem)] leading-relaxed text-mist/85"
            style={{ "--d": "0.34s" } as CSSProperties}
          >
            Real training plans, serious GPS tracking, and an AI coach named
            Kamy — built for progress that lasts, not burnout.
          </p>

          <div
            id="get-the-app"
            className="reveal scroll-mt-24"
            style={{ "--d": "0.46s" } as CSSProperties}
          >
            <StoreBadges placement="hero" />
          </div>

          <p
            className="reveal text-[0.8125rem] text-muted"
            style={{ "--d": "0.54s" } as CSSProperties}
          >
            Free to start · Live on Google Play &amp; the App Store
          </p>
        </div>
      </div>
    </section>
  );
}
