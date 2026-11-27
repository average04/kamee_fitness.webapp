# Role-aware portal — 2026-11-28

The owner requested role-correct login destinations, a role-filtered sidebar and admin visibility of coach account emails. Scope is the existing PR12 web Preview branch; no Production merge, Android release, account provisioning, schema change or backend control change.

## Implementation

Both email-code and PKCE login complete through a server-verified role resolver. Existing allowlisted admins land at `/admin`, approved coaches at `/coaching/dashboard`, members at `/me`, and invited/setup coaches at their existing lifecycle destination. Valid local, role-appropriate continuations retain query/hash; unsafe origins, auth loops and unavailable role areas fall back to the account's own destination. Verified non-admins visiting admin routes redirect without the former misleading authorization banner. Refresh cookies survive proxy redirects. Existing CAPTCHA and existing-account-only sign-in remain.

The shared desktop sidebar/mobile Menu contains only available groups, preserves common activity/records, and retains the coach secondary navigation, pending feedback and existing sign-out boundaries. The new skip link exposed an existing upload guard that treated fragment navigation as leaving; the narrow fix exempts equal-origin/path/query fragments while preserving route/query/cross-origin, unload and history safeguards.

Admin coach details show a labelled Account email from an exact Auth Admin lookup after `requireAdmin`. Only email/null leaves the server reader. No email was added to public coach readers, list payloads or member/coach data. Existing verified-email `ADMIN_EMAILS` authority remains unchanged.

## Fresh verification

- Full Vitest: **104 files, 1,350 tests passed; 8 existing opt-in live cases skipped**. Auth, sidebar, email and upload regressions were observed failing before fixes.
- `npx tsc --noEmit --incremental false`: exit0.
- ESLint on all33 changed/new TypeScript files: exit0, no warnings. Unrestricted `npm run lint` also scans pre-existing untracked QA bundles and fails there plus the unchanged `LegalDocLayout.tsx` anchor rule; this is not represented as a clean full-repository lint run.
- `npm run build -- --webpack`: exit0 after the final upload-guard change. This local environment lacks Supabase public configuration, so the existing sitemap generator skips plan pages with a warning; no hosted runtime/auth proof is inferred from that build.
- Local real browser renders the actual PortalShell/PortalSidebar, navigation helpers, coaching header and production styles with synthetic capability data and minimal Next primitives mocked. Desktop1440x900 plus mobile390x844/320x740 pass visual review; role/lifecycle groups and active route are correct, no horizontal overflow, links46px and Menu/sign-out44px, Escape closes/focuses Menu. Protected dashboard content, real email lookup and genuine sign-in are not simulated as hosted acceptance.
- Independent auth/email review: CLEAR; separately121/121 focused tests. Independent sidebar/layout review found only the upload skip-link issue, now closed by another independent delta review and6/6 actual-component tests. No remaining Critical/High/Medium finding.
- Required Claude source-only request froze22 production/dependency files,98,067bytes, prompt SHA256 `9872c51cd4cc52d7d208bd264180ec56702584f71d950c76ea3b9d46fa9e52ef`. Provider timed out after90seconds, no verdict; frozen files had zero drift. The earlier owner-authorized independent-review fallback is used. No Claude approval is claimed.

Local receipts and screenshots are under `.superpowers/qa/portal-roles-20261128/`; generated harnesses/provider snapshots remain untracked. Final release commit, Netlify status and feasible hosted smoke are recorded in companion app `docs/qa/role-aware-portal-2026-11-28.md` and its canonical feature map after deployment. The retained IAB session displayed a session-changed fence; genuine signed-in hosted acceptance needs a normal fresh owner login.
