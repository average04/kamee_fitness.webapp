/**
 * Pure helpers for the Coaching Hub's `social-photos` uploads (cover photo
 * for now; gallery reuses the same bucket/shape in a later task). No I/O —
 * components call `createBrowserSupabase().storage.from("social-photos")`
 * themselves with the path these functions build, and the `setCoverPath`
 * Server Action calls `isOwnCoverPath` before ever touching the database
 * (Server Actions are public endpoints; the client-sent path string cannot
 * be trusted).
 */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export type CoverExtension = "jpg" | "png" | "webp";

const MIME_TO_EXTENSION: Record<string, CoverExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** The extension `buildCoverPath`/`isOwnCoverPath` expect for a given upload's mime type, or null if unsupported. */
export function extensionForMimeType(type: string): CoverExtension | null {
  return MIME_TO_EXTENSION[type] ?? null;
}

/** `coaching/<user_id>/cover/<ts>.<ext>` -- matches the CHECK constraint on coaching_profiles.cover_image_path. */
export function buildCoverPath(
  userId: string,
  ext: CoverExtension,
  now: number = Date.now(),
): string {
  return `coaching/${userId}/cover/${now}.${ext}`;
}

const MAX_PATH_LENGTH = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for a path shaped exactly `coaching/<uid>/cover/<digits>.(jpg|png|webp)`
 * for the given uid. Guards against path traversal, another user's folder,
 * the wrong sub-folder, a missing/unsupported extension, and overlong
 * input. `uid` is expected to already be a UUID (the authenticated user's
 * id); if it somehow isn't, every path is rejected rather than built into
 * an unanchored regex.
 */
export function isOwnCoverPath(path: unknown, uid: string): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) {
    return false;
  }
  if (!UUID_RE.test(uid)) return false;
  const re = new RegExp(`^coaching/${uid}/cover/\\d+\\.(jpg|png|webp)$`);
  return re.test(path);
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
