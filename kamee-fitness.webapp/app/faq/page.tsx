import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HELP_FAQ } from "@/lib/landing/content";
import styles from "./faq.module.css";

const FAQ_DESCRIPTION =
  "Answers to the common questions about Kamee Fitness — tracking, syncing, the Fuel Log, Premium billing and your account.";

export const metadata: Metadata = {
  title: "FAQ",
  description: FAQ_DESCRIPTION,
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "FAQ · Kamee Fitness",
    description: FAQ_DESCRIPTION,
    url: "/faq",
    siteName: "Kamee Fitness",
    type: "website",
    images: [
      {
        url: "/adaptive-icon.png",
        width: 1024,
        height: 1024,
        alt: "Kamee Fitness",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ · Kamee Fitness",
    description: FAQ_DESCRIPTION,
    images: ["/adaptive-icon.png"],
  },
};

/** Own date, deliberately not the Terms/Privacy LAST_UPDATED. */
const FAQ_UPDATED = "September 23, 2026";
const ANSWER_COUNT = HELP_FAQ.reduce(
  (total, section) => total + section.items.length,
  0,
);

const SECTION_TONES: Record<
  string,
  { accent: string; icon: string; title: string }
> = {
  "getting-started": {
    accent: "bg-leaf-500",
    icon: "border-leaf-500/25 bg-leaf-500/10 text-leaf-300",
    title: "text-leaf-300",
  },
  tracking: {
    accent: "bg-teal-500",
    icon: "border-teal-500/25 bg-teal-500/10 text-teal-500",
    title: "text-teal-500",
  },
  fuel: {
    accent: "bg-fuel-500",
    icon: "border-fuel-500/25 bg-fuel-500/10 text-fuel-100",
    title: "text-fuel-100",
  },
  account: {
    accent: "bg-ink-300",
    icon: "border-white/10 bg-white/5 text-ink-200",
    title: "text-ink-100",
  },
  help: {
    accent: "bg-ember-500",
    icon: "border-ember-500/25 bg-ember-500/10 text-ember-400",
    title: "text-ember-400",
  },
};

function CategoryIcon({ id }: { id: string }) {
  if (id === "tracking") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d="M12 3a7 7 0 0 0-7 7c0 5.25 7 11 7 11s7-5.75 7-11a7 7 0 0 0-7-7Zm0 9.25A2.25 2.25 0 1 1 12 7.75a2.25 2.25 0 0 1 0 4.5Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (id === "fuel") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d="M12 21c4.25 0 7-2.85 7-6.75 0-3.12-1.95-5.76-5.84-9.62a1.63 1.63 0 0 0-2.32 0C6.95 8.49 5 11.13 5 14.25 5 18.15 7.75 21 12 21Z"
          fill="currentColor"
        />
        <path d="M12 7.2v9.3" stroke="#07090a" strokeWidth="1.6" />
      </svg>
    );
  }

  if (id === "account") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.6-3.55 3.13-5.5 7-5.5s6.4 1.95 7 5.5H5Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (id === "help") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          d="M5 4.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-7l-4.7 3.4c-.53.38-1.3 0-1.3-.66V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"
          fill="currentColor"
        />
        <path d="M7.5 9h9M7.5 12.5h6" stroke="#07090a" strokeWidth="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="m12 2 2.12 6.16L20.5 10l-6.38 1.84L12 18l-2.12-6.16L3.5 10l6.38-1.84L12 2Z"
        fill="currentColor"
      />
      <circle cx="18.25" cy="17.75" r="2.25" fill="currentColor" />
    </svg>
  );
}

function CategoryLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label="FAQ categories"
      className={
        mobile
          ? `${styles.categoryScroller} overflow-x-auto px-4 py-3`
          : "sticky top-8"
      }
    >
      <p className={mobile ? "sr-only" : "mb-4 text-sm font-semibold text-mist"}>
        Browse by topic
      </p>
      <ul
        className={
          mobile
            ? "flex w-max items-center gap-2"
            : "space-y-1.5 border-l border-white/8 pl-4"
        }
      >
        {HELP_FAQ.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={
                mobile
                  ? "flex min-h-11 items-center whitespace-nowrap rounded-full border border-white/10 bg-ink-900 px-4 text-sm font-medium text-ink-200 transition-colors hover:border-leaf-500/30 hover:text-leaf-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400"
                  : "block rounded-lg px-2 py-2.5 text-sm font-medium text-ink-300 transition-colors hover:bg-white/5 hover:text-leaf-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400"
              }
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The web help page opened by the mobile app's Settings → Help → FAQs row.
 * Answers stay expanded so a person with a problem can scan or find text
 * without opening a stack of accordions.
 */
export default function FaqPage() {
  return (
    <main className={`${styles.page} relative min-h-screen overflow-x-clip bg-ink-950 text-ink-100`}>
      <a
        href="#faq-answers"
        className={`${styles.skipLink} rounded-full bg-leaf-400 px-4 py-3 font-semibold text-ink-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mist`}
      >
        Skip to answers
      </a>
      <div className="grain pointer-events-none fixed inset-0 z-20" aria-hidden="true" />
      <div
        className={`${styles.pageGlow} pointer-events-none absolute inset-x-0 top-0 h-[42rem]`}
        aria-hidden="true"
      />

      <header className={`${styles.siteHeader} relative z-30 border-b border-white/8`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Kamee Fitness home"
            className="flex min-h-11 items-center gap-3 rounded-full pr-3 font-display focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400"
          >
            <Image
              src="/adaptive-icon.png"
              alt=""
              width={36}
              height={36}
              className="size-9"
            />
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-mist">
              Kamee <span className="hidden sm:inline">Fitness</span>
            </span>
          </Link>
          <span className="rounded-full border border-leaf-500/20 bg-leaf-500/8 px-3 py-1.5 text-sm font-medium text-leaf-300">
            Help centre
          </span>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 pb-14 pt-14 sm:px-6 sm:pb-18 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8 lg:pb-24 lg:pt-24">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold text-leaf-400">Kamee support</p>
          <h1 className="max-w-[13ch] font-display text-[clamp(2.85rem,8vw,5.5rem)] font-extrabold leading-[0.94] tracking-[-0.045em] text-mist">
            Find your answer. Keep moving.
          </h1>
          <p className="mt-6 max-w-[58ch] text-lg leading-8 text-ink-300 sm:text-xl">
            Clear help for tracking, Fuel, Premium and your account—written for
            people who already have Kamee in their pocket.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-400">
            <span>{ANSWER_COUNT} quick answers</span>
            <span className="hidden size-1 rounded-full bg-ink-600 sm:block" aria-hidden="true" />
            <span>Updated {FAQ_UPDATED}</span>
          </div>
        </div>

        <div className={`${styles.heroArtwork} relative mx-auto hidden aspect-square w-full max-w-[20rem] place-items-center lg:grid`} aria-hidden="true">
          <div className={`${styles.heroRing} absolute inset-0 rounded-full`} />
          <div className={`${styles.heroRing} absolute inset-[14%] rounded-full`} />
          <div className={`${styles.heroRing} absolute inset-[28%] rounded-full`} />
          <div className={`${styles.mascotGlow} absolute inset-[32%] rounded-full`} />
          <Image
            src="/adaptive-icon.png"
            alt=""
            width={152}
            height={152}
            className="relative z-10 size-38 drop-shadow-[0_22px_50px_rgba(91,165,107,0.2)]"
          />
        </div>
      </section>

      <div className={`${styles.categoryNav} sticky top-0 z-30 border-y border-white/8 bg-ink-950/90 backdrop-blur-xl lg:hidden`}>
        <CategoryLinks mobile />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:pb-32">
        <aside className={`${styles.categoryNav} hidden lg:block`}>
          <CategoryLinks />
        </aside>

        <article id="faq-answers" tabIndex={-1} className="min-w-0 max-w-3xl scroll-mt-24 space-y-6 lg:scroll-mt-8">
          {HELP_FAQ.map((section) => {
            const tone = SECTION_TONES[section.id] ?? SECTION_TONES.account;

            return (
              <section
                key={section.id}
                id={section.id}
                className={`${styles.printSurface} relative scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-white/8 bg-ink-900/80 shadow-[0_24px_80px_rgba(0,0,0,0.18)] lg:scroll-mt-8`}
              >
                <div className={`absolute inset-x-0 top-0 h-px ${tone.accent}`} aria-hidden="true" />
                <div className="flex items-center gap-4 px-5 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-2xl border ${tone.icon}`}>
                    <CategoryIcon id={section.id} />
                  </span>
                  <div>
                    <p className="text-sm text-ink-400">
                      {section.items.length} {section.items.length === 1 ? "answer" : "answers"}
                    </p>
                    <h2 className={`font-display text-2xl font-bold tracking-tight sm:text-3xl ${tone.title}`}>
                      {section.label}
                    </h2>
                  </div>
                </div>

                <div className="border-t border-white/8 px-5 sm:px-8">
                  {section.items.map((item) => (
                    <div key={item.q} className="border-b border-white/8 py-6 last:border-b-0 sm:py-7">
                      <h3 className="font-display text-lg font-semibold leading-snug text-mist sm:text-xl">
                        {item.q}
                      </h3>
                      <p className="mt-3 max-w-[68ch] text-[1.02rem] leading-7 text-ink-300">
                        {item.q === "Is my data private?" ? (
                          <>
                            Yes. See our{" "}
                            <a
                              href="/privacy"
                              className="rounded-sm text-leaf-400 underline decoration-leaf-500/45 underline-offset-4 hover:text-leaf-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400"
                            >
                              Privacy Policy
                            </a>{" "}
                            for exactly what we store and why.
                          </>
                        ) : (
                          item.a
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section
            aria-label="Contact Kamee support"
            className={`${styles.printSurface} relative overflow-hidden rounded-[1.75rem] border border-leaf-500/20 bg-leaf-500/8 px-5 py-7 sm:px-8 sm:py-9`}
          >
            <div className={`${styles.supportGlow} pointer-events-none absolute inset-y-0 right-0 w-2/3`} aria-hidden="true" />
            <div className="relative max-w-xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-mist sm:text-3xl">
                Need a hand from us?
              </h2>
              <p className="mt-3 leading-7 text-ink-300">
                In Kamee, open Settings → Help to report a bug with your app
                and device details attached. For anything else, email the
                support team.
              </p>
              <a
                href="mailto:support@kamee.fit"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-leaf-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-leaf-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-300"
              >
                Email support
              </a>
            </div>
          </section>
        </article>
      </div>

      <footer className="relative z-10 border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-sm text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/adaptive-icon.png" alt="" width={24} height={24} className="size-6" />
            <span>© 2026 Kamee Fitness</span>
          </div>
          <nav aria-label="FAQ footer" className="flex flex-wrap gap-x-5 gap-y-1">
            <a href="/privacy" className="flex min-h-11 items-center hover:text-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400">
              Privacy
            </a>
            <a href="/terms" className="flex min-h-11 items-center hover:text-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400">
              Terms
            </a>
            <Link href="/" className="flex min-h-11 items-center hover:text-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-400">
              kamee.fit
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
