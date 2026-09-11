/**
 * The one UUID shape check shared by the Coaching Hub modules
 * (`./admin` for Server Action arguments, `./storage` for path segments).
 * Case-insensitive: Postgres renders uuids lowercase, but a caller-typed id
 * may not be.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for a syntactically valid UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
