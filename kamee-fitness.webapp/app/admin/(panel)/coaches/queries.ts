import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CoachStatus } from "@/lib/coaching/states";

/**
 * Reads for the admin Coaches pages. Every query uses the service-role
 * client -- admins need to see every coach regardless of RLS (which only
 * ever lets a user read their own coaching_* rows).
 */

export type CoachListRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  role: string;
  coach_status: CoachStatus;
  created_at: string;
};

/** Every profile that is a coach or has ever entered the coaching lifecycle. */
export async function listCoachUsers(): Promise<CoachListRow[]> {
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name, role, coach_status, created_at")
    .or("role.eq.coach,coach_status.neq.none")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachListRow[];
}

export type CoachInviteSummary = {
  user_id: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

const IN_FILTER_CHUNK_SIZE = 100;

/** Latest coaching_invites row per user id, for the "Invited / Accepted" columns on the list. Chunks the `.in()` filter (M7, fix round 1) so a long coach list can't overflow the request URL. */
export async function listLatestInvites(
  userIds: string[],
): Promise<Record<string, CoachInviteSummary>> {
  if (userIds.length === 0) return {};
  const db = createAdminSupabase();
  const out: Record<string, CoachInviteSummary> = {};

  for (let i = 0; i < userIds.length; i += IN_FILTER_CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + IN_FILTER_CHUNK_SIZE);
    const { data, error } = await db
      .from("coaching_invites")
      .select("user_id, created_at, expires_at, accepted_at, revoked_at")
      .in("user_id", chunk)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as CoachInviteSummary[]) {
      // Rows arrive newest-first per the order() above, so the first row
      // seen for a user_id is already their latest invite.
      if (!out[row.user_id]) out[row.user_id] = row;
    }
  }
  return out;
}

export type InviteCandidate = {
  id: string;
  username: string | null;
  display_name: string | null;
  coach_status: CoachStatus;
};

const MAX_LIST_USERS_PAGES = 20;
const LIST_USERS_PAGE_SIZE = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteSearchResult = {
  candidate: InviteCandidate | null;
  /** True when the email scan exhausted MAX_LIST_USERS_PAGES without ever seeing a short (final) page -- there may be more users beyond what was scanned. */
  capped: boolean;
};

/**
 * Finds a candidate user for an invite by email or by username.
 *
 * An input is treated as an email only when it actually looks like one
 * (local-part@domain.tld) -- a bare "@handle" search still goes through the
 * username path below with its leading "@" stripped, matching how coaches
 * type their own handle. Email lookups page `auth.admin.listUsers` (200 per
 * page) until a match or a short page (fewer than perPage users means it's
 * the last page -- no need to fetch one more empty page to confirm),
 * capped at 20 pages (~4000 users) so a search for an email nobody has
 * can't loop forever; hitting the cap without a short page sets `capped`.
 */
export async function findUserForInvite(q: string): Promise<InviteSearchResult> {
  const query = q.trim();
  if (!query) return { candidate: null, capped: false };
  const db = createAdminSupabase();

  if (EMAIL_RE.test(query)) {
    const needle = query.toLowerCase();
    for (let page = 1; page <= MAX_LIST_USERS_PAGES; page++) {
      const { data, error } = await db.auth.admin.listUsers({
        page,
        perPage: LIST_USERS_PAGE_SIZE,
      });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      const hit = users.find((u) => u.email?.toLowerCase() === needle);
      if (hit) {
        const { data: p, error: pErr } = await db
          .from("profiles")
          .select("id, username, display_name, coach_status")
          .eq("id", hit.id)
          .single();
        if (pErr) throw new Error(pErr.message);
        return { candidate: (p as InviteCandidate) ?? null, capped: false };
      }
      if (users.length < LIST_USERS_PAGE_SIZE) {
        return { candidate: null, capped: false };
      }
    }
    return { candidate: null, capped: true };
  }

  const username = query.replace(/^@/, "");
  const { data: p, error } = await db
    .from("profiles")
    .select("id, username, display_name, coach_status")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { candidate: (p as InviteCandidate) ?? null, capped: false };
}

export type CoachProfileDetail = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_photo_path: string | null;
  avatar_url: string | null;
  role: string;
  coach_status: CoachStatus;
};

export type CoachingProfileDetail = {
  user_id: string;
  headline: string | null;
  about: string | null;
  specialties: string[];
  years_experience: number | null;
  languages: string[];
  location_label: string | null;
  cover_image_path: string | null;
  socials: Record<string, string>;
  is_accepting_clients: boolean;
  response_days: number;
  terms_accepted_at: string | null;
};

export type CoachCredentialRow = {
  id: string;
  title: string;
  issuer: string;
  issued_year: number | null;
  expires_on: string | null;
  document_path: string | null;
  document_sha256: string | null;
  position: number;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
};

export type CoachGalleryRow = {
  id: string;
  image_path: string;
  caption: string | null;
  position: number;
};

export type CoachReviewRow = {
  id: string;
  decision: "approved" | "changes_requested" | "suspended" | "reinstated" | "revoked";
  note: string | null;
  reviewer_id: string | null;
  created_at: string;
};

export type CoachDetail = {
  profile: CoachProfileDetail | null;
  coaching: CoachingProfileDetail | null;
  credentials: CoachCredentialRow[];
  gallery: CoachGalleryRow[];
  reviews: CoachReviewRow[];
  invite: CoachInviteSummary | null;
  missing: string[];
};

/**
 * M1 (fix round 1): every one of these reads throws on its own error
 * instead of the caller silently defaulting to `[]`/`null`. Before this
 * fix a failed `coaching_credentials` or `admin_coaching_profile_missing`
 * query would render as "no credentials" / "0 of 7 complete" -- a false
 * "nothing here" that looks identical to the coach genuinely having
 * nothing, instead of surfacing as an error. Next's admin error boundary
 * (or the default one) handles the throw.
 */
export async function loadCoachDetail(id: string): Promise<CoachDetail> {
  const db = createAdminSupabase();
  const [profile, coaching, credentials, gallery, reviews, invite, missing] =
    await Promise.all([
      db
        .from("profiles")
        .select("id, username, display_name, avatar_photo_path, avatar_url, role, coach_status")
        .eq("id", id)
        .maybeSingle(),
      db.from("coaching_profiles").select("*").eq("user_id", id).maybeSingle(),
      db
        .from("coaching_credentials")
        .select("*")
        .eq("coach_id", id)
        .order("position"),
      db.from("coaching_gallery").select("*").eq("coach_id", id).order("position"),
      db
        .from("coaching_reviews")
        .select("*")
        .eq("subject_kind", "profile")
        .eq("subject_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("coaching_invites")
        .select("user_id, created_at, expires_at, accepted_at, revoked_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(1),
      db.rpc("admin_coaching_profile_missing", { p_user: id }),
    ]);

  if (profile.error) {
    throw new Error(`loadCoachDetail: profiles query failed: ${profile.error.message}`);
  }
  if (coaching.error) {
    throw new Error(
      `loadCoachDetail: coaching_profiles query failed: ${coaching.error.message}`,
    );
  }
  if (credentials.error) {
    throw new Error(
      `loadCoachDetail: coaching_credentials query failed: ${credentials.error.message}`,
    );
  }
  if (gallery.error) {
    throw new Error(`loadCoachDetail: coaching_gallery query failed: ${gallery.error.message}`);
  }
  if (reviews.error) {
    throw new Error(`loadCoachDetail: coaching_reviews query failed: ${reviews.error.message}`);
  }
  if (invite.error) {
    throw new Error(`loadCoachDetail: coaching_invites query failed: ${invite.error.message}`);
  }
  if (missing.error) {
    throw new Error(
      `loadCoachDetail: admin_coaching_profile_missing failed: ${missing.error.message}`,
    );
  }

  return {
    profile: (profile.data as CoachProfileDetail) ?? null,
    coaching: (coaching.data as CoachingProfileDetail) ?? null,
    credentials: (credentials.data as CoachCredentialRow[]) ?? [],
    gallery: (gallery.data as CoachGalleryRow[]) ?? [],
    reviews: (reviews.data as CoachReviewRow[]) ?? [],
    invite: (invite.data?.[0] as CoachInviteSummary) ?? null,
    missing: (missing.data as string[]) ?? [],
  };
}
