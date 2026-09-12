import { buildPublicStorageUrl } from "./storage";

/**
 * Avatar image source for a coach, or null. Only `profiles.avatar_photo_path`
 * (an uploaded photo in the public `social-photos` bucket) ever becomes an
 * `<img src>`. `profiles.avatar_url` is a preset avatar id, not a URL, so it
 * is deliberately NOT accepted here -- callers render a neutral placeholder
 * (see `avatarInitial`) when this returns null. Also null without a Supabase
 * URL, so a missing env var never yields a relative, broken src.
 */
export function avatarImageUrl(
  photoPath: string | null | undefined,
  supabaseUrl: string,
): string | null {
  if (!photoPath || !photoPath.trim() || !supabaseUrl) return null;
  return buildPublicStorageUrl(supabaseUrl, photoPath);
}

/** The single character shown in the placeholder avatar: the name's first letter, uppercased, or "?" for a blank name. */
export function avatarInitial(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const first = Array.from(trimmed)[0] ?? "?";
  return first.toUpperCase();
}
