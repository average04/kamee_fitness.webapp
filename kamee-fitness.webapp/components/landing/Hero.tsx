"use client";

import Image from "next/image";
import { usePointerTilt } from "./useParallax";
import PhoneFrame from "./PhoneFrame";
import { StoreBadges } from "./StoreBadges";

export default function Hero() {
  const tilt = usePointerTilt<HTMLDivElement>();

  return (
    <section
      id="top"
      className="relative mx-auto max-w-6xl px-6 pb-20 pt-28 sm:pt-32"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Copy */}
        <div className="text-center lg:text-left">
          <div
            className="reveal flex flex-wrap items-center justify-center gap-2.5 lg:justify-start"
            style={{ "--d": "0.1s" } as React.CSSProperties}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-leaf-300">
              <span className="blink size-1.5 rounded-full bg-leaf-400" /> Now on
              iOS
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-ember-400">
              <span className="blink size-1.5 rounded-full bg-ember-400" /> Early
              access on Android
            </span>
          </div>

          <h1
            className="reveal mt-7 font-display text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-mist"
            style={{ "--d": "0.22s" } as React.CSSProperties}
          >
            Slow and steady <span className="text-leaf-400">wins the race.</span>
          </h1>

          <p
            className="reveal mx-auto mt-6 max-w-md text-balance text-[clamp(1.05rem,2.6vw,1.3rem)] leading-snug text-mist/85 lg:mx-0"
            style={{ "--d": "0.34s" } as React.CSSProperties}
          >
            Personalized plans, guided workouts, GPS tracking, and a coach named
            Kamy — built for steady progress, not burnout.
          </p>

          <div
            id="get-the-app"
            className="reveal mt-9 flex scroll-mt-24 flex-wrap justify-center gap-3 lg:justify-start"
            style={{ "--d": "0.46s" } as React.CSSProperties}
          >
            <StoreBadges />
          </div>
          <p
            className="reveal mt-3 text-xs text-muted/70"
            style={{ "--d": "0.54s" } as React.CSSProperties}
          >
            Free to start · iPhone &amp; Android
          </p>
        </div>

        {/* Visual */}
        <div
          ref={tilt}
          className="logo-in relative mx-auto w-[clamp(220px,60vw,320px)] [perspective:1200px]"
          style={{ "--d": "0.3s" } as React.CSSProperties}
        >
          <div
            className="relative"
            style={{
              transform:
                "rotateY(calc(var(--px,0) * 6deg)) rotateX(calc(var(--py,0) * -6deg))",
              transition: "transform 0.2s ease-out",
            }}
          >
            {/* back layer: brand visual (optional, hides if absent) */}
            <div
              className="pointer-events-none absolute -inset-10 -z-10"
              style={{
                transform:
                  "translate3d(calc(var(--px,0) * -14px), calc(var(--py,0) * -14px), 0)",
              }}
            >
              <Image
                src="/brand-visual.png"
                alt=""
                fill
                className="object-contain opacity-70 blur-[1px]"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            {/* front layer: phone */}
            <div
              style={{
                transform:
                  "translate3d(calc(var(--px,0) * 10px), calc(var(--py,0) * 10px), 0)",
              }}
            >
              <PhoneFrame src="/screens/home.png" alt="Kamee Fitness home screen" priority />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
