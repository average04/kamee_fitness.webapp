// Mirror of src/lib/legal.ts LEGAL_VERSION in the mobile app.
// Bump both whenever the prose of either MDX changes materially.

export const TERMS_VERSION = "2026-06-06";
export const PRIVACY_VERSION = "2026-06-06";

// Human-readable "Last updated" date shown on each page banner.
export const LAST_UPDATED = "June 6, 2026";

// Coach Terms (Coaching Hub). Separate from TERMS_VERSION: only invited
// coaches accept them, through the accept_coaching_terms RPC, which records
// the server time and the version (Supabase migration 20260913100600).
//
// The version a coach accepts is the database's current version
// (coaching_terms_versions.is_current). The hub only offers acceptance when
// that equals COACH_TERMS_VERSION below, so the text this deploy renders at
// COACH_TERMS_PATH is the text being accepted. To publish new terms:
//   1. change content/legal/coach-terms.mdx, set the new version and date here,
//      set COACH_TERMS_DRAFT = false, and deploy;
//   2. then run admin_publish_coaching_terms(<version>, 'https://kamee.fit/coaching/terms').
// While COACH_TERMS_DRAFT is true the page carries a draft banner and nobody
// can accept.
export const COACH_TERMS_VERSION = "2026-09-15";
export const COACH_TERMS_LAST_UPDATED = "September 15, 2026";
const COACH_TERMS_TEXT_IS_DRAFT = true; // flip to false once legal approves the text

// Local manual testing only: `next dev` with COACH_TERMS_LOCAL_PREVIEW=1
// (set in .env.development.local) treats the draft as final so acceptance can
// be exercised against the local database. Production builds run with
// NODE_ENV=production and ignore the variable entirely.
export const COACH_TERMS_DRAFT =
  COACH_TERMS_TEXT_IS_DRAFT &&
  !(process.env.NODE_ENV === "development" && process.env.COACH_TERMS_LOCAL_PREVIEW === "1");
export const COACH_TERMS_PATH = "/coaching/terms";
