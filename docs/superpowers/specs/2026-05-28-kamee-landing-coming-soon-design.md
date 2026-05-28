# Kamee Fitness — "Coming Soon" Landing Page

**Date:** 2026-05-28
**Status:** Approved (build)

## Goal

A fluid, dark, on-brand "the app is coming" landing page for the Kamee Fitness
mobile app, with an email waitlist backed by Supabase. The same web project will
later grow an admin panel for managing Supabase tables — out of scope for this
spec, but the waitlist table is its first managed resource.

## Stack & location

- Built inside the existing scaffold: `kamee-fitness.webapp/`
  (Next.js 16 App Router, React 19, Tailwind 4, TypeScript).
- One new dependency: `@supabase/supabase-js`.
- Mobile-first, single route (`/`). Structure leaves room for `/admin` later.

## Brand (from the mobile app)

- Palette: leaf green primary `#3F8E53`/`#7DBE8D`, ember accent `#CF6B2D`,
  sun yellow `#EFB54E`, deep ink background `#0E1416`.
- Logo: green "K"-shell monogram — `adaptive-icon.png`.
- Mascot: muscular green turtle (not used in the monogram-led hero; reserved).
- Source assets: `D:\Projects\kamee-fitness\Fitness app\assets`.

## Page design (dark & bold, monogram-led)

Single fluid page on deep ink with a soft green radial glow behind the logo:

1. **Eyebrow:** "COMING SOON".
2. **Hero:** large glowing K-shell monogram + "Kamee Fitness" wordmark + tagline
   (placeholder, editable): *"Train smarter. Move better. Your pocket coach is
   almost here."*
3. **Waitlist form:** email field + "Join the waitlist" → inline success state.
4. **Store row:** styled, non-clickable "iOS — coming soon" and
   "Android — coming soon" badges (app targets both per `app.json`).
5. **Footer:** © Kamee Fitness + small monogram.

**"Fluid"** = `clamp()` fluid type, mobile-first responsive layout, smooth
entrance/hover transitions, spacing that scales phone → desktop.

## Waitlist data flow

- **Table** `public.waitlist`: `id uuid pk default gen_random_uuid()`,
  `email citext unique not null`, `created_at timestamptz default now()`,
  `source text default 'landing'`, `user_agent text`. RLS **enabled**.
- **RLS:** insert-only policy for the `anon` role; no select/update/delete for
  anon. (Admin reads later via authenticated/service path.)
- **Write path:** Next.js Route Handler `POST /api/waitlist` validates the email
  server-side and inserts via `@supabase/supabase-js` using the **publishable
  (anon) key**. No service-role key in the webapp. Handles duplicate email
  gracefully (treat as success). Room to add honeypot/rate-limit later.
- **Migration:** new timestamped file added to the mobile app's
  `supabase/migrations/` (single source of truth) and applied to the live
  `kamee_fitness` project (ref `ywkqixaobbjxdncvnqav`) — confirm before applying
  to remote.

## Config / secrets

- `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable). Service-role key is never used
  here and never committed.

## Files

- `app/layout.tsx` — metadata, OG (monogram), favicon, fonts
- `app/page.tsx` — composes the sections (server component)
- `app/globals.css` — brand tokens as CSS vars
- `components/WaitlistForm.tsx` — client form
- `app/api/waitlist/route.ts` — POST handler
- `lib/supabase.ts` — server client factory
- `public/` — `adaptive-icon.png`, wordmark, favicon

## Out of scope (deferred)

- Admin dashboard for managing Supabase tables. The locked-down `waitlist` table
  is its foundation.
