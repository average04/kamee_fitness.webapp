# Coaching refinement release — 2026-09-15

This release improves login and invite sign-in, supports inviting an email without
an existing app account, and combines profile setup into a single onboarding flow.
Profile/cover photos and credentials are optional; three gallery photos, headline,
about and current terms remain required. Coaches can upload a profile photo on web.

The builder uses numbered training days, explicit Hybrid sessions, clearer removal
and ordering controls, multi-select goals/equipment/muscles, a visible cover picker,
and plan-local custom exercises with sets/reps or timed prescriptions.

## Deployment dependency

Before merging this PR to main (Netlify auto-deploys), apply the companion backend
migrations in order:

1. `20260915130000_coaching_photos_optional`
2. `20260915140000_plan_goals_array`
3. `20260915150000_coaching_custom_exercises`
4. `20260915160000_coaching_legacy_read_gate`

The last migration protects old mobile clients from null catalog joins by closing
legacy direct coaching-content reads, including owner reads. The web's authorized
RPC and admin review retain full content. This does not launch discovery or enrollment.

Production keeps its existing Supabase, Resend, admin allowlist and CAPTCHA settings.
Local env files, test accounts, dev logs and the rejected illustration are not released.
The CAPTCHA bypass requires development mode and loopback page/API origins.

## Smoke test

- Login page shows the new artwork and email/code form.
- Admin and coach sign-ins land in their corresponding workspaces; explicit next
  destinations and invite-token email binding remain intact.
- A coach can set a public name and profile photo; skip credentials; upload several
  gallery photos; preview and submit without an avatar or cover.
- On a draft plan, save/reload multiple goals and custom timed/rep exercises; inspect
  admin preview and a cloned next version. In-review versions remain frozen.
- Never send an invitation or accept terms merely as an automated deployment check.

Rollback: restore the previous web build first. Follow backend rollback instructions;
custom-exercise rollback refuses to discard saved custom entries, and the legacy
read gate must remain until those entries are converted or every reader is compatible.
