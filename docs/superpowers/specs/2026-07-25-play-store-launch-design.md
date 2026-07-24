# Play Store launch — flip the site from "early access" to "live on Android"

**Date:** 2026-07-25
**Status:** Approved (autonomous session; user directive: "we got approved in Google Play, update the web app")

## Context

The Android app was approved and is now public on Google Play:
`https://play.google.com/store/apps/details?id=com.kamee.fitness`

The site still presents Android as a closed beta: the Play link points at the
testing opt-in URL, the landing page has a 4-step "join the testers group"
section, and "early access" appears in the hero, FAQ, store badges, and meta
descriptions.

We link the clean listing URL (without `pcampaignid=web_share` — that query
param is Play's share-sheet attribution tag, not part of the listing URL, and
would mislabel our site traffic in Play Console stats).

## Changes

1. **`lib/landing/stores.ts`** — `PLAY_STORE_URL` becomes the public listing
   URL. `TESTERS_GROUP_URL` is deleted (the closed test is over); its usages go
   with it.
2. **`components/landing/HowToJoin.tsx` → `GetStarted.tsx`** — the tester
   onboarding section becomes a 3-step "get started" section (install → answer
   a few questions → start your plan) with both store badges. Section id
   `#join` → `#get-started` (nothing links to `#join`).
3. **`components/landing/StoreBadges.tsx`** — drop the `eyebrow="Early
   access"` override on the Android badge so it renders the default
   "Download on the / Google Play".
4. **`app/plans/[id]/page.tsx`** — same eyebrow removal on the plan page's
   Android badge.
5. **`components/landing/Hero.tsx`** — the two status pills ("Now on iOS",
   "Early access on Android") merge into one: "Now on iOS & Android".
6. **`lib/landing/content.ts`** — FAQ keeps five entries: "free?" and
   "private?" stay; "feedback during early access" loses the early-access
   framing; "when does Android launch?" becomes "where can I download?";
   "does early-access data carry over?" is reworded for existing testers
   transitioning to the public release.
7. **`app/layout.tsx`** — the three descriptions (meta, OpenGraph, Twitter)
   say "Free on iOS and Android" instead of "early access on Android".
8. **`app/page.tsx`** — JSON-LD: `PLAY_STORE_URL` joins `sameAs`, and
   `downloadUrl`/`installUrl` become two-element arrays. Import of
   `HowToJoin` becomes `GetStarted`.
9. **`lib/landing/content.test.ts`** — Play URL assertion targets
   `play.google.com/store/apps/details?id=com.kamee.fitness`; the
   testers-group assertion and import are removed.

Out of scope: legal MDX (already store-agnostic), the partner API
(`planAppUrl`/`planWebUrl` are store-independent), assetlinks/app-ads (need
signing-key fingerprints from the mobile repo — separate task).

## Verification

`npm test`, `npm run lint`, `npm run build`, then a multi-agent diff review.
