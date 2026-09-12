# Coaching authoring

The approved-coach workspace adds `/coaching/plans` and `/coaching/videos`.
Operators review plans and catalog requests at `/admin/coaching-plans`.
Keep Kamee's dark surfaces, leaf controls and existing coaching typography.

Requires the companion mobile/backend `feat/coaching-hub-b` migrations and edge
functions. The complete rollout and validation record is in that repository's
`docs/coaching-hub-b-release-plan.md`. Database migrations and functions must land
before this PR merges to `main`, because Netlify deploys `main` automatically.

Plan saves are transactional RPCs under the coach's user session. Operator review
uses service-role RPCs only after `requireAdmin` checks the email allowlist. Covers
are immutable, private uploads. Videos upload directly to Supabase through TUS;
`finalize-coaching-video` seals/validates them, and playback uses short-lived signed
links with an ETag check. Never add public video reads or use the old admin tree
actions for coaching content.

Use `npm test`, `npm run build` and scoped ESLint to validate web changes.
Outdoor logic is mirrored from mobile; check or refresh it with:

```sh
node scripts/sync-coaching-outdoor.mjs --check /path/to/mobile/repo
node scripts/sync-coaching-outdoor.mjs /path/to/mobile/repo
```

Local browser tests use `.env.development.local` with a local Supabase URL. Keep
production `.env.local` separate. New B content and deployments have not been
released to production. Native intro playback requires the new 1.0.9 binary;
buyer access and purchases remain the next phase.

Review corrections are included in the same PR. Drafts have a per-account,
per-plan working copy in sessionStorage; Back/Forward and reload offer recovery,
and plan actions return session errors without redirecting away from edits.
Recovery is local to the browser tab, not a server autosave. Clear/discard the
copy explicitly or save successfully to remove it. A changed server revision is
shown before restoring; restoring is an explicit choice to reconcile local edits.

Meal days retain the existing 1,200-6,000 kcal database range. This is a software
constraint, not nutrition advice; partial meals can be saved against a valid day
target and must match it at submission. Calories are not inferred from 4/4/9.
Failed owned video references can remain in drafts for replacement, but cannot
pass review or be selected as profile intros. Read-only versions show the full
preview, including every week and meal day.
