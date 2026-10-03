export type ExerciseKey = `catalog:${string}` | `personal:${string}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params arrive decoded by Next. Bare UUID bookmarks always mean catalog. */
export function parseExerciseKey(value: string): { source: "catalog" | "personal"; id: string; key: ExerciseKey } {
  const parts = value.split(":");
  const source = parts.length === 1 ? "catalog" : parts[0];
  const id = parts.length === 1 ? parts[0] : parts[1];
  if (parts.length > 2 || (source !== "catalog" && source !== "personal") || !UUID.test(id)) {
    throw new Error("Invalid exercise identity");
  }
  const normalized = id.toLowerCase();
  return { source, id: normalized, key: `${source}:${normalized}` };
}

export function exerciseHref(key: string): string {
  return `/me/exercises/${encodeURIComponent(parseExerciseKey(key).key)}`;
}
