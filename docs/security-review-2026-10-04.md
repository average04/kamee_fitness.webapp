# Kamee Fitness — Security Audit (2026-10-04)

**Scope:** both repositories at `claude/clever-davinci-8scdvs`:

- `kamee_fitness.app`: Expo / React Native app, 185 Supabase migrations, 11 edge functions
- `kamee_fitness.webapp`: Next.js 16 site, admin backoffice, `/me`, Coaching Hub, partner API

**Method:** static review only. I computed the final database state by replaying every migration's
`CREATE`/`DROP`/`GRANT`/`REVOKE` and policy statement in order (219 SECURITY DEFINER functions,
about 140 live RLS policies, storage policies), then read the relevant function bodies by hand. I scanned
both git histories for secrets and ran `npm audit` on both apps.
**Not covered:** the live Supabase project, Netlify, RevenueCat or EAS settings, and any running
exploitation. If the live database has drifted from the migrations, this review won't see it.

---

## Summary

The backend is in good shape. Every public table has RLS enabled. Privileged profile columns
(`is_premium`, `role`, `coach_status`) are locked twice, by column grants and by a trigger. Every SECURITY DEFINER
function sets `search_path`, and its grants revoke the Supabase default `anon` EXECUTE. Paid and coach
content is gated behind purchase or authorship. Storage buckets are scoped to owners. Edge functions
check either a JWT or a shared secret compared in constant time. Most findings from the June review are fixed.

The most important new finding is in the mobile app. **Opening a buddy-invite link accepts the
invite without asking.** That silently creates a two-way follow, which then shares the victim's live
GPS position and route with the inviter on every run.

| # | Severity | Finding |
|---|----------|---------|
| H1 | **High** | Buddy-invite deep link auto-accepts and starts live-location sharing with no consent step |
| M1 | Medium | Rate-limit client IP comes from a header the client can spoof (`cf-connecting-ip`), so all app-layer limits can be bypassed |
| M2 | Medium | `next@16.2.6` has critical/high advisories (proxy bypass, Server Actions DoS); `sharp` and `postcss` are also vulnerable |
| L1 | Low | Admin demo-video URL is still unvalidated and rendered as a link (`javascript:` possible); carried over from June L7 |
| L2 | Low | Admin inline actions still return raw Postgres `error.message`; carried over from June L8 |
| L3 | Low | `waitlist` is still insertable directly with the anon key (`WITH CHECK (true)`), which skips the route's rate limit |
| L4 | Low | `are_mutual_follows(a, b)` lets any signed-in user check the follow graph of arbitrary pairs, private accounts included |
| L5 | Low | RevenueCat webhook doesn't reject `SANDBOX` events, so sandbox/TestFlight purchases grant production premium |
| L6 | Low | CSP still has no `script-src` / `connect-src` / `img-src` (partial fix of June M2) |
| L7 | Low | Mobile `npm audit`: 63 advisories (2 critical), mostly build tooling |
| I1 | Info | `requireAdmin()` trusts `user.email` without checking `email_confirmed_at` |

---

## High

### H1: Buddy-invite deep link auto-accepts → silent mutual follow + live GPS sharing

**Where**
- `kamee_fitness.app/app/buddy/invite.tsx:18-33`: `useEffect` calls `acceptInvite(token)` as soon as
  the screen mounts. There is no confirmation and no information about who sent the invite.
- `supabase/migrations/20260902120000_buddy_invite_consume_on_block.sql` → `public.accept_buddy_invite`
  inserts **both** `follows` rows with `status = 'accepted'`. That skips the private-account approval
  that `follow_user` would otherwise require.
- `src/hooks/useBuddyLive.ts:163-183`: during any track session with at least one accepted buddy, the
  app upserts `buddy_live_cache` (`last_point`, a 200-point `trail`, pace, distance) every 10 s. It also
  configures the native background publishers to broadcast every fix to the `track-buddy:*` realtime
  channel.
- `buddy_live_cache` RLS (`live_cache_buddy_read`) lets any mutual follow read that row.

**Exploit:** the attacker creates a buddy invite and gets the victim to open
`kamee://buddy/invite?token=<id>`, for example from a web page that redirects to the scheme, a QR code
or a chat message. A single tap (or the iOS "Open in Kamee?" prompt) is enough. The invite is consumed,
the two accounts follow each other, and from the victim's next run onward the attacker can watch their
live position and route, including from home. The only sign is a "You're now following each other"
screen afterwards.

**Fix**
1. Show a confirmation screen first: the inviter's avatar, name and username, plus "This person will
   see your live location while you run", with explicit **Accept** / **Decline** buttons. Call
   `acceptInvite` only on Accept. (The group-join screen already works this way with `handleJoin`.)
2. Defence in depth: make live sharing a per-buddy or per-run opt-in. Mutual-follow status alone
   shouldn't be enough. Also show a visible "N buddies can see you" indicator during a run.
3. Optionally, have `accept_buddy_invite` respect `is_private` the same way `follow_user` does.

---

## Medium

### M1: Rate-limit key can be spoofed on Netlify

**Where:** `kamee-fitness.webapp/lib/rate-limit.ts:45-51`
```ts
headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || ...
```
The site runs on Netlify, not behind Cloudflare. Nothing sets or strips `cf-connecting-ip`, so a
client can send any value and get a fresh rate-limit bucket on every request. That defeats all three
limiters: `/api/waitlist`, `submitDeletionRequest`, and anything added later. The same spoofed value
is also passed to Turnstile as `remoteip`.

The limiter also **fails open** without logging after the first warning when
`UPSTASH_REDIS_REST_URL`/`TOKEN` are unset or Upstash errors. Confirm those variables are set in Netlify.

**Fix:** read `x-nf-client-connection-ip`, which Netlify sets and clients can't override. Fall back
to `"unknown"`, not to client-supplied headers. Drop `cf-connecting-ip` unless the site is moved
behind Cloudflare.

### M2: Vulnerable Next.js and transitive dependencies (webapp)

`npm audit --omit=dev`: `next@16.2.6` is **critical**. Its advisories include a middleware/proxy
bypass under Turbopack, a Server Actions DoS and SSRF on custom servers. `sharp` (libvips/libheif
CVEs) and `postcss` are **high**, and `nanoid` is high.

The proxy bypass has limited impact here: I checked that every `/admin`, `/me` and `/coaching` page,
layout, route handler and Server Action calls `requireAdmin`/`requireUser`/`requireCoach` itself. The
DoS still applies. **Fix:** upgrade `next` to the latest 16.3.x patch (16.3.8 at time of writing),
run `npm audit fix`, and redeploy.

---

## Low

### L1: Admin demo-video URL is unvalidated (still open from June L7)
`app/admin/(panel)/exercises/actions.ts:156-169` (`setDemoVideo`) stores any string, and
`components/admin/VideoUrlCell.tsx` renders it as `<a href={openHref}>`, so a `javascript:` URL
becomes clickable. Both writing and reading require an admin, so the risk is one admin targeting
another. The mobile app is safe because it only passes the value through `parseYoutubeId`.
**Fix:** on write, require `https://` on `youtube.com`/`youtu.be`, at most 500 chars. Apply the same
rule in `validateExerciseInput`. Render the link only when the value matches `^https?://`.

### L2: Raw database errors returned to the client (still open from June L8)
`exercises/actions.ts` (`setDemoVideo`, `setVerified`) and `plans/actions.ts` toggles return
`error.message`. These are admin-only. **Fix:** return a generic message and `console.error` the
original.

### L3: Waitlist can be written directly with the anon key
`supabase/migrations/20260528000000_waitlist.sql:23-30` grants `INSERT` to `anon` with
`WITH CHECK (true)`. The route-level rate limit and email validation can be skipped by POSTing to
`/rest/v1/waitlist` with the public key. Only `char_length(email) between 3 and 320` is enforced.
**Fix:** revoke `insert` from `anon, authenticated`, then insert from the route with the service role
behind Turnstile and the M1 limiter. Alternatively, add an email-shape `CHECK`.

### L4: Follow-graph oracle via `are_mutual_follows`
`public.are_mutual_follows(a uuid, b uuid)` is SECURITY DEFINER, granted to `authenticated`, and
accepts any two users. Any signed-in user can find out whether two people follow each other,
private accounts included. Execute can't just be revoked, because the `buddy_live_cache` policy calls
the function. **Fix:** move it to the `private` schema, which PostgREST doesn't expose, and point the
policy and `is_track_buddy_member` at it. Or add a `private.is_mutual_with_me(other uuid)` wrapper
that always uses `auth.uid()`.

### L5: RevenueCat sandbox events grant premium
`supabase/functions/verify-purchase/index.ts` and `entitlement.ts` never look at
`event.environment`. Sandbox purchases are free (TestFlight, StoreKit testing, Play license testers)
and would set `profiles.is_premium = true` in production. **Fix:** ignore events with
`environment === 'SANDBOX'` in production (return 200), or keep them behind an allowlist of tester
user ids.

### L6: CSP covers framing only
`next.config.ts` now sends HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` and
`Permissions-Policy`, which fixes June M1. The CSP still has only `frame-ancestors`, `base-uri`,
`object-src` and `form-action`. Add the nonce-based `script-src` / `connect-src` / `img-src` policy
from the June report. Optionally add `preload` to HSTS.

### L7: Mobile dependency advisories
`npm audit --omit=dev` in the app reports 63 (2 critical: `tar`, `shell-quote`; 40 high). Most are
in the Expo/Metro/Jest build chain and don't ship in the binary. Runtime packages flagged include
`react-native-reanimated` and the `@xmldom/xmldom` / `node-forge` chain used by Expo tooling. Update
the Expo SDK patch release and re-audit.

---

## Info

- **I1:** `lib/admin/auth.ts` and `proxy.ts` allowlist by `user.email` without checking
  `email_confirmed_at`. This is safe today: the admin login is OTP-only, the mobile app has no
  `signUp`, and `inviteCoachByEmail` refuses admin addresses even though it creates unconfirmed users.
  Adding `&& user.email_confirmed_at` costs nothing and closes off future paths.

## Verified controls

- **Secrets:** nothing committed in either repo or its history. The RevenueCat `appl_`/`goog_` keys
  in `eas.json` are public SDK keys, and the Mapbox download token comes from an environment variable.
- **RLS:** enabled on every `public` table. Write policies are tied to the owner through `auth.uid()`,
  coaching tables use `FORCE RLS`, and restrictive policies hide unpublished coach content.
- **Privilege escalation:** `profiles` UPDATE is granted per column, without
  `is_premium`/`role`/`coach_status`. The `profiles_guard_privileged_columns` trigger is the second
  layer. Custom plans and meal logs require `is_premium`, which clients can't write.
- **SECURITY DEFINER functions:** all 219 set `search_path`. Default `anon` EXECUTE is revoked
  wherever it matters. Operator `admin_*` functions are `service_role`-only. The ones without inline
  `auth.uid()` checks delegate to membership helpers (`is_club_member`, `coaching_author`).
- **Storage:** private buckets (`meal-photos`, `gear-photos`, `coaching-documents`, `coaching-videos`,
  `coaching-plan-covers`) are limited to the owner's folder, and video upload rights are tied to an
  `uploading` row. Writes to `social-photos` go through `can_write_social_photo`.
- **Edge functions:** cron functions compare shared secrets with constant-time SHA-256. User functions
  call `getUser(token)`. The LLM functions take identity from the JWT, check premium under RLS,
  rate-limit on the server through RPCs the caller can't parameterise, and cap body size and tokens.
- **Webapp:** `safeNextPath` stops open redirects. Turnstile validates server-side with `remoteip`
  and fails closed. The partner API compares keys in constant time with a correct `Vary`. Server
  Actions coerce untrusted input and use `isOwn*Path` validators.
- **Mobile:** sessions are stored in SecureStore, OAuth uses PKCE, and the auth callback refuses
  tokens passed in the URL. YouTube IDs are parsed before being embedded.

## Action checklist

1. [app] H1: add the confirmation step to `app/buddy/invite.tsx`; consider making live sharing opt-in.
2. [web] M1: switch `clientIp()` to `x-nf-client-connection-ip`; confirm the Upstash variables are set in Netlify.
3. [web] M2: upgrade `next` to the latest 16.3.x and run `npm audit fix`.
4. [db] L3: revoke the anon insert on `waitlist`.
5. [db] L4: move `are_mutual_follows` to `private`.
6. [fn] L5: ignore `SANDBOX` events in `verify-purchase`.
7. [web] L1, L2, L6, I1 (small changes).
8. [app] L7: update the Expo SDK patch release and re-audit.
9. [ops] Still from June: confirm Supabase Auth CAPTCHA is *required*, OTP rate limits are tightened, and HIBP is enabled.
