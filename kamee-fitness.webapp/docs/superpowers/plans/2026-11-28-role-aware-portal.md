# Role-aware portal implementation plan

> **For agentic workers:** Use subagent-driven development for the independent auth, admin-email and sidebar tasks. Root owns integration and final verification.

**Goal:** Role-correct sign-in, a consistent role-filtered sidebar, and admin-only coach account emails.

**Architecture:** Shared server-verified portal session/capabilities; role-safe landing for OTP/PKCE/deep links; shared presentation shell around existing protected layouts. Existing allowlist and coach lifecycle authorization remains authoritative.

**Tech stack:** Installed Next16.3.8, React19, Supabase SSR/Auth2, CSS modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-28-role-aware-portal.md`.

## Constraints and review focus

- No hosted data/role/schema/RLS mutation or new paid resources.
- Preserve admin allowlist policy, coach lifecycle gates, verified Auth and action-level authorization.
- Never trust user metadata for privileges; never send target Auth user objects to client/public readers.
- Preserve valid invite/deletion/deep-link context, query/hash and refreshed cookies; reject cross-role targets, auth loops and open redirects.
- Preserve coach unsaved-work confirmation, uncertain journal recovery and sign-out boundaries.
- Preserve existing untracked work. Reuse this checkout; Preview only, no Production merge/deploy or Android OTA.

## Tasks

- [x] Auth: reproduce explicit admin-next/code/callback failures, add shared server portal session reader and role-safe continuation helpers, correct OTP/PKCE/login/proxy/admin/coach entry behavior, test trust/error/lifecycle/route matrix.
- [x] Admin email: add guarded exact-target server-only reader and admin detail row; test real-gate denial before service-client creation, malformed target, minimal DTO, provider failures and no public exposure.
- [x] Sidebar: pure role-filtered navigation model and accessible responsive shared shell; integrate member/coach/admin layouts while retaining coach secondary navigation and guarded links/sign-out. Test role matrices and rendered behavior.
- [x] Verification: full web tests, types, lint/build, desktop/mobile real-component visual checks, independent critical review and Claude verdict/provider blocker. Fix concrete findings.
- [ ] Release: commit/push existing Preview branch, verify PR12 deploy and feasible hosted smoke; update canonical app feature map and QA checkpoint with actual evidence and limits.

Release outcome is recorded after deployment in companion app `docs/qa/role-aware-portal-2026-11-28.md` and the canonical feature map. See this web repository's matching QA checkpoint for the frozen pre-release checks.
