/**
 * Pure helpers for the Coaching Hub's `social-photos` uploads (cover photo
 * for now; gallery reuses the same bucket/shape in a later task). No I/O —
 * components call `createBrowserSupabase().storage.from("social-photos")`
 * themselves with the path these functions build.
 */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/** `coaching/<user_id>/cover/<ts>.jpg` -- matches the CHECK constraint on coaching_profiles.cover_image_path. */
export function buildCoverPath(userId: string, now: number = Date.now()): string {
  return `coaching/${userId}/cover/${now}.jpg`;
}

/** Public object URL for a path in the public `social-photos` bucket. */
export function buildPublicStorageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/social-photos/${path}`;
}

export type FileCheckResult = { ok: true } | { ok: false; message: string };

/** Client-side pre-check only -- the server/storage policy remains the enforcer. */
export function checkImageFile(file: { type: string; size: number }): FileCheckResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: "Please choose a JPEG, PNG, or WEBP image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Image must be 5 MB or smaller." };
  }
  return { ok: true };
}
