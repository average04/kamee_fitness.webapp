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

/** Latest coaching_invites row per user id, for the "Invited / Accepted" columns on the list. */
export async function listLatestInvites(
  userIds: string[],
): Promise<Record<string, CoachInviteSummary>> {
  if (userIds.length === 0) return {};
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("coaching_invites")
    .select("user_id, created_at, expires_at, accepted_at, revoked_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const out: Record<string, CoachInviteSummary> = {};
  for (const row of (data ?? []) as CoachInviteSummary[]) {
    // Rows arrive newest-first per the order() above, so the first row seen
    // for a user_id is already their latest invite.
    if (!out[row.user_id]) out[row.user_id] = row;
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

/**
 * Finds a candidate user for an invite by email or by username.
 *
 * An input is treated as an email only when it actually looks like one
 * (local-part@domain.tld) -- a bare "@handle" search still goes through the
 * username path below with its leading "@" stripped, matching how coaches
 * type their own handle. Email lookups page `auth.admin.listUsers` (200 per
 * page) until a match or an empty page, capped at 20 pages (~4000 users) so
 * a search for an email nobody has can't loop forever.
 */
export async function findUserForInvite(q: string): Promise<InviteCandidate | null> {
  const query = q.trim();
  if (!query) return null;
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
        const { data: p } = await db
          .from("profiles")
          .select("id, username, display_name, coach_status")
          .eq("id", hit.id)
          .single();
        return (p as InviteCandidate) ?? null;
      }
      if (users.length === 0) break;
    }
    return null;
  }

  const username = query.replace(/^@/, "");
  const { data: p } = await db
    .from("profiles")
    .select("id, username, display_name, coach_status")
    .eq("username", username)
    .maybeSingle();
  return (p as InviteCandidate) ?? null;
}

export type CoachProfileDetail = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_photo_path: string | null;
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

export async function loadCoachDetail(id: string): Promise<CoachDetail> {
  const db = createAdminSupabase();
  const [profile, coaching, credentials, gallery, reviews, invite, missing] =
    await Promise.all([
      db
        .from("profiles")
        .select("id, username, display_name, avatar_photo_path, role, coach_status")
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
