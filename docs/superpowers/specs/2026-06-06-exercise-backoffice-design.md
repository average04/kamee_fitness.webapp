# Exercise Catalog Backoffice — Design

**Date:** 2026-06-06
**Status:** Approved (Approach A)
**Repo:** `kamee-fitness.webapp` (Next.js app nested at `kamee-fitness.webapp/kamee-fitness.webapp/`)

## Goal

Give the owner an authenticated admin area to perform **full CRUD on the
`exercises` catalog** — the table the Kamee mobile app reads to render workouts.
This is the first vertical slice of a broader backoffice; it also establishes the
auth + admin-shell foundation that later resources (plans, users) will reuse.

## Decisions

| Question | Decision |
|---|---|
| First resource | **Exercise catalog** (full table) |
| Auth | **Supabase Auth + email allowlist** (`ADMIN_EMAILS` env) |
| Operations | **Full CRUD** (create, edit, delete) + demo-image upload |
| Privileged writes | **Approach A** — Next.js server-side service-role client |

## Key constraints discovered

1. **`exercises` writes are blocked at the database.** RLS is enabled and the only
   policy is `"exercises: public read"` (`select using true`). There is **no
   insert/update/delete policy**, and the `exercise-demos` storage bucket has **no
   write policy** either. Per `20260519010000_hardening_storage_functions.sql`,
   this is deliberate: *"only the service role can write."* Therefore full CRUD
   **must** go through a server-side service-role client.
2. **The webapp has no auth today.** Supabase Auth + `@supabase/ssr` are added
   from scratch. Existing public surfaces (landing, `/terms`, `/privacy`,
   `/api/waitlist`) are untouched; the anon waitlist client (`lib/supabase.ts`)
   stays as-is.
3. **Next.js 16.2.6** has breaking changes vs. older versions (`AGENTS.md`). The
   bundled guides in `node_modules/next/dist/docs/` (middleware, server actions)
   and the current `@supabase/ssr` docs MUST be read before writing code.
4. **Shared production database.** The `kamee_fitness` project is shared with the
   mobile app. This design makes **no schema or RLS migration** — the production
   model is untouched; privilege comes from the service-role key held server-side.

## The `exercises` table

| Column | Type | Editable | Form treatment |
|---|---|---|---|
| `id` | uuid PK | no | hidden |
| `name` | text, required | yes | text input |
| `slug` | text, required, **unique** | yes | auto-suggest from name; normalize to `[a-z0-9-]`; unique |
| `primary_muscle` | text, required (free text) | yes | dropdown seeded from existing distinct values, free-text allowed |
| `secondary_muscles` | text[] | yes | chip/tag input |
| `equipment` | text[] | yes | chip/tag input |
| `is_bodyweight` | bool, **generated** (`cardinality(equipment)=0`) | no | shown read-only; never written |
| `demo_image_path` | text → `exercise-demos` bucket | yes | image upload widget |
| `demo_video_path` | text (no bucket yet) | yes | optional text input |
| `cues` | text[] | yes | ordered list input |
| `common_mistakes` | text[] | yes | ordered list input |
| `created_by` | uuid → profiles(id), nullable | on create | set to acting admin's id; read-only after |
| `created_at` | timestamptz | no | shown read-only |

## Architecture

A new authenticated `/admin/*` area inside the existing Next app. Three layers:

### Session layer
Add `@supabase/ssr`. New helpers:
- `lib/supabase/server.ts` — request/cookie-bound session client for Server
  Components and Route Handlers (reads the logged-in user).
- `lib/supabase/client.ts` — browser client for the login form.
- `lib/supabase/admin.ts` — **service-role** client. Guarded with `import "server-only"`;
  reads `SUPABASE_SERVICE_ROLE_KEY`. Imported **only** by server action files.

### Guard layer
- `middleware.ts` (app root) — refreshes the Supabase session and protects
  `/admin/*`:
  - not authenticated → redirect to `/admin/login`
  - authenticated but `email ∉ ADMIN_EMAILS` → 403 / signed out
- `lib/admin/auth.ts` — `requireAdmin()` (returns the verified admin user or
  redirects) and the pure allowlist parse/match helper. `requireAdmin()` is
  re-checked in `app/admin/layout.tsx` **and** at the top of every server action.
  The client is never trusted.

### Data layer
- **Reads** use the anon/session client (exercises are public-read).
- **All writes + image uploads** run in Server Actions using the service-role
  client, only after `requireAdmin()` passes.

## File layout

```
middleware.ts
lib/supabase/server.ts
lib/supabase/client.ts
lib/supabase/admin.ts
lib/admin/auth.ts            requireAdmin(), allowlist (pure, unit-tested)
lib/admin/exercises.ts       validation/parse helpers + types (pure, unit-tested)
app/admin/layout.tsx         verifies admin; brand-dark shell, nav, sign-out
app/admin/page.tsx           redirect → /admin/exercises
app/admin/login/page.tsx     Supabase Auth magic-link, allowlist-gated
app/admin/exercises/page.tsx            list: search + paginated table
app/admin/exercises/new/page.tsx
app/admin/exercises/[id]/edit/page.tsx
app/admin/exercises/actions.ts          createExercise / updateExercise /
                                        deleteExercise / uploadDemoImage
components/admin/ExerciseForm.tsx        shared new/edit form
components/admin/ArrayField.tsx          chip/ordered-list input
components/admin/ImageUploadField.tsx    current image + replace/remove
components/admin/ExerciseTable.tsx       list rendering
```

## Data flow

### List (`/admin/exercises`)
Server component reads exercises via the session/anon client. Renders a
searchable (name/slug/muscle), paginated table: name · primary_muscle ·
equipment/bodyweight · has-image · edit link. "New exercise" CTA.

### Create / Edit
Shared `ExerciseForm`:
- Array fields (`secondary_muscles`, `equipment`, `cues`, `common_mistakes`) use
  chip/list inputs.
- `primary_muscle` is a dropdown seeded from existing distinct DB values, still
  accepting free text.
- `is_bodyweight` displayed read-only (derived from `equipment`).
- Submit → server action → `requireAdmin()` → validate → service-role
  insert/update → `revalidatePath('/admin/exercises')`.

### Slug
Auto-suggested from `name`, normalized to lowercase `[a-z0-9-]`. A Postgres
`23505` unique violation is mapped to a friendly inline "slug already exists"
error rather than a 500.

### Image upload
`ImageUploadField` posts the file to the `uploadDemoImage` server action, which:
1. `requireAdmin()`
2. validates MIME (`image/png` | `image/jpeg`) and size (≤ 10 MB, matching the
   bucket's `file_size_limit`)
3. uploads to `exercise-demos/<slug>.<ext>` via the service-role client (upsert,
   so replacing overwrites the same path)
4. sets `demo_image_path` on the row

On exercise **delete**, the storage object is **left in place** (avoids
accidentally removing an asset that may be referenced elsewhere). Documented
behavior; can be revisited.

### `created_by`
Set to the acting admin's profile id on create; read-only afterward.

## Error handling

- Server actions return `{ ok: true } | { ok: false, error: string }`. Forms
  render inline errors and preserve user input on failure.
- Auth/session failures redirect to `/admin/login`.
- The service-role key is never imported outside `lib/supabase/admin.ts`
  (`server-only` guard) and never reaches the browser bundle.

## Configuration

New **server-only** environment variables (documented for `.env.local` and
Netlify):
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key for the `kamee_fitness` project
  (already used by the mobile app's upload scripts).
- `ADMIN_EMAILS` — comma-separated allowlist of admin email addresses.

No new public (`NEXT_PUBLIC_*`) variables beyond the existing URL + anon key.

## Testing

- **Unit (TDD, first):** the pure logic carrying the risk —
  - slug normalization,
  - allowlist parsing/matching,
  - form-payload parsing (array splitting, trimming, generated-column exclusion,
    required-field validation).
- **Manual QA checklist** for the end-to-end flow (login gate, allowlist
  rejection, list/search, create, edit, delete, image upload/replace), since the
  repo has no integration-test infra yet. Run against a non-destructive path
  (e.g. create-then-delete a throwaway exercise) given the shared production DB.

## Out of scope (future slices)

- Managing plans / the plan tree, users/profiles, subscriptions, waitlist.
- Audit log of admin changes.
- Bulk import/export.
- A dedicated demo-video bucket (column exists but unused).
```