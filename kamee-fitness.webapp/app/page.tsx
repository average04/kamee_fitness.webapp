import Image from "next/image";
import WaitlistForm from "@/components/WaitlistForm";

const SITE_URL = "https://kamee.fitness";

const APP_STORE_URL =
  "https://apps.apple.com/app/kamee-fitness-658c0e/id6772307537";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kamee Fitness",
      url: SITE_URL,
      logo: `${SITE_URL}/adaptive-icon.png`,
      sameAs: [APP_STORE_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Kamee Fitness",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "MobileApplication",
      name: "Kamee Fitness",
      operatingSystem: "iOS",
      applicationCategory: "HealthApplication",
      url: SITE_URL,
      downloadUrl: APP_STORE_URL,
      installUrl: APP_STORE_URL,
      image: `${SITE_URL}/adaptive-icon.png`,
      description:
        "Personal workout and training app built on steady, sustainable progress.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Atmosphere />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col px-6">
        {/* ---- Top bar ---- */}
        <header className="reveal flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <Image
              src="/adaptive-icon.png"
              alt=""
              width={32}
              height={32}
              priority
              className="size-7"
            />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-mist">
              Kamee Fitness
            </span>
          </div>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-muted sm:block">
            Est. 2026
          </span>
        </header>

        {/* ---- Hero ---- */}
        <main className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <span
            className="reveal inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-leaf-300"
            style={{ "--d": "0.1s" } as React.CSSProperties}
          >
            <span className="blink size-1.5 rounded-full bg-leaf-400" />
            Now on iOS
          </span>

          {/* Logo with breathing glow */}
          <div
            className="logo-in relative mt-9"
            style={{ "--d": "0.2s" } as React.CSSProperties}
          >
            <div className="logo-glow glow-pulse pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[180%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl" />
            <Image
              src="/adaptive-icon.png"
              alt="Kamee Fitness logo"
              width={200}
              height={200}
              priority
              className="h-auto w-[clamp(110px,26vw,180px)] drop-shadow-[0_0_28px_rgba(125,190,141,0.35)]"
            />
          </div>

          <h1
            className="reveal mt-8 font-display text-[clamp(2.5rem,9vw,4.75rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.01em] text-mist"
            style={{ "--d": "0.34s" } as React.CSSProperties}
          >
            Kamee <span className="text-leaf-400">Fitness</span>
          </h1>

          <p
            className="reveal mt-6 max-w-md text-balance font-display text-[clamp(1.15rem,3.2vw,1.5rem)] font-medium leading-snug text-mist/90"
            style={{ "--d": "0.46s" } as React.CSSProperties}
          >
            Slow and steady wins the race.
          </p>

          <div
            className="reveal mt-9 w-full max-w-md"
            style={{ "--d": "0.58s" } as React.CSSProperties}
          >
            <WaitlistForm />
            <p className="mt-3 text-xs text-muted/70">
              No spam — just one email the day we launch.
            </p>
          </div>

          {/* Store availability */}
          <div
            className="reveal mt-10 flex flex-wrap items-center justify-center gap-3"
            style={{ "--d": "0.7s" } as React.CSSProperties}
          >
            <StoreBadge platform="ios" href={APP_STORE_URL} />
            <StoreBadge platform="android" />
          </div>
        </main>

        {/* ---- Footer ---- */}
        <footer
          className="reveal border-t border-white/5 py-6 text-xs text-muted"
          style={{ "--d": "0.82s" } as React.CSSProperties}
        >
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <span>© 2026 Kamee Fitness. All rights reserved.</span>
            <nav className="flex gap-5">
              <a href="/terms" className="hover:text-white">
                Terms
              </a>
              <a href="/privacy" className="hover:text-white">
                Privacy
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Decorative background: glow, concentric shell rings, grain, edge fade. */
function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 grid place-items-center">
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
      <div className="bottom-fade absolute inset-x-0 bottom-0 h-40" />
    </div>
  );
}

function StoreBadge({
  platform,
  href,
}: {
  platform: "ios" | "android";
  href?: string;
}) {
  const isIos = platform === "ios";
  const live = Boolean(href);
  const storeName = isIos ? "App Store" : "Google Play";

  const className =
    "flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors " +
    (live
      ? "border-leaf-500/40 bg-leaf-500/[0.07] hover:border-leaf-400/60 hover:bg-leaf-500/[0.12]"
      : "border-white/10 bg-white/[0.03] hover:border-leaf-500/30");

  const inner = (
    <>
      <span className="text-leaf-400/90">
        {isIos ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
            <path d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.95-3.4-2.22-4.13-2.25-1.76-.18-3.43 1.04-4.32 1.04-.89 0-2.26-1.02-3.72-.99-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.95 1.37 2.08 2.91 3.56 2.85 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.72.89 1.54-.03 2.51-1.4 3.45-2.78 1.09-1.59 1.54-3.13 1.56-3.21-.03-.01-2.99-1.15-3.02-4.55zM14.13 4.62c.79-.96 1.32-2.29 1.18-3.62-1.14.05-2.52.76-3.33 1.72-.73.85-1.37 2.2-1.2 3.5 1.27.1 2.57-.65 3.35-1.6z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden>
            <path d="M4 3.42v17.16a.6.6 0 0 0 .9.52l14.4-8.58a.6.6 0 0 0 0-1.04L4.9 2.9a.6.6 0 0 0-.9.52z" />
          </svg>
        )}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-leaf-400/80">
          {live ? "Download on the" : "Coming soon"}
        </span>
        <span className="font-display text-sm font-semibold text-mist">
          {storeName}
        </span>
      </span>
    </>
  );

  if (live) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Download Kamee Fitness on the ${storeName}`}
        className={className}
      >
        {inner}
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}
