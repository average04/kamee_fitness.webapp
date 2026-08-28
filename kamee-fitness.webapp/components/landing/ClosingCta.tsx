import { StoreBadges } from "./StoreBadges";

export default function ClosingCta() {
  return (
    <section
      id="get-started"
      className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] px-6 py-14 sm:px-10 sm:py-16">
        {/* Halo behind the headline. Clipped by the card so it never widens the page. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(125,190,141,0.15), rgba(125,190,141,0) 68%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 size-[28rem] -translate-x-1/2 -translate-y-[55%] rounded-full border border-leaf-500/15"
        />

        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <h2 className="font-display text-[clamp(1.875rem,6vw,3.25rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.01em] text-mist">
            Start steady <span className="text-leaf-400">today.</span>
          </h2>

          <p className="max-w-md text-[0.9375rem] leading-relaxed text-mist/75 sm:text-base">
            Download Kamee, answer a few questions, and Kamy takes it from
            there.
          </p>

          <StoreBadges placement="closing" className="justify-center pt-1" />

          <p className="text-[0.8125rem] text-muted">
            Free to start · Live on Google Play &amp; the App Store
          </p>
        </div>
      </div>
    </section>
  );
}
