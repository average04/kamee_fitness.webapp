/**
 * Pure helpers for the Coaching Hub's storage uploads: `social-photos`
 * (cover photo + gallery) and the private `coaching-documents` bucket
 * (credential evidence). No I/O — components call
 * `createBrowserSupabase().storage.from(...)` themselves with the path
 * these functions build, and every Server Action that writes a
 * client-supplied path (`setCoverPath`, `addGalleryPhoto`,
 * `setCredentialDocument`) validates it with the matching `isOwn*Path`
 * helper before ever touching the database (Server Actions are public
 * endpoints; the client-sent path string cannot be trusted).
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

/**
 * True only for a path shaped exactly `coaching/<uid>/gallery/<digits>.(jpg|png|webp)`
 * for the given uid (task-12: `social-photos` bucket, `coaching_gallery.image_path`
 * CHECK constraint `coaching/<coach_id>/gallery/%`). Same traversal/other-uid/
 * wrong-subfolder/extension/length guards as `isOwnCoverPath`.
 */
export function isOwnGalleryPath(path: unknown, uid: string): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) {
    return false;
  }
  if (!UUID_RE.test(uid)) return false;
  const re = new RegExp(`^coaching/${uid}/gallery/\\d+\\.(jpg|png|webp)$`);
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

/**
 * Credential document uploads (task-11): the private `coaching-documents`
 * bucket accepts pdf/jpeg/png up to 5 MB. A separate mime map from the
 * cover/gallery images above -- documents allow PDF and never webp.
 */
const DOCUMENT_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export type DocumentExtension = "pdf" | "jpg" | "png";

const DOCUMENT_MIME_TO_EXTENSION: Record<string, DocumentExtension> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** The extension `isOwnCredentialDocPath` expects for a given upload's mime type, or null if unsupported. */
export function extensionForDocumentMimeType(type: string): DocumentExtension | null {
  return DOCUMENT_MIME_TO_EXTENSION[type] ?? null;
}

/** Client-side pre-check only -- the storage policy (insert-only, owner path) remains the enforcer. */
export function checkDocumentFile(file: { type: string; size: number }): FileCheckResult {
  if (!DOCUMENT_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: "Please choose a PDF, JPEG, or PNG file." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "File must be 5 MB or smaller." };
  }
  return { ok: true };
}

/**
 * True only for a path shaped exactly `<uid>/<credentialId>/<uuid>.(pdf|jpg|png)`
 * -- matches `coaching_credentials`' CHECK constraint
 * `document_path like '<coach_id>/<id>/%'` and the storage bucket's
 * owner-only insert path. Both `uid` and `credentialId` must already be
 * UUIDs (the authenticated user's id and the credential row's own id); if
 * either isn't, every path is rejected rather than built into an
 * unanchored regex. `credentialId` is `unknown` because it round-trips
 * through a Server Action argument that the caller controls.
 */
export function isOwnCredentialDocPath(
  path: unknown,
  uid: string,
  credentialId: unknown,
): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LENGTH) {
    return false;
  }
  if (!UUID_RE.test(uid)) return false;
  if (typeof credentialId !== "string" || !UUID_RE.test(credentialId)) return false;
  // Fix round 1: no "i" flag -- crypto.randomUUID() (the only thing that
  // ever generates this segment) always produces lowercase hex, so an
  // uppercase-hex match here would only ever accept an object nothing in
  // this codebase can create.
  const re = new RegExp(
    `^${uid}/${credentialId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(pdf|jpg|png)$`,
  );
  return re.test(path);
}
