# Kamee Fitness — Launch Landing Page

**Date:** 2026-06-23
**Status:** Approved (build)

## Goal

Replace the pre-launch "coming soon" home page (`/`) with a full, scrolling
marketing landing page for the **app launch**: **iOS is live**, **Android is in
early access** (Google Play closed testing). The page should feel premium and
hand-crafted — not a generic template — and use a tasteful parallax effect. It
reuses the existing design language rather than introducing a new one.

This supersedes `2026-05-28-kamee-landing-coming-soon-design.md`. The waitlist
is retired from the page; downloads lead.

## Decisions locked in brainstorming

- **Route:** evolve the existing `/` into the launch page (no separate route).
- **Waitlist:** dropped. The hero leads with two store CTAs (App Store live,
  Google Play early access). The `WaitlistForm` component and `/api/waitlist`
  route are left in place but unused by this page (no deletion in scope).
- **Sections:** Hero + CTA, "What's inside" (features), "How to join" (Android
  early-access steps), FAQ. Plus header, final CTA band, footer.
- **Parallax:** both scroll-drift (background atmosphere) and pointer-tilt (hero
  visual). All motion disabled under `prefers-reduced-motion`.
- **Hero visual:** real iPhone-framed screenshots **and** a generated brand
  visual as the ambient back layer.

## Stack & location

- Inside the existing scaffold `kamee-fitness.webapp/` (Next.js 16 App Router,
  React 19, Tailwind 4, TypeScript). **No new runtime dependencies** — parallax
  is hand-rolled.
- Per `AGENTS.md`: this is a modified Next.js 16. Read the relevant guide in
  `node_modules/next/dist/docs/` before writing code; heed deprecation notices.

## Brand & voice (from the mobile app)

- Tagline / philosophy: **"Slow and steady wins the race."** ("The Kamee way.")
  Calm, encouraging, sustainable progress — never hype. Design system the app
  calls "Calm Confidence."
- Mascot: **Kamy**, a tortoise; shell-growth concentric-rings motif (already the
  `Atmosphere` rings).
- Palette (already in `globals.css`): ink green-black backgrounds, **leaf**
  greens (`#7dbe8d`/`#9bd2a8`), **ember** accent (`#e89150`), **sun** (`#efb54e`).
  Add **teal** (`#3FB6C0`) as the outdoor/track accent (new token).
- Type: Bricolage Grotesque (display) + Hanken Grotesk (body).
- **Anti-slop rules:** no "unlock your potential / transform your body /
  revolutionary," no emoji-bullet spam, no fabricated testimonials or stats. All
  feature copy is grounded in real app capabilities (below).

## Parallax — technical approach

Hand-rolled, no library (keeps the repo dependency-light and matches its
hand-crafted CSS animations).

- `useParallax.ts` — a client hook running a single `requestAnimationFrame`
  loop that writes CSS custom properties on a root element:
  `--scroll` (normalized scroll offset) and `--px`/`--py` (pointer position,
  -1..1, hero-relative). Layers consume them via
  `transform: translate3d(...)` / `rotateX/Y`.
- **Scroll drift:** `Atmosphere` glow + rings translate at a fraction of scroll
  speed behind foreground content.
- **Pointer tilt:** hero visual tilts toward the cursor; the generated brand
  visual (back layer) and the iPhone frame (front layer) move at different
  depths for a 3D feel. Pointer parallax is desktop-only (disabled on touch).
- **Reduced motion:** when `(prefers-reduced-motion: reduce)`, the hook is inert
  and all transforms reset to neutral — consistent with the existing
  `reveal`/`logo-in`/`ring-in` handling.

*Alternatives rejected:* a parallax/animation library (bundle weight, against the
grain); CSS-only scroll-timeline (can't do pointer tilt; cross-browser support
still uneven).

## Component structure

The current single-file `app/page.tsx` is refactored into focused, independently
understandable section components. `Atmosphere` and the store badge are extracted
from `page.tsx` so they can be reused and parallaxed.

```
app/page.tsx                  composes the sections (server component) + JSON-LD
components/landing/
  Atmosphere.tsx              extracted; now scroll-parallaxed
  Header.tsx                  sticky; transparent over hero, solidifies on scroll
  Hero.tsx                    headline, dual CTAs, pointer-tilt hero visual (client)
  PhoneFrame.tsx              CSS iPhone frame wrapping a screenshot (reused)
  Features.tsx                "What's inside" — alternating screenshot/text rows
  HowToJoin.tsx               Android early-access 3 steps
  Faq.tsx                     accordion (client; one open at a time)
  StoreBadges.tsx             extracted/reused: App Store (live) + Play (early access)
  Footer.tsx                  Terms · Privacy · Delete account · © 2026
  useParallax.ts              rAF scroll + pointer hook, reduced-motion aware
  features.ts                 feature data (title, body, accent, screenshot) — pure
  faq.ts                      FAQ data (q/a) — pure
```

The page stays mostly server-rendered; only `Hero`, `Faq`, `Header`, and the
parallax hook are client islands.

## Page flow (top → bottom)

1. **Header** (sticky) — logo + wordmark; right-side "Get the app" button.
   Transparent over the hero, gains an ink background + hairline border on scroll.
2. **Hero** —
   - Eyebrow: two status pills — `● Now on iOS` and `● Early access on Android`.
   - H1: **"Slow and steady wins the race."** (brand line; editable.)
   - Subhead: "Personalized plans, guided workouts, GPS tracking, and a coach
     named Kamy — built for steady progress, not burnout."
   - CTAs: App Store badge (live) + Google Play badge (with "Early access" label).
   - Visual: iPhone frame with `home.png` (front layer) over the generated brand
     visual (back layer); both pointer-tilt at different depths.
3. **What's inside** — six grounded features (below). Top three or four as
   alternating screenshot/text rows; the rest in a compact grid.
4. **How to join (Android early access)** — three steps:
   1. Tap **Join on Google Play** (opt in to testing via the web link).
   2. Install **Kamee** from Google Play.
   3. Open the app and start your first plan.
   Aside: "On iPhone? It's live — grab it from the App Store." CTA buttons repeat.
5. **FAQ** — accordion (below).
6. **Final CTA band** — brand line + both store buttons.
7. **Footer** — logo, © 2026 Kamee Fitness, links: Terms, Privacy, Delete account,
   contact email.

## "What's inside" — feature copy (grounded in real app behavior)

1. **Plans that fit you** — answer a few questions and Kamy hand-picks a
   multi-week plan for your level, goals, and equipment.
2. **Guided sessions** — every exercise demoed, set-by-set logging, rest timers,
   and form notes as you go.
3. **Track outdoors** *(teal accent)* — GPS walks & runs with a live route map,
   pace, elevation, and heart rate.
4. **Track Buddies** — connect by QR code and watch friends' runs move on the map
   in real time. (Standout feature.)
5. **Progress that sticks** — calendar heatmap, current & longest streaks, plus
   volume and distance stats.
6. **Coach Kamy** — an on-device AI coach you can ask "should I train or rest
   today?" anytime.

## FAQ content

- **Is Kamee free?** Yes — free to start. **Premium** removes ads and adds custom
  plans plus advanced weekly/monthly stats.
- **How do I send feedback during early access?** Email bayogjayr@gmail.com —
  early-access testers' reports go straight to the team.
- **When does Android fully launch?** Soon — early access is the final shakeout.
  (No hard date promised.)
- **Will my early-access data carry over?** Yes — your account and progress stay
  with you through the public release.
- **Is my data private?** Yes — see the [Privacy Policy](/privacy).

## Assets

**Real iPhone screenshots** (portrait PNGs in `public/screens/`), provided by the
user. Page ships with tasteful placeholders so nothing blocks on them:

- `home.png` — home dashboard (greeting, plan progress, streak ring, feed) → hero
- `session.png` — guided workout (exercise demo, set logging, timer)
- `track.png` — outdoor map session (live route + buddy + HR/pace)
- `progress.png` — calendar heatmap + streak/stats

**Generated brand visual** (`public/brand-visual.png`), the hero back layer.
Image-generator prompt:

> Serene abstract brand artwork for a calm fitness app. Centerpiece: a minimalist
> tortoise shell rendered as concentric organic growth rings, glowing softly from
> within. Palette: deep green-black background (#07090a), leaf-green light
> (#7dbe8d, #9bd2a8), a single warm ember-orange highlight (#e89150), faint golden
> sparks (#efb54e). Soft volumetric glow, fine film grain, subtle topographic
> contour lines suggesting a running trail winding through the rings. Mood: "calm
> confidence," premium, modern, meditative. Vertical 1024×1536 composition with
> empty negative space in the upper third for a headline. No text, no logos, no
> UI, no people. Dark, atmospheric digital illustration, painterly-meets-geometric.

## SEO / metadata (`app/layout.tsx`)

- Drop all "coming soon" framing; describe a live, launched app available on iOS
  and in early access on Android.
- Add an OG/Twitter image (the generated brand visual or a composed hero).
- JSON-LD `MobileApplication`: set `operatingSystem` to both iOS and Android
  (the app genuinely runs on both). `downloadUrl`/`installUrl` remain the public
  App Store listing; the Play link is closed-testing and not used as a crawlable
  download URL.

## Accessibility & performance

- `next/image` for all screenshots; the hero `home.png` is `priority`. Brand
  visual lazy unless it's above the fold (it is — so `priority` too).
- Alt text on every screenshot; decorative atmosphere layers are `aria-hidden`.
- All CTAs are real links/buttons, keyboard-focusable, with visible focus rings;
  the FAQ accordion is keyboard-operable with correct `aria-expanded`.
- Contrast meets WCAG AA against the ink background.
- Parallax respects `prefers-reduced-motion` (inert hook, neutral transforms).
- Keep client JS minimal (parallax hook + two small islands).

## Testing (vitest)

Proportionate to a largely visual page:

- Pure-data tests: `features.ts` and `faq.ts` shape/content sanity (non-empty,
  required fields, no placeholder strings left in).
- `useParallax` unit test: clamps pointer to -1..1; returns neutral values when
  reduced-motion is set.
- Render smoke test: `page.tsx` renders the hero headline, both store CTAs (with
  correct hrefs), all section headings, and the footer legal links.

## Out of scope (deferred)

- Removing the now-unused `WaitlistForm` / `/api/waitlist` (left intact).
- A dedicated standalone `/android` page (folded into this launch page).
- Localization, blog, pricing page, in-page video.
