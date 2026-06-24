# Kamee Fitness — Application Security Remediation Report

**Scope:** Kamee Fitness web app (Next.js 16) + shared Supabase backend (`ywkqixaobbjxdncvnqav` / `kamee_fitness`)
**Date:** 2026-06-22 · **Author:** Lead Application-Security Engineer

---

## 1. Executive Summary

The application's **authorization core is sound**: every admin Server Action and protected page independently re-verifies identity via `requireAdmin()`/`requireUser()` using the server-validated `supabase.auth.getUser()` plus an `ADMIN_EMAILS` allowlist — it never trusts the proxy alone. Service-role usage is correctly `server-only`, gated at every call site, and uses explicit field allowlists (no mass-assignment, no SQL injection surface). Secrets are not committed and not exposed to the client. IDOR is prevented on all `/me` pages by `user_id`-scoped queries layered over RLS, and the SECURITY DEFINER buddy RPCs self-authorize on `auth.uid()`. **The material gaps are at the perimeter and in hardening, not in core authz**: there are no security response headers (no HSTS, no clickjacking protection, no CSP), no application-layer rate limiting on any unauthenticated surface, and one genuinely abusable endpoint — `/api/waitlist` — that has *neither* captcha *nor* rate limiting. None of the confirmed findings is a Critical or unauthenticated-data-exposure issue; the realistic worst cases are abuse/spam, clickjacking of an already-authenticated admin, and an open-redirect gated behind a burned auth code. Posture is **good with a clear, cheap remediation path**.

> Note on severities: each finding below shows the **verified** severity (post-confirmation), which in several cases is lower than the original triage label. Two original "high/medium" items collapse on inspection (the missing-headers item is the only one that lands at Medium with concrete impact).

---

## 2. Findings by Severity

### Critical
None.

### High
None. (The originally-High "no security headers" item was verified down to **Medium** — see below — because no live injection or auth-bypass results from it; its worst concrete impact is clickjacking of authenticated admins + missing HSTS.)

### Medium

**M1 — No security response headers (no HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP)**
*Where:* `next.config.ts:13-26` (no `headers()`), `proxy.ts` (sets none), no `vercel.json`/`netlify.toml`. *Dimension: headers-csp-xss.*
*Why it matters:* The admin backoffice and `/me` dashboard have state-changing actions and can be **framed for clickjacking** (no `X-Frame-Options`/`frame-ancestors`). No **HSTS** allows first-visit/downgrade MITM. No **CSP** means any future HTML/script injection (the JSON-LD sink is safe today but is the canonical future-injection point) has no second line of defense.
*Fix:* Add `async headers()` to `next.config.ts` for `source: '/(.*)'`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` (nothing here is meant to be embedded)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- A `Content-Security-Policy` (see M2; ideally nonce-based).

**M2 — No Content-Security-Policy (subsumed into M1's header block)**
*Where:* `app/page.tsx:50-53` (JSON-LD `dangerouslySetInnerHTML`; static constant, safe today); Turnstile injected at runtime on `login`/`admin/login`/`delete-account`. *Dimension: headers-csp-xss.*
*Why it matters:* No `script-src`/`connect-src`/`frame-src` governance, so an injection anywhere in the dependency chain runs unconstrained. Defense-in-depth, not a live exploit.
*Fix:* Ship one CSP (verified down to Low on its own, but pair it with M1):
```
default-src 'self';
script-src 'self' https://challenges.cloudflare.com 'nonce-<per-request>';
frame-src https://challenges.cloudflare.com;
connect-src 'self' https://challenges.cloudflare.com https://<NEXT_PUBLIC_SUPABASE_URL host>;
img-src 'self' data: https://<supabase-host>;
style-src 'self' 'unsafe-inline';
frame-ancestors 'none'; base-uri 'self'; object-src 'none'
```
Pass the nonce to the JSON-LD `<script>`. Allowlist **exactly** `https://challenges.cloudflare.com` for Turnstile (no `script-src https:` wildcard). Scope `img-src`/`connect-src` to the actual Supabase host `next.config.ts` already derives.

### Low

**L1 — `/api/waitlist`: no captcha AND no rate limiting (the one genuinely abusable endpoint)**
*Where:* `app/api/waitlist/route.ts:11-50`. *Dimensions: api-actions / abuse-ratelimit / authz-rls-serviceRole (merged).*
*Why it matters:* Public unauthenticated write whose only defenses are a trivially-bypassed honeypot (`company`) and an email regex — both bypassable by hitting Supabase REST directly with the public anon key (RLS policy is `WITH CHECK (true)`). A `curl` loop floods `public.waitlist` with unique attacker-chosen emails (the 23505 dup-handling doesn't help against rotating addresses). **Impact is bounded:** insert-only (no SELECT/UPDATE/DELETE policy → no read-back/PII), no confirmation email is sent (so no third-party mailbomb), rows are length-capped. Net: list-poisoning, garbage metrics, unbounded row/storage growth.
*Fix:* Add server-side **Turnstile** to the waitlist form + `verifyTurnstile()` before insert (mirror `delete-account`), **and** a coarse per-IP rate limit (~5/hr). Tighten the RLS `WITH CHECK` to validate email shape/length at the DB so the app validation can't be bypassed. Prefer routing the insert through a service-role action with Turnstile (matching the deletion-request pattern) so direct anon REST inserts are impossible.

**L2 — Open redirect via unvalidated `next` in `/auth/callback`**
*Where:* `app/auth/callback/route.ts:11-18`. *Dimension: auth-session.*
*Why it matters:* `next` is string-concatenated as `${origin}${next}`, so `next=.evil.com/x` → `https://kamee.app.evil.com/x` and `next=@evil.com` → host `evil.com` (verified at runtime). Constrained: only fires inside `if (!error)` after a **valid single-use PKCE code** is exchanged, so an attacker must burn a fresh code per victim and logs the victim into a *foreign* session — phishing/referrer-leak via the trusted origin, not victim-token theft.
*Fix:* Validate `next` with `new URL(next, origin)` and require `url.origin === origin`, else fall back to `/admin/exercises`. **Do not** rely on a `startsWith("//")` check alone — `.evil.com` and `@evil.com` evade it.

**L3 — Deletion-request action: no rate limit, no email dedupe (service-role insert)**
*Where:* `app/delete-account/actions.ts:21-29`. *Dimensions: api-actions / abuse-ratelimit (merged).*
*Why it matters:* Turnstile-gated (fails closed) but no per-IP limit and no UNIQUE on email; an attacker with rotating solved tokens can spam triage rows for arbitrary victim emails. **Not** a real-account-deletion vector — the purge cron acts only on `account_deletion_requests` keyed by `auth.users.id`; `web_deletion_requests` is manual triage. Worst case is triage noise/table bloat behind a working captcha.
*Fix:* Add per-IP rate limit (~3/hr). Add UNIQUE/upsert on `email`.

**L4 — `delete-account` email validation weaker than waitlist (substring `@` check)**
*Where:* `app/delete-account/actions.ts:13-20`. *Dimension: api-actions.*
*Why it matters:* Accepts any string containing `@`; garbage addresses land in the deletion queue (data-quality, not security).
*Fix:* Extract the waitlist `EMAIL_RE` to a shared lib and reuse it in both anon endpoints.

**L5 — OTP send is browser-initiated; captcha + rate limiting delegated entirely to Supabase**
*Where:* `app/login/page.tsx:81-88`, `app/admin/login/page.tsx:86-103`. *Dimensions: auth-session / abuse-ratelimit (merged).*
*Why it matters:* `signInWithOtp` runs in the browser with the anon key; the client-side `captchaToken` gate is bypassable via direct `/auth/v1/otp` REST. Real enforcement (Turnstile-required + per-email/per-IP OTP limits) is **Supabase project config**. `shouldCreateUser:false` blocks enumeration/self-signup. Code comments + the live mobile app strongly imply captcha is server-required; Supabase's built-in per-email cooldown caps targeted email-bombing regardless.
*Fix (config, not code):* **Confirm in the Supabase dashboard** that Turnstile CAPTCHA is set to *required* and Auth rate limits (email-send/hour, per-IP) are tightened for `ywkqixaobbjxdncvnqav`. For defense-in-depth, optionally route OTP send through a server action that applies an IP+email cooldown before `signInWithOtp` so the web app doesn't rely solely on limits shared with the mobile app.

**L6 — `verifyTurnstile` omits `remoteip` in siteverify call**
*Where:* `lib/turnstile.ts:7-16`. *Dimension: abuse-ratelimit.*
*Why it matters:* Tokens aren't bound to the solving IP, marginally lowering token-relay/farming cost. Optional param; captcha still functions (single-use, ~300s tokens).
*Fix:* Thread caller IP (`cf-connecting-ip`/`x-forwarded-for`) into `verifyTurnstile` as `remoteip`; optionally assert `data.hostname`.

**L7 — `setDemoVideo` / exercise form store unvalidated, unbounded video URL via service-role; rendered into `<a href>`**
*Where:* `app/admin/(panel)/exercises/actions.ts:156-169`; rendered `components/admin/VideoUrlCell.tsx:38-64`; form path `lib/admin/exercises.ts`. *Dimensions: api-actions / headers-csp-xss (merged).*
*Why it matters:* No scheme/host/length validation; a `javascript:` value becomes a clickable admin-origin link (React doesn't strip it). **Admin-gated on both write and read** → self-XSS / co-admin-to-admin only (requires a malicious admin to plant it and a second admin to click the ↗). Also a data-integrity gap for the shared mobile app.
*Fix:* On write, require `https://` + allowlisted host (`youtube.com`/`youtu.be`), cap length (~500). Apply in **both** `setDemoVideo` and `validateExerciseInput`. On render, only emit the link when `/^https?:\/\//i.test(openHref)`. CSP (M2) blocks `javascript:` as backstop.

**L8 — Inline toggle/update actions return raw Supabase `error.message` to the client**
*Where:* `exercises/actions.ts:167,185`; `plans/actions.ts:152,171,193`. *Dimension: api-actions.*
*Why it matters:* Leaks Postgres column/constraint/table names — but only to authenticated allowlisted admins (the form paths already return generic strings).
*Fix:* Return a fixed generic message; `console.error` the raw error server-side (mirror `createExercise`/`updateExercise`).

**L9 — Admin write actions apply no length/count bounds on text/array fields**
*Where:* `lib/admin/exercises.ts:78-88`, `lib/admin/plans.ts:140-157`. *Dimension: api-actions.*
*Why it matters:* Admin-only; oversized rows/storage growth, currency not constrained to ISO. Defense-in-depth.
*Fix:* Add cheap caps in the pure validators (e.g. name ≤120, primary_muscle ≤60, list items ≤80 chars/≤N items; plan title ≤160, summary/goal ≤2000, currency = 3 uppercase ISO letters).

**L10 — Moderate transitive dependency advisories (postcss XSS via Next, js-yaml DoS)**
*Where:* `package.json` (`next` pinned 16.2.6). *Dimension: secrets-deps-config.*
*Why it matters:* 3 moderate, all transitive/build-time — not runtime-reachable, but surface in any audit gate.
*Fix:* `npm audit fix`; bump `next` to the latest 16.2.x once it ships patched postcss. Run audit in CI as a non-blocking gate.

**L11 — Supabase leaked-password protection (HIBP) disabled**
*Where:* Supabase Auth config (not in repo). *Dimension: secrets-deps-config.*
*Why it matters:* No effect on the web app (OTP-only, no password surface); defense-in-depth for the shared backend's **mobile** password flows.
*Fix:* Enable HaveIBeenPwned leaked-password protection in Supabase Auth. No web code change.

### Info / Positive Controls (verified — keep as-is)

- **Admin allowlist enforced server-side, not proxy-only** — `requireAdmin()` re-runs `getUser()` + allowlist at every action/page (`lib/admin/auth.ts:12-23`). *Maintain: gate every new action/page; never rely on `proxy.ts`.*
- **Service-role client is `server-only` and gated at every call site** (`lib/supabase/admin.ts:1`). *Optional DiD: call `requireAdmin()` inside the cached `plans/queries.ts`/`metrics.ts` helpers too.*
- **IDOR prevented on all `/me` pages** via `requireUser` + `user_id`-scoped queries + RLS (`lib/me/queries.ts`).
- **6 SECURITY DEFINER buddy RPCs self-authorize on `auth.uid()`**, EXECUTE revoked from PUBLIC; web app makes zero `.rpc()` calls.
- **Mass-assignment prevented** via explicit field allowlists; `created_by`/`author_id` set from server-side `user.id`; parameterized query builder (no SQLi).
- **CSRF** on Server Actions relies on Next 16 built-in Origin enforcement (adequate; keep `allowedOrigins` at defaults).
- **Session cookies** use `@supabase/ssr` defaults (httpOnly, sameSite=lax, Secure on HTTPS). *Ensure HTTPS-only/HSTS (see M1).*
- **Secrets correct**: service-role + Turnstile secret are `server-only`, never in `use client`; `.env*` gitignored; anon key is the publishable type. *Rotate service-role if `.env.local` was ever shared.*
- **`avatar_url`** arbitrary remote `<img src>` — self-only render (viewer sees own profile), so info-level; CSP `img-src` (M2) neutralizes it.
- **Turnstile script** loaded without SRI — expected for the versioned endpoint; just allowlist its host when adding CSP.
- **Hardcoded Turnstile *site* key fallback** — public by design; operational nit. *Drop the `|| "0x..."` fallback; read from one shared module and fail fast if unset.*

---

## 3. Do We Need Rate Limiting and Other Protocols? — Direct Answer

**Yes — rate limiting is the single biggest gap, but it is needed on a *small, specific* set of endpoints, not everywhere.** There is currently **zero** application/edge rate limiting in the repo (`proxy.ts` only does auth/session refresh; grep for `ratelimit/upstash/@vercel/kv/throttle` = 0 matches).

### Endpoints that need rate limiting

| Endpoint | Priority | Suggested limit | Why |
|---|---|---|---|
| `POST /api/waitlist` | **1 (highest)** | ~5 inserts / hour / IP | The only surface with **no captcha at all**; floodable today. |
| OTP send — `/login`, `/admin/login` (`signInWithOtp`) | **2** | ~5 / hour / IP **+** per-email cooldown (≥60s) | Email-cost + targeted email-bombing. Primary fix is Supabase config (below); app-side limit is DiD. |
| `submitDeletionRequest` (`/delete-account` action) | **3** | ~3 / hour / IP | Captcha-gated already; limit stops token-farmed triage-row spam. |

### Mechanism

- Use **Upstash Ratelimit (`@upstash/ratelimit` + `@upstash/redis`)** with a **sliding window**, keyed by IP (`cf-connecting-ip` / `x-forwarded-for`). It persists across serverless invocations — an **in-memory limiter does NOT survive serverless cold starts and is unsuitable**.
- Implement once as a shared utility; apply at the top of each route/action above. (Vercel/Netlify Edge KV is an acceptable alternative backend.)

### Other protocols needed (in priority order)

1. **Security headers + CSP** (see M1/M2) — add `async headers()` in `next.config.ts`: HSTS, `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a nonce-based CSP scoped to `challenges.cloudflare.com` + the Supabase host.
2. **Server-verified captcha on `/api/waitlist`** — add Turnstile + `verifyTurnstile()` (the app already has the secret + helper). Confirm **Supabase Auth captcha is set to *required*** server-side so the browser-side OTP captcha can't be bypassed via direct REST.
3. **Supabase Auth rate limits** — tighten email-send/hour and per-IP OTP limits in the dashboard for `ywkqixaobbjxdncvnqav` (shared with mobile, so don't rely on global defaults alone).
4. **RLS / RPC hardening** — tighten `public.waitlist` `WITH CHECK (true)` to validate email shape/length at the DB (or move the insert behind a service-role+Turnstile action). Add UNIQUE on `web_deletion_requests(email)`. Buddy RPCs are already correctly authorized — keep `auth.uid()` checks on any refactor.
4. **Leaked-password protection (HIBP)** — enable in Supabase Auth (backend-wide, for mobile password flows).
5. **Dependency updates** — `npm audit fix` + bump `next` patch; add a non-blocking audit gate in CI.
6. **`remoteip` in Turnstile siteverify** — bind tokens to solver IP.

---

## 4. Prioritized Action Checklist

1. [supabase] Confirm Turnstile CAPTCHA is set to **required** in Auth for `ywkqixaobbjxdncvnqav` (closes the OTP client-bypass — do this first, it's a config toggle).
2. [supabase] Tighten Supabase Auth OTP rate limits (email-send/hour + per-IP).
3. [web] Add Turnstile + `verifyTurnstile()` to `POST /api/waitlist` (mirror `delete-account`).
4. [web] Add a shared Upstash sliding-window rate limiter; apply to `/api/waitlist` (~5/hr), OTP send (~5/hr + per-email cooldown), `delete-account` (~3/hr).
5. [web] Add `async headers()` in `next.config.ts`: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
6. [web] Add a nonce-based CSP (scope to `challenges.cloudflare.com` + Supabase host); pass nonce to the JSON-LD script.
7. [web] Validate `next` in `/auth/callback` via `new URL(next, origin)` + `url.origin === origin`, fallback to `/admin/exercises`.
8. [supabase] Tighten `public.waitlist` INSERT policy from `WITH CHECK (true)` to validate email shape/length.
9. [web] Validate `demo_video_path` on write (https + youtube allowlist, ≤500 chars) in both `setDemoVideo` and `validateExerciseInput`; only render `<a>` for `https?:` URLs.
10. [web] Return generic error strings from inline toggle actions; `console.error` raw `error.message` server-side.
11. [web] Add max length/count bounds in `validateExerciseInput` and `validatePlanInput` (incl. 3-letter ISO currency).
12. [web] Share `EMAIL_RE` between `/api/waitlist` and `/delete-account`; replace the `@`-substring check.
13. [supabase] Add UNIQUE constraint (or upsert) on `web_deletion_requests(email)`.
14. [web] Thread caller IP as `remoteip` into `verifyTurnstile`; optionally assert `data.hostname`.
15. [supabase] Enable HaveIBeenPwned leaked-password protection in Auth.
16. [web] `npm audit fix`; bump `next` to latest 16.2.x patch; add non-blocking audit gate in CI.
17. [web] Drop the hardcoded Turnstile **site-key** fallback; read from one shared module, fail fast if unset.
18. [web] (DiD) Call `requireAdmin()` inside the cached `plans/queries.ts` + `metrics.ts` helpers.
19. [supabase] Rotate the service-role key if `.env.local` was ever shared outside the dev machine.