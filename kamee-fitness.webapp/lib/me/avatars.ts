// `profiles.avatar_url` stores a preset-avatar KEY (e.g. "female-coder"), not a
// URL — the artwork ships bundled in the mobile app. We ported the same 14
// busts into public/avatars/<group>/<name>.png and resolve the key here.
// See the app's src/lib/avatars.ts for the canonical list.

const GROUPS = new Set(["male", "female"]);
const NAMES = new Set([
  "astronaut",
  "coder",
  "cool",
  "ninja",
  "pirate",
  "sheriff",
  "street",
]);

/**
 * Resolve a stored `avatar_url` to a usable web image src:
 * - real http(s) URLs pass through (e.g. a future OAuth avatar)
 * - preset keys like "female-coder" → "/avatars/female/coder.png"
 * - null / empty / unknown → null (caller falls back to the name initial)
 */
export function avatarSrc(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  const dash = avatarUrl.indexOf("-");
  if (dash < 0) return null;
  const group = avatarUrl.slice(0, dash);
  const name = avatarUrl.slice(dash + 1);
  if (!GROUPS.has(group) || !NAMES.has(name)) return null;
  return `/avatars/${group}/${name}.png`;
}
