"use client";

import { useScrollParallax } from "./useParallax";

/** Fixed, decorative background: glow, concentric shell rings, grain. Drifts on scroll. */
export default function Atmosphere() {
  const ref = useScrollParallax<HTMLDivElement>();
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [--scroll-y:0]"
    >
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ transform: "translate3d(0, calc(var(--scroll-y) * -0.04px), 0)" }}
      >
        <div className="hero-glow [grid-area:1/1] size-[min(130vw,950px)] rounded-full blur-2xl" />
        <div
          className="ring ring-in [grid-area:1/1] size-[min(78vw,360px)]"
          style={{ "--d": "0.3s" } as React.CSSProperties}
        />
        <div
          className="ring ring-in [grid-area:1/1] size-[min(110vw,560px)]"
          style={{ "--d": "0.45s" } as React.CSSProperties}
        />
        <div
          className="ring ring-in [grid-area:1/1] size-[min(150vw,820px)]"
          style={{ "--d": "0.6s" } as React.CSSProperties}
        />
      </div>
      <div className="grain absolute inset-0" />
    </div>
  );
}
